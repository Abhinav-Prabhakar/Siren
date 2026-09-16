import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "hot" | "warm" | "cold" | "dead" | "plain";

const toneClasses: Record<
  BadgeTone,
  { frame: string; fill: string; text: string; dot: string }
> = {
  hot: {
    frame: "bg-flame",
    fill: "bg-wine",
    text: "text-flame",
    dot: "bg-flame animate-pulse",
  },
  warm: {
    frame: "bg-blaze/70",
    fill: "bg-smoke",
    text: "text-blaze",
    dot: "bg-blaze",
  },
  cold: {
    frame: "bg-bone/25",
    fill: "bg-coal",
    text: "text-bone/70",
    dot: "bg-bone/50",
  },
  dead: {
    frame: "bg-ash/20",
    fill: "bg-coal",
    text: "text-ash",
    dot: "bg-ash/40",
  },
  plain: {
    frame: "bg-flame/40",
    fill: "bg-wine/50",
    text: "text-bone/80",
    dot: "bg-flame/70",
  },
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Hides the status dot. */
  noDot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = "plain",
  noDot = false,
  className,
  children,
}: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span className={cn("clip-tag inline-flex", t.frame, className)}>
      <span
        className={cn(
          "clip-tag m-px inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] [--chamfer:5px]",
          t.fill,
          t.text,
        )}
      >
        {!noDot && <span aria-hidden className={cn("h-1 w-1", t.dot)} />}
        {children}
      </span>
    </span>
  );
}
