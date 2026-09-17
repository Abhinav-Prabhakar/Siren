import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  time: string;
  title: string;
  detail?: string;
  tone?: "flame" | "bone" | "ash";
  /** Glyph rendered on the rail instead of the default diamond node. */
  icon?: LucideIcon;
  node?: ReactNode;
}

const ICON_TONE = {
  flame: "text-flame",
  bone: "text-bone/70",
  ash: "text-ash",
} as const;

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
        className="absolute bottom-1 left-[5px] top-1 w-px bg-flame/20"
      />
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <li key={i} className="relative pl-6">
            {Icon !== undefined ? (
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[3px] top-0 flex h-4 w-4 items-center justify-center bg-coal",
                  ICON_TONE[item.tone ?? "bone"],
                )}
              >
                <Icon strokeWidth={2} className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1 h-[11px] w-[11px] rotate-45 border bg-coal",
                  item.tone === "flame"
                    ? "border-flame"
                    : item.tone === "bone"
                      ? "border-bone/50"
                      : "border-ash/40",
                )}
              />
            )}
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
        );
      })}
    </ol>
  );
}
