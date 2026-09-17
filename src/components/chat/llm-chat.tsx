"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowDown, Siren, Terminal } from "lucide-react";
import { Led, Panel, Skeleton } from "@/components/ui";
import {
  api,
  fmtClock,
  type ChatMessage,
  type ChatToolCall,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LineTone = "flame" | "bone" | "dead";

interface Line extends ChatMessage {
  tone?: LineTone;
  /** still receiving tokens from /api/chat/stream */
  streaming?: boolean;
}

/** Clickable directives shown on an empty link — they send for real. */
const SUGGESTIONS = [
  "What's on the board right now?",
  "Summarize the active incidents",
  "Roll the nearest pumper to the newest incident",
];

const MAX_COMPOSER_H = 160;

/** Three staggered pulse dots — "…" for a thinking agent. */
function Ellipsis() {
  return (
    <span aria-hidden className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-pulse text-flame/80"
          style={{ animationDelay: `${i * 180}ms` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

/** Compact arg line — `key=value` pairs, arrays joined, kept on one line. */
function fmtArgs(args: Record<string, unknown>): string {
  const s = Object.entries(args)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" · ");
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

/** One tool invocation — name + args on the call line, outcome below. */
function ToolCall({ call }: { call: ChatToolCall }) {
  return (
    <div className="border-l border-blaze/40 pl-2.5">
      <div className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.2em]">
        <Terminal
          aria-hidden
          className="h-3 w-3 shrink-0 translate-y-[2px] text-blaze"
        />
        <span className="shrink-0 text-blaze/90">{call.name}</span>
        {call.args !== undefined && Object.keys(call.args).length > 0 && (
          <span className="min-w-0 truncate text-ash/60">
            {fmtArgs(call.args)}
          </span>
        )}
      </div>
      {call.summary && (
        <div className="mt-0.5 pl-5 font-mono text-[10px] tracking-wide text-ash/80">
          {call.summary}
        </div>
      )}
    </div>
  );
}

/**
 * AGENT LINK // SIREN-1 — the home page. Full-height uplink: feed scrolls,
 * composer is pinned. Operator traffic carries a bone right bar, agent
 * traffic a flame left bar under a SIREN-1 header; tool calls render as
 * named blocks between them. Enter sends, Shift+Enter newline.
 */
export function LlmChat({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [linkDown, setLinkDown] = useState(false);
  const [purgeArmed, setPurgeArmed] = useState(false);
  const [showJump, setShowJump] = useState(false);

  const localId = useRef(0);
  const nextId = () => --localId.current;

  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const purgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atBottom = useRef(true);

  /* hydrate from persisted history; silent-fail to an empty link */
  useEffect(() => {
    let alive = true;
    api
      .chatHistory()
      .then((history) => {
        if (alive) setMessages(history);
      })
      .catch(() => {
        if (alive) setLinkDown(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      if (purgeTimer.current) clearTimeout(purgeTimer.current);
    };
  }, []);

  /* follow the wire only while pinned to the bottom edge — the pill itself
     is armed inside send()/patch(), where the updates actually arrive */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

  function onScrollFeed() {
    const el = scrollRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottom.current = pinned;
    if (pinned) setShowJump(false);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setShowJump(false);
  }

  /* two-click purge — first press arms, second wipes the uplink log */
  function onPurge() {
    if (!purgeArmed) {
      setPurgeArmed(true);
      purgeTimer.current = setTimeout(() => setPurgeArmed(false), 3000);
      return;
    }
    if (purgeTimer.current) clearTimeout(purgeTimer.current);
    setPurgeArmed(false);
    api
      .clearChat()
      .then(() => setMessages([]))
      .catch(() => setLinkDown(true));
  }

  function growComposer(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_H)}px`;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const agentId = nextId();
    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        role: "user",
        content: trimmed,
        ts: new Date().toISOString(),
      },
      {
        id: agentId,
        role: "assistant",
        content: "",
        ts: new Date().toISOString(),
        tool_calls: [],
        streaming: true,
      },
    ]);
    setDraft("");
    if (textRef.current) textRef.current.style.height = "auto";
    atBottom.current = true;
    setShowJump(false);
    setPending(true);

    const patch = (fn: (l: Line) => Line) => {
      if (!atBottom.current) setShowJump(true);
      setMessages((m) => m.map((x) => (x.id === agentId ? fn(x) : x)));
    };
    const killLink = (detail: string) =>
      patch((l) => ({
        ...l,
        streaming: false,
        tone: "dead",
        content: l.content
          ? `${l.content}\nUPLINK LOST — ${detail}`
          : `UPLINK LOST — ${detail}`,
      }));

    try {
      await api.chatStream(trimmed, (ev) => {
        if (ev.type === "delta" && ev.text) {
          patch((l) => ({ ...l, content: l.content + ev.text }));
        } else if (ev.type === "tool") {
          patch((l) => ({
            ...l,
            tool_calls: [
              ...(l.tool_calls ?? []),
              {
                name: ev.name ?? "tool",
                args: ev.args ?? {},
                summary: ev.summary ?? "",
              },
            ],
          }));
        } else if (ev.type === "done") {
          patch((l) => ({ ...l, streaming: false, ts: ev.ts ?? l.ts }));
          setLinkDown(false);
        } else if (ev.type === "error") {
          patch((l) => ({ ...l, ts: ev.ts ?? l.ts }));
          killLink(ev.detail ?? "stream error");
          setLinkDown(true);
        }
      });
    } catch (e) {
      killLink(e instanceof Error ? e.message : "request failed");
      setLinkDown(true);
    } finally {
      setPending(false);
    }
  }

  function onTransmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <Panel
      title="Agent link // SIREN-1"
      led={linkDown ? "off" : "on"}
      className={cn("flex min-h-0 flex-col", className)}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      right={
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPurge}
            disabled={pending || loading || messages.length === 0}
            className={cn(
              "font-mono text-[9px] uppercase tracking-[0.25em] transition-colors",
              "disabled:pointer-events-none disabled:opacity-40",
              purgeArmed ? "text-flame" : "text-ash/60 hover:text-bone",
            )}
          >
            {purgeArmed ? "confirm?" : "purge"}
          </button>
          {linkDown && <span className="text-flame">down</span>}
        </span>
      }
    >
      {/* feed — newest at the bottom, fills the panel height */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScrollFeed}
          className="h-full overflow-y-auto [scrollbar-width:thin]"
        >
          <div className="mx-auto max-w-3xl space-y-7 px-5 py-6">
            {loading ? (
              <div className="space-y-4 pt-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="ml-auto h-4 w-1/2" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5">
                <Siren
                  aria-hidden
                  strokeWidth={1.25}
                  className="h-10 w-10 text-flame/60"
                />
                <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
                  <Led tone={linkDown ? "off" : "flame"} size="sm" />
                  {linkDown
                    ? "link down — backend unreachable"
                    : "siren-1 on the wire — directives hit the live ops db"}
                </div>
                {!linkDown && (
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="border border-flame/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-bone/70 transition-colors hover:border-flame/50 hover:bg-wine/30 hover:text-bone"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="text-right">
                    <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/50">
                      you · {fmtClock(m.ts)}
                    </div>
                    <p className="inline-block border-r-2 border-bone/25 pr-3 text-right font-mono text-xs leading-relaxed tracking-wide text-bone">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={m.id}>
                    <div
                      className={cn(
                        "mb-1.5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em]",
                        m.tone === "dead" ? "text-ash/60" : "text-flame/80",
                      )}
                    >
                      <Siren aria-hidden className="h-3 w-3" />
                      siren-1 · {fmtClock(m.ts)}
                    </div>
                    <div
                      className={cn(
                        "border-l-2 pl-3.5",
                        m.tone === "dead"
                          ? "border-ash/30"
                          : "border-flame/40",
                      )}
                    >
                      {m.tool_calls !== undefined &&
                        m.tool_calls.length > 0 && (
                          <div className="mb-2 space-y-1.5">
                            {m.tool_calls.map((t, i) => (
                              <ToolCall key={`${t.name}-${i}`} call={t} />
                            ))}
                          </div>
                        )}
                      {m.streaming && !m.content ? (
                        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/70">
                          receiving downlink
                          <Ellipsis />
                        </p>
                      ) : (
                        <p
                          className={cn(
                            "whitespace-pre-wrap font-mono text-xs leading-relaxed tracking-wide",
                            m.tone === "dead"
                              ? "text-ash"
                              : "text-bone/85",
                          )}
                        >
                          {m.content}
                          {m.streaming && (
                            <span className="ml-0.5 animate-pulse text-flame">
                              ▌
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </div>

        {showJump && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 border border-flame/40 bg-ink px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-flame transition-colors hover:bg-wine/60"
          >
            <ArrowDown aria-hidden className="h-3 w-3" />
            latest
          </button>
        )}
      </div>

      {/* composer — Enter transmits, Shift+Enter breaks the line */}
      <form
        onSubmit={onTransmit}
        className="shrink-0 border-t border-flame/15"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-3 px-5 py-3.5">
          <span
            aria-hidden
            className="pb-2 font-mono text-xs leading-relaxed text-flame"
          >
            ›
          </span>
          <textarea
            ref={textRef}
            rows={1}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              growComposer(e.target);
            }}
            onKeyDown={onComposerKey}
            placeholder={
              pending
                ? "agent is responding…"
                : "directive for siren-1 — ⏎ to send"
            }
            disabled={pending}
            autoComplete="off"
            aria-label="Message SIREN-1"
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 font-mono text-xs leading-relaxed tracking-wide text-bone placeholder:text-ash/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="shrink-0 pb-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.25em] text-flame transition-colors hover:text-blaze disabled:pointer-events-none disabled:opacity-40"
          >
            send ↵
          </button>
        </div>
      </form>
    </Panel>
  );
}
