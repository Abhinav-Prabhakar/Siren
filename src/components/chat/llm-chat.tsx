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
 * POSTs to /api/chat, which relays to the LLM with a live station snapshot.
 */
export function LlmChat({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [linkDown, setLinkDown] = useState(false);

  const localId = useRef(0);
  const nextId = () => --localId.current;

  const scrollRef = useRef<HTMLDivElement>(null);

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
    };
  }, []);

  /* keep newest traffic pinned to the bottom edge */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

  async function onTransmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", content: text, ts: new Date().toISOString() },
    ]);
    setDraft("");
    setPending(true);

    try {
      const res = await api.chat(text);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          content: res.reply,
          ts: res.ts,
          tool_calls: res.tool_calls,
        },
      ]);
      setLinkDown(false);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "request failed";
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          content: `UPLINK LOST — ${detail}`,
          ts: new Date().toISOString(),
          tone: "dead",
        },
      ]);
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
        <span className={cn(linkDown ? "text-ash/70" : "text-flame")}>
          LINK {linkDown ? "// DOWN" : "// LIVE"}
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
                    <p
                      className={cn(
                        "font-mono text-[11px] leading-relaxed tracking-wide",
                        m.tone === "dead" ? "text-ash" : "text-bone/85",
                      )}
                    >
                      {m.content}
                    </p>
                  </div>
                </div>
              ),
            )}
            {pending && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <Led tone="blaze" pulse size="sm" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-flame/80">
                    SIREN-1
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/50">
                    agent thinking
                    <Ellipsis />
                  </span>
                </div>
                <Skeleton className="h-9 w-2/3" />
              </div>
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
