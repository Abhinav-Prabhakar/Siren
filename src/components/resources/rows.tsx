import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

/** BadgeTone → icon/text color for status-tinted glyphs. */
export const TONE_TEXT: Record<BadgeTone, string> = {
  hot: "text-flame",
  warm: "text-blaze",
  cold: "text-bone/70",
  dead: "text-ash/50",
  plain: "text-flame/70",
};

/**
 * 12-segment micro bar — the one number a row carries, shown as a
 * proportion instead of digits. Pulses when the value is at/below lowAt.
 */
export function MiniBar({
  value,
  lowAt = 25,
  segments = 12,
  className,
}: {
  value: number;
  lowAt?: number;
  segments?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * segments);
  const low = clamped <= lowAt;
  return (
    <div className={cn("flex flex-1 gap-[2px]", className)}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1",
            i < filled ? (low ? "bg-flame" : "bg-flame/70") : "bg-smoke",
            low && i === filled - 1 && "animate-pulse",
          )}
        />
      ))}
    </div>
  );
}

/** One clickable row in a sidebar list. */
export function Row({
  onClick,
  dimmed = false,
  children,
}: {
  onClick: () => void;
  /** De-emphasized rows — off-watch, dead units. */
  dimmed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b border-flame/10 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-flame/5 focus-visible:outline-none focus-visible:bg-flame/10",
        dimmed && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}
