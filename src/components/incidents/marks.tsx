import type { ReactNode } from "react";
import { ChevronUp, Minus, type LucideIcon } from "lucide-react";
import { Led } from "@/components/ui";
import { statusTone, type IncidentPriority } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  STATUS_ICON_FALLBACK,
  STATUS_ICONS,
  toneTextClass,
  toneToLed,
} from "./incident-icons";

const CHIP_TONE: Record<string, string> = {
  hot: "bg-flame/15 text-flame shadow-[inset_0_0_0_1px_rgb(255_46_46/0.25)]",
  warm: "bg-blaze/10 text-blaze shadow-[inset_0_0_0_1px_rgb(255_106_61/0.3)]",
  cold: "bg-bone/10 text-bone/80 shadow-[inset_0_0_0_1px_rgb(236_233_226/0.15)]",
  dead: "bg-ash/10 text-ash shadow-[inset_0_0_0_1px_rgb(139_139_149/0.18)]",
  plain: "bg-flame/10 text-bone/80 shadow-[inset_0_0_0_1px_rgb(255_46_46/0.2)]",
};

const PRIORITY_CHEVRONS: Record<IncidentPriority, number> = {
  P1: 3,
  P2: 2,
  P3: 1,
  P4: 0,
};

/** Stacked severity chevrons + grade — P1 burns triple-hot, P4 is routine. */
export function PriorityMark({
  priority,
  className,
}: {
  priority: IncidentPriority;
  className?: string;
}) {
  const text = toneTextClass(statusTone(priority));
  const chevrons = PRIORITY_CHEVRONS[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="flex flex-col items-center -space-y-[5px]">
        {chevrons === 0 ? (
          <Minus
            aria-hidden
            strokeWidth={3}
            className={cn("h-3 w-3", text)}
          />
        ) : (
          Array.from({ length: chevrons }, (_, i) => (
            <ChevronUp
              key={i}
              aria-hidden
              strokeWidth={3}
              className={cn(
                "h-2.5 w-2.5",
                text,
                priority === "P1" &&
                  "drop-shadow-[0_0_4px_rgb(255_46_46/0.8)]",
              )}
            />
          ))
        )}
      </span>
      <span
        className={cn(
          "font-display text-[11px] font-black tracking-[0.12em]",
          text,
        )}
      >
        {priority}
      </span>
    </span>
  );
}

/** Lifecycle state as glyph + lamp + label — never a bare word. */
export function StatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status] ?? STATUS_ICON_FALLBACK;
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "clip-tag inline-flex items-center gap-1.5 px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.18em] [--chamfer:4px]",
        CHIP_TONE[tone],
        className,
      )}
    >
      <Led
        tone={toneToLed(tone)}
        pulse={status === "active"}
        size="sm"
      />
      <Icon aria-hidden strokeWidth={2.25} className="h-3 w-3" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

/** Boxed glyph used as a section/icon anchor throughout the record. */
export function GlyphTile({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg"
      ? "h-14 w-14"
      : size === "sm"
        ? "h-5 w-5"
        : "h-8 w-8";
  const glyph =
    size === "lg" ? "h-7 w-7" : size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-flame/25 bg-wine/40 shadow-[inset_0_0_14px_rgb(255_46_46/0.1)]",
        box,
        className,
      )}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn("text-flame", glyph)}
      />
    </span>
  );
}

/** Bare-icon section header — glyph + label + count over a fading rail. */
export function SectionHead({
  icon: Icon,
  label,
  count,
  right,
  className,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Icon
        aria-hidden
        strokeWidth={2}
        className="h-3.5 w-3.5 shrink-0 text-flame/80"
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        {label}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[9px] tracking-[0.2em] text-flame/80">
          [{count}]
        </span>
      )}
      <span
        aria-hidden
        className="h-px flex-1 bg-gradient-to-r from-flame/40 via-flame/15 to-transparent"
      />
      {right}
    </div>
  );
}

/** Icon-labelled readout cell for the hero meta grid. */
export function MetaCell({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("bg-coal/95 px-3 py-2.5", className)}>
      <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.28em] text-ash">
        <Icon aria-hidden className="h-3 w-3 text-flame/70" />
        {label}
      </div>
      <div className="mt-1 font-mono text-[11px] tracking-wider text-bone/85">
        {children}
      </div>
    </div>
  );
}
