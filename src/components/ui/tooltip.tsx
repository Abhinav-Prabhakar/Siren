import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hover readout — secondary data surfaced as a chamfered tag on
 * hover/focus instead of occupying the layout. CSS-only; keep it out of
 * clipped scroll containers (use a `title` attr there instead).
 */
export function Tip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  /** Which edge the tag opens toward. */
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span
      tabIndex={0}
      className={cn(
        "group/tip relative inline-flex items-center outline-none",
        className,
      )}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "clip-tag pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-64 -translate-x-1/2 whitespace-normal bg-coal px-2.5 py-1.5 text-left font-mono text-[9px] uppercase leading-relaxed tracking-[0.18em] text-bone/80 shadow-[inset_0_0_0_1px_rgb(255_46_46/0.3)] [--chamfer:5px] group-hover/tip:block group-focus-within/tip:block",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
