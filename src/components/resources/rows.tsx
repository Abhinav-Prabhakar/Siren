import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

/** BadgeTone → text color for status words. */
export const TONE_TEXT: Record<BadgeTone, string> = {
  hot: "text-flame",
  warm: "text-blaze",
  cold: "text-bone/70",
  dead: "text-ash/50",
  plain: "text-flame/70",
};

/** BadgeTone → bordered chip treatment for row icons. */
export const TONE_CHIP: Record<BadgeTone, string> = {
  hot: "border-flame/50 bg-wine/60 text-flame",
  warm: "border-blaze/35 bg-blaze/10 text-blaze",
  cold: "border-bone/25 bg-bone/5 text-bone/70",
  dead: "border-ash/15 bg-ash/5 text-ash/50",
  plain: "border-flame/25 bg-flame/10 text-flame/80",
};

/**
 * 12-segment micro bar — one metric as a proportion instead of digits.
 * Pulses when the value is at/below lowAt.
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

/** Status-tinted square that anchors each row — the visual differentiator. */
export function IconChip({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center border",
        TONE_CHIP[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * Slim section header inside a manifest — groups rows so the list reads
 * in chunks instead of a wall of identical entries.
 */
export function GroupLabel({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pb-1.5 pt-3 first:pt-2">
      <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-flame/80">
        {label}
      </span>
      <span className="font-mono text-[8px] tabular-nums text-ash/60">
        {count}
      </span>
      <span aria-hidden className="h-px flex-1 bg-flame/10" />
    </div>
  );
}

/** One clickable row in a sidebar manifest. */
export function Row({
  onClick,
  onHover,
  dimmed = false,
  children,
}: {
  onClick: () => void;
  /** Fires on mouse enter/leave and focus/blur — drives the inspector dock. */
  onHover?: (hovering: boolean) => void;
  /** De-emphasized rows — off-watch, dead units. */
  dimmed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-flame/5 focus-visible:outline-none focus-visible:bg-flame/10",
        dimmed && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

/** Right-aligned two-line block at the end of a row — status word + key value. */
export function RowMeta({
  top,
  topClassName,
  bottom,
}: {
  top: ReactNode;
  topClassName?: string;
  bottom: ReactNode;
}) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <span
        className={cn(
          "font-mono text-[8px] uppercase tracking-[0.2em]",
          topClassName,
        )}
      >
        {top}
      </span>
      <span className="font-mono text-[9px] tabular-nums text-ash">
        {bottom}
      </span>
    </span>
  );
}

/**
 * Inspector dock — fixed strip pinned to the sidebar bottom. Hovering a
 * row fills it with that entity's detail so the list itself stays lean.
 */
export function InspectorDock({
  title,
  icon,
  idle,
  children,
}: {
  /** Null → dock shows the idle summary instead of row fields. */
  title: ReactNode;
  icon?: ReactNode;
  /** Content shown when no row is hovered — a manifest summary. */
  idle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-[96px] shrink-0 border-t border-flame/15 bg-ink/60 px-4 py-2.5">
      {title === null ? (
        <div className="flex h-full min-h-[72px] flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
          {idle}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {icon}
            <span className="min-w-0 truncate font-display text-[11px] font-bold uppercase tracking-[0.15em] text-bone">
              {title}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/** One label/value cell inside the inspector dock. */
export function DockCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-ash/60">
        {label}
      </div>
      <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-bone/85">
        {children}
      </div>
    </div>
  );
}

/** ISO timestamp → "now" | "42m" | "3h 20m" — the next-free readout. */
export function fmtFree(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.floor((Date.parse(iso) - Date.now()) / 1000);
  if (s <= 0) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

/** lat/lng → compact position string. */
export function fmtPos(lat: number, lng: number): string {
  return `${lat.toFixed(4)} / ${lng.toFixed(4)}`;
}
