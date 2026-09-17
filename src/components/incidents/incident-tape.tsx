import { MapPin } from "lucide-react";
import type { BadgeTone } from "@/components/ui";
import {
  fmtClock,
  fmtElapsed,
  statusTone,
  type Incident,
  type IncidentPriority,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_ICONS,
  classificationKey,
  STATUS_ICON_FALLBACK,
  STATUS_ICONS,
  toneTextClass,
} from "./incident-icons";

/* severity meter — bars lit left→right, count + colour by priority grade */
const PRIORITY_BARS: Record<IncidentPriority, { lit: number; cls: string }> = {
  P1: { lit: 4, cls: "bg-flame shadow-[0_0_6px_rgb(255_46_46/0.75)]" },
  P2: { lit: 3, cls: "bg-blaze" },
  P3: { lit: 2, cls: "bg-bone/55" },
  P4: { lit: 1, cls: "bg-ash/50" },
};

const GLYPH_TONE: Record<BadgeTone, string> = {
  hot: "text-flame",
  warm: "text-blaze",
  cold: "text-bone/65",
  dead: "text-ash/50",
  plain: "text-flame",
};

/**
 * The incident log as ticker tape — hairline rows, not cards. Each row is a
 * single scan line: severity bars, classification glyph, T+ mission clock.
 * Id, counts and report time ride on the row's hover title. Status does the
 * visual work: active rows glow and pulse, resolved rows sink to half-dim.
 * Clicking a row arms the detail record.
 */
export function IncidentTape({
  incidents,
  selectedId,
  onSelect,
  emptyText = "no incidents on record",
  className,
}: {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText?: string;
  className?: string;
}) {
  if (incidents.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
        {emptyText} {"//"}
      </div>
    );
  }

  return (
    <div className={className}>
      {incidents.map((inc) => {
        const pTone = statusTone(inc.priority);
        const sTone = statusTone(inc.status);
        const ClassIcon =
          CLASSIFICATION_ICONS[classificationKey(inc.classification)];
        const StatusIcon =
          STATUS_ICONS[inc.status] ?? STATUS_ICON_FALLBACK;
        const sev = PRIORITY_BARS[inc.priority];
        const selected = selectedId === inc.id;
        const active = inc.status === "active";
        const closed = inc.status === "resolved";

        return (
          <button
            key={inc.id}
            type="button"
            aria-pressed={selected}
            title={`${inc.id} // ${inc.status.replace(/_/g, " ")} // reported ${fmtClock(inc.reported_at)} // ${inc.call_count ?? 0} calls · ${inc.unit_count ?? 0} units`}
            onClick={() => onSelect(inc.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 border-b border-flame/10 px-4 py-2 text-left transition-colors last:border-b-0",
              "hover:bg-wine/25 focus-visible:bg-wine/25 focus-visible:outline-none",
              selected && "bg-wine/35 shadow-[inset_2px_0_0_var(--color-flame)]",
              !selected && active && "bg-wine/10",
            )}
          >
            {/* severity meter — four ascending bars, lit by grade */}
            <span
              aria-hidden
              title={inc.priority}
              className="flex w-5 shrink-0 items-end gap-[2.5px]"
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1",
                    i < sev.lit ? sev.cls : "bg-smoke",
                  )}
                  style={{ height: `${5 + i * 4}px` }}
                />
              ))}
            </span>

            {/* classification glyph — bare icon, tinted by severity */}
            <ClassIcon
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "h-5 w-5 shrink-0",
                GLYPH_TONE[pTone],
                closed && "opacity-60",
              )}
            />

            {/* identity — classification + address on one scan line */}
            <span
              className={cn(
                "flex min-w-0 flex-1 items-baseline gap-2",
                closed && "opacity-55",
              )}
            >
              <span className="truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-bone">
                {inc.classification || "Unclassified"}
              </span>
              <span className="flex min-w-0 items-center gap-1 truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
                <MapPin
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 text-ash/60"
                />
                <span className="truncate">{inc.address || "—"}</span>
              </span>
            </span>

            {/* state readout — status glyph + elapsed clock only */}
            <span className="flex shrink-0 items-center gap-2">
              <StatusIcon
                aria-hidden
                strokeWidth={2.25}
                className={cn(
                  "h-3.5 w-3.5",
                  toneTextClass(sTone),
                  active && "animate-pulse",
                )}
              />
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold tabular-nums tracking-[0.08em]",
                  active ? "text-flame" : "text-bone/60",
                )}
                title="elapsed since report"
              >
                {fmtElapsed(inc.reported_at)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
