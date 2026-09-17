"use client";

import { Led, LogFeed, Panel, Skeleton } from "@/components/ui";
import { api, fmtClock } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 border border-ash/15 bg-smoke/40 px-4 py-5">
      <Led tone="bone" size="sm" />
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
        {text}
      </span>
    </div>
  );
}

/**
 * Ops feed panel — moved off the control-room console onto /resources.
 * Polls api.events() itself; `className` controls the scroll region height.
 */
export function OpsFeed({ className }: { className?: string }) {
  const { data, loading, error } = usePolling(() => api.events(40), 4000);

  const lines = [...(data ?? [])].reverse().map((e) => ({
    time: fmtClock(e.ts),
    tag: e.tag,
    text: e.message,
    tone: e.tone,
  }));

  return (
    <Panel
      title="Ops feed"
      led={error ? "off" : "on"}
      right={`${lines.length} rows`}
      bodyClassName={className ?? "max-h-[460px] overflow-y-auto"}
      className="min-w-0"
    >
      {data === null && loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : error && data === null ? (
        <EmptyNote text="Feed down — backend :8000 unreachable" />
      ) : lines.length === 0 ? (
        <EmptyNote text="Feed empty — no events logged" />
      ) : (
        <LogFeed lines={lines} />
      )}
    </Panel>
  );
}
