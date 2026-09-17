import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  time: string;
  title: string;
  detail?: string;
  tone?: "flame" | "bone" | "ash";
  node?: ReactNode;
}

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-4", className)}>
      <span
        aria-hidden
        className="absolute bottom-1 left-[5px] top-1 w-px bg-gradient-to-b from-flame/50 via-flame/20 to-transparent"
      />
      {items.map((item, i) => (
        <li key={i} className="relative pl-6">
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1 h-[11px] w-[11px] rotate-45 border",
              item.tone === "flame"
                ? "border-flame bg-wine shadow-[0_0_8px_rgb(255_46_46/0.6)]"
                : item.tone === "bone"
                  ? "border-bone/50 bg-coal"
                  : "border-ash/40 bg-coal",
            )}
          />
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] tracking-widest text-flame/90">
              {item.time}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-bone/90">
              {item.title}
            </span>
          </div>
          {item.detail !== undefined && (
            <p className="mt-0.5 text-xs leading-relaxed text-ash">{item.detail}</p>
          )}
          {item.node}
        </li>
      ))}
    </ol>
  );
}
