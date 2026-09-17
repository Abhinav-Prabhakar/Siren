"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Led, Panel, Skeleton } from "@/components/ui";
import { api, fmtClock, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type LineTone = "flame" | "bone" | "dead";

interface Line extends ChatMessage {
  tone?: LineTone;
  /** still receiving tokens from /api/chat/stream */
  streaming?: boolean;
}

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

/**
 * AGENT LINK // SIREN-1 — operator ⇄ dispatch-agent uplink as a plain
 * terminal feed: agent traffic carries a flame left bar, operator
 * messages sit right-aligned. No bubbles, no nested chrome.
 */
export function LlmChat({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [linkDown, setLinkDown] = useState(false);
  const [purgeArmed, setPurgeArmed] = useState(false);

  const localId = useRef(0);
  const nextId = () => --localId.current;

  const scrollRef = useRef<HTMLDivElement>(null);
  const purgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* keep newest traffic pinned to the bottom edge */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

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

  async function onTransmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const agentId = nextId();
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", content: text, ts: new Date().toISOString() },
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
    setPending(true);

    const patch = (fn: (l: Line) => Line) =>
      setMessages((m) => m.map((x) => (x.id === agentId ? fn(x) : x)));
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
      await api.chatStream(text, (ev) => {
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

  return (
    <Panel
      title="Agent link // SIREN-1"
      led="pulse"
      className={className}
      bodyClassName="p-0"
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
          <span className={linkDown ? "text-ash/70" : "text-flame"}>
            {linkDown ? "down" : "live"}
          </span>
        </span>
      }
    >
      {/* feed — newest at the bottom */}
      <div
        ref={scrollRef}
        className="h-[340px] space-y-2.5 overflow-y-auto px-4 py-3 [scrollbar-width:thin]"
      >
        {loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="ml-auto h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2.5">
            <Led tone={linkDown ? "off" : "flame"} size="sm" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
              {linkDown ? "link down" : "link live — no traffic"}
            </span>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="text-right">
                <p className="font-mono text-[11px] leading-relaxed tracking-wide text-bone">
                  {m.content}
                </p>
                <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash/50">
                  you · {fmtClock(m.ts)}
                </span>
              </div>
            ) : (
              <div
                key={m.id}
                className={cn(
                  "border-l-2 pl-2.5",
                  m.tone === "dead" ? "border-ash/30" : "border-flame/40",
                )}
              >
                {m.tool_calls !== undefined && m.tool_calls.length > 0 && (
                  <div className="mb-1 space-y-0.5">
                    {m.tool_calls.map((t, i) => (
                      <div
                        key={`${t.name}-${i}`}
                        className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.2em]"
                      >
                        <span className="shrink-0 text-blaze/90">
                          ⚙ {t.name}
                        </span>
                        <span className="min-w-0 truncate text-ash/70">
                          {t.summary}
                        </span>
                      </div>
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
                      "whitespace-pre-wrap font-mono text-[11px] leading-relaxed tracking-wide",
                      m.tone === "dead" ? "text-ash" : "text-bone/85",
                    )}
                  >
                    {m.content}
                    {m.streaming && (
                      <span className="ml-0.5 animate-pulse text-flame">▌</span>
                    )}
                  </p>
                )}
                <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash/50">
                  s1 · {fmtClock(m.ts)}
                </span>
              </div>
            ),
          )
        )}
      </div>

      {/* composer */}
      <form
        onSubmit={onTransmit}
        className="flex items-center gap-2.5 border-t border-flame/15 px-4 py-2.5"
      >
        <span aria-hidden className="font-mono text-[11px] text-flame">
          ›
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            pending ? "agent is responding…" : "directive for siren-1"
          }
          disabled={pending}
          autoComplete="off"
          aria-label="Message SIREN-1"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] tracking-wide text-bone placeholder:text-ash/50 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.25em] text-flame transition-colors hover:text-blaze disabled:pointer-events-none disabled:opacity-40"
        >
          send ↵
        </button>
      </form>
    </Panel>
  );
}
