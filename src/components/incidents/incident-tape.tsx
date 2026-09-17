import {
  Droplets,
  MapPin,
  Navigation,
  Phone,
  Thermometer,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Led, windDeg, type BadgeTone } from "@/components/ui";
import {
  fmtElapsed,
  statusTone,
  type Incident,
  type IncidentPriority,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_ICONS,
  classificationKey,
  toneToLed,
} from "./incident-icons";
import { StatusChip } from "./marks";

/* severity meter — bars lit left→right, count + colour by priority grade */
const PRIORITY_BARS: Record<IncidentPriority, { lit: number; cls: string }> = {
  P1: { lit: 4, cls: "bg-flame shadow-[0_0_6px_rgb(255_46_46/0.75)]" },
  P2: { lit: 3, cls: "bg-blaze" },
  P3: { lit: 2, cls: "bg-bone/55" },
  P4: { lit: 1, cls: "bg-ash/50" },
};

const GLYPH_TONE: Record<BadgeTone, string> = {
  hot: "border-flame/30 bg-wine/60 text-flame shadow-[inset_0_0_14px_rgb(255_46_46/0.14)]",
  warm: "border-blaze/25 bg-smoke/70 text-blaze",
  cold: "border-bone/15 bg-smoke/60 text-bone/70",
  dead: "border-ash/15 bg-smoke/50 text-ash/60",
  plain: "border-flame/25 bg-wine/50 text-flame",
};

function IconCount({ icon: Icon, n }: { icon: LucideIcon; n: number }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-bone/70">
      <Icon aria-hidden className="h-3 w-3 text-flame/70" strokeWidth={2} />
      {n}
    </span>
  );
}

/**
 * The incident log as ticker tape — hairline rows, not cards. Each row is a
 * scan of one incident: severity bars, classification glyph, T+ mission
 * clock, and a compact instrument cluster (calls, units, wind vector, wx).
 * Status does the visual work: active rows glow and pulse, resolved rows
 * sink to half-dim. Clicking a row arms the detail record.
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
        const sev = PRIORITY_BARS[inc.priority];
        const selected = selectedId === inc.id;
        const active = inc.status === "active";
        const closed = inc.status === "resolved";
        const deg = windDeg(inc.wind_dir);

        return (
          <button
            key={inc.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(inc.id)}
            className={cn(
              "flex w-full cursor-pointer items-stretch gap-3.5 border-b border-flame/10 px-4 py-3 text-left transition-colors last:border-b-0",
              "hover:bg-wine/25 focus-visible:bg-wine/25 focus-visible:outline-none",
              selected && "bg-wine/35 shadow-[inset_2px_0_0_var(--color-flame)]",
              !selected && active && "bg-wine/10",
            )}
          >
            {/* severity meter — four ascending bars, lit by grade */}
            <span
              aria-hidden
              title={inc.priority}
              className="flex w-5 shrink-0 items-end gap-[2.5px] pb-0.5"
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

            {/* classification glyph */}
            <span
              aria-hidden
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center border",
                GLYPH_TONE[pTone],
                closed && "opacity-70",
              )}
            >
              <ClassIcon strokeWidth={1.5} className="h-[22px] w-[22px]" />
            </span>

            {/* identity — id, classification, address */}
            <span className={cn("min-w-0 flex-1", closed && "opacity-55")}>
              <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ash">
                <Led
                  tone={toneToLed(sTone)}
                  pulse={active}
                  size="sm"
                />
                <span className="truncate text-bone/55">{inc.id}</span>
                <span aria-hidden className="text-ash/40">
                  {"//"}
                </span>
                <span className="whitespace-nowrap text-flame/80">
                  {inc.priority}
                </span>
              </span>
              <span className="mt-1 block truncate font-display text-sm font-bold uppercase leading-tight tracking-[0.1em] text-bone">
                {inc.classification || "Unclassified"}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-bone/55">
                <MapPin
                  aria-hidden
                  className="h-3 w-3 shrink-0 text-flame/60"
                />
                <span className="truncate">{inc.address || "—"}</span>
              </span>
            </span>

            {/* instrument cluster — clock, status, live metrics */}
            <span className="flex shrink-0 flex-col items-end justify-between gap-1.5 text-right">
              <span className="flex items-center gap-2.5">
                <StatusChip status={inc.status} />
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
              <span className="flex items-center gap-3">
                {inc.call_count !== undefined && (
                  <IconCount icon={Phone} n={inc.call_count} />
                )}
                {inc.unit_count !== undefined && (
                  <IconCount icon={Truck} n={inc.unit_count} />
                )}
                <span
                  aria-hidden
                  className="h-3 w-px bg-flame/15"
                />
                <span
                  className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-bone/70"
                  title={`wind ${inc.wind || "—"} ${inc.wind_dir || ""}`}
                >
                  <Navigation
                    aria-hidden
                    className="h-3 w-3 text-flame/70"
                    strokeWidth={2}
                    style={
                      deg !== undefined
                        ? { transform: `rotate(${deg}deg)` }
                        : undefined
                    }
                  />
                  {inc.wind || "—"}
                </span>
                <span className="hidden items-center gap-1 font-mono text-[10px] tabular-nums text-bone/70 sm:flex">
                  <Thermometer
                    aria-hidden
                    className="h-3 w-3 text-flame/70"
                  />
                  {inc.temp_c != null
                    ? `${Math.round(inc.temp_c)}°`
                    : "—"}
                </span>
                <span className="hidden items-center gap-1 font-mono text-[10px] tabular-nums text-bone/70 md:flex">
                  <Droplets
                    aria-hidden
                    className="h-3 w-3 text-flame/70"
                  />
                  {inc.humidity_pct != null
                    ? `${Math.round(inc.humidity_pct)}%`
                    : "—"}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
