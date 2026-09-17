import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "hot" | "warm" | "cold" | "dead" | "plain";

const toneClasses: Record<
  BadgeTone,
  { frame: string; fill: string; text: string; dot: string }
> = {
  hot: {
    frame:
      "bg-flame shadow-[0_0_14px_-2px_rgb(255_46_46/0.9)]",
    fill: "bg-wine",
    text: "text-flame [text-shadow:0_0_10px_rgb(255_46_46/0.6)]",
    dot: "bg-flame shadow-[0_0_6px_1px_rgb(255_46_46/0.9)] animate-pulse",
  },
  warm: {
    frame: "bg-blaze/80",
    fill: "bg-smoke",
    text: "text-blaze",
    dot: "bg-blaze shadow-[0_0_5px_rgb(255_106_61/0.7)]",
  },
  cold: {
    frame: "bg-bone/30",
    fill: "bg-coal",
    text: "text-bone/80",
    dot: "bg-bone/60",
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
          "clip-tag m-px inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] [--chamfer:5px]",
          t.fill,
          t.text,
        )}
      >
        {!noDot && <span aria-hidden className={cn("h-1.5 w-1.5", t.dot)} />}
        {children}
      </span>
    </span>
  );
}
