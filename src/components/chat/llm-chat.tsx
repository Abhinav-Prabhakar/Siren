"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Button,
  Divider,
  Input,
  Kbd,
  Led,
  Panel,
  Skeleton,
} from "@/components/ui";
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

function AgentTag({ ts, dead }: { ts: string; dead?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Led tone={dead ? "off" : "blaze"} size="sm" />
      <span
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.3em]",
          dead ? "text-ash/70" : "text-flame/80",
        )}
      >
        SIREN-1
      </span>
      <span className="font-mono text-[9px] tracking-[0.2em] text-ash/50">
        {fmtClock(ts)}
      </span>
    </div>
  );
}

/**
 * AGENT LINK // SIREN-1 — operator ⇄ dispatch-agent uplink.
 * POSTs to /api/chat/stream — tokens and tool-call records land live over SSE.
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
      title="AGENT LINK // SIREN-1"
      led="pulse"
      chamfered
      className={className}
      bodyClassName="flex flex-col gap-3"
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
            {purgeArmed ? "confirm purge?" : "purge"}
          </button>
          <span className={cn(linkDown ? "text-ash/70" : "text-flame")}>
            LINK {linkDown ? "// DOWN" : "// LIVE"}
          </span>
        </span>
      }
    >
      {/* traffic buffer — newest at the bottom */}
      <div
        ref={scrollRef}
        className="h-[320px] space-y-3 overflow-y-auto border border-ash/15 bg-ink/70 p-3 [scrollbar-width:thin]"
      >
        {loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="ml-auto h-9 w-1/2" />
            <Skeleton className="h-9 w-3/5" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Led tone={linkDown ? "off" : "flame"} pulse={!linkDown} />
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
              link established // no traffic
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/50">
              {linkDown
                ? "history sync failed — backend :8000 unreachable"
                : "awaiting first transmission"}
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex flex-col items-end gap-1">
                  <div className="clip-tag max-w-[85%] border border-flame/40 bg-wine/70 px-3 py-2 [--chamfer:8px]">
                    <p className="font-mono text-[11px] leading-relaxed tracking-wide text-bone">
                      {m.content}
                    </p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash/50">
                    you // {fmtClock(m.ts)}
                  </span>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start gap-1">
                  <AgentTag ts={m.ts} dead={m.tone === "dead"} />
                  <div
                    className={cn(
                      "clip-tag max-w-[85%] border px-3 py-2 [--chamfer:8px]",
                      m.tone === "dead"
                        ? "border-ash/20 bg-smoke/40"
                        : "border-ash/25 bg-smoke/80",
                    )}
                  >
                    {m.tool_calls !== undefined &&
                      m.tool_calls.length > 0 && (
                        <div className="mb-1.5 space-y-1 border-b border-ash/15 pb-1.5">
                          {m.tool_calls.map((t, i) => (
                            <div
                              key={`${t.name}-${i}`}
                              className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.2em]"
                            >
                              <span className="shrink-0 text-flame">⚙</span>
                              <span className="shrink-0 text-blaze/90">
                                {t.name}
                              </span>
                              <span className="min-w-0 truncate text-ash/80">
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
                          <span className="ml-0.5 animate-pulse text-flame">
                            ▌
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>

      <Divider label="uplink buffer" />

      {/* composer */}
      <form onSubmit={onTransmit} className="flex items-start gap-3">
        <div className="flex-1">
          <Input
            glyph="›"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              pending ? "agent is responding…" : "type directive for siren-1…"
            }
            disabled={pending}
            autoComplete="off"
            aria-label="Message SIREN-1"
          />
        </div>
        <Button
          type="submit"
          variant="solid"
          size="sm"
          led={pending ? "pulse" : "on"}
          disabled={pending || !draft.trim()}
        >
          Transmit
        </Button>
      </form>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash/50">
          ch-01 // secure dispatch band
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ash/50">
          <Kbd className="h-5 min-w-5">↵</Kbd> send
        </span>
      </div>
    </Panel>
  );
}
