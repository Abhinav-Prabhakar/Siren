"use client";

import { Radio, ShieldCheck } from "lucide-react";
import { Led, LogFeed, Skeleton } from "@/components/ui";
import { api, fmtClock } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

function Note({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ash/50">
      {icon}
      {text}
    </div>
  );
}

/**
 * Ops feed — the ambient station wire. Kept visually quiet: a label
 * line and a dimmed mono stream, subordinate to everything above it.
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
    <section className="min-w-0">
      <div className="flex items-center gap-2.5 border-b border-flame/10 pb-2">
        <Radio className="h-3.5 w-3.5 text-ash" />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash/80">
          ops feed
        </span>
      </div>

      <div className={cn("pt-3 opacity-80", className)}>
        {data === null && loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error && data === null ? (
          <Note
            icon={<Led tone="off" size="sm" />}
            text="Feed down — backend unreachable"
          />
        ) : lines.length === 0 ? (
          <Note
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            text="No events logged"
          />
        ) : (
          <LogFeed lines={lines} />
        )}
      </div>
    </section>
  );
}
