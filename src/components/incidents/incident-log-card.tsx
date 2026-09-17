import {
  ChevronRight,
  Clock,
  Droplets,
  MapPin,
  Phone,
  Thermometer,
  Truck,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Led, type BadgeTone } from "@/components/ui";
import {
  fmtAgo,
  statusTone,
  type Incident,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_ICONS,
  classificationKey,
  toneToLed,
} from "./incident-icons";
import { PriorityMark, StatusChip } from "./marks";

/* chamfered frame + left rail, tinted by priority tone */
const FRAME: Record<BadgeTone, string> = {
  hot: "bg-gradient-to-b from-flame/80 via-flame/35 to-blood/70",
  warm: "bg-gradient-to-b from-blaze/55 via-flame/25 to-blood/45",
  cold: "bg-gradient-to-b from-bone/25 via-ash/15 to-ash/20",
  dead: "bg-ash/15",
  plain: "bg-flame/40",
};

const RAIL: Record<BadgeTone, string> = {
  hot: "bg-gradient-to-b from-flame via-flame to-blood shadow-[4px_0_14px_-4px_rgb(255_46_46/0.7)]",
  warm: "bg-gradient-to-b from-blaze to-blood",
  cold: "bg-gradient-to-b from-bone/60 to-ash/30",
  dead: "bg-gradient-to-b from-ash/40 to-ash/15",
  plain: "bg-gradient-to-b from-flame/60 to-blood/50",
};

function CardMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden className="h-3 w-3 text-flame/70" strokeWidth={2} />
      <span className="font-mono text-[10px] tracking-[0.12em] text-bone/75">
        {value}
      </span>
      {label !== undefined && (
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ash/70">
          {label}
        </span>
      )}
    </span>
  );
}

/**
 * Dense dispatch-log card for the incidents page — icon-led, priority-railed.
 * Renders the full API `Incident` so live metrics (calls/units/weather) come
 * straight from the record. The outer page wrapper owns selection chrome.
 */
export function IncidentLogCard({
  incident,
  selected = false,
  className,
}: {
  incident: Incident;
  selected?: boolean;
  className?: string;
}) {
  const pTone = statusTone(incident.priority);
  const sTone = statusTone(incident.status);
  const ClassIcon =
    CLASSIFICATION_ICONS[classificationKey(incident.classification)];
  const wind = [incident.wind, incident.wind_dir]
    .filter((s) => s && s.trim())
    .join(" ");

  return (
    <div
      className={cn("clip-chamfer [--chamfer:14px]", FRAME[pTone], className)}
    >
      <div className="clip-chamfer relative m-px overflow-hidden bg-coal [--chamfer:13px]">
        {/* classification watermark */}
        <ClassIcon
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 text-flame/[0.06]"
        />
        <div className="relative flex items-stretch">
          {/* priority rail */}
          <span aria-hidden className={cn("w-[5px] shrink-0", RAIL[pTone])} />

          <div className="min-w-0 flex-1 px-3.5 pb-3 pt-2.5">
            {/* header — id, lamp, age */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                <Led
                  tone={toneToLed(sTone)}
                  pulse={incident.status === "active"}
                  size="sm"
                />
                <span className="truncate text-bone/60">{incident.id}</span>
                <span aria-hidden className="text-ash/40">
                  {"//"}
                </span>
                <Clock aria-hidden className="h-3 w-3 shrink-0 text-ash/70" />
                <span className="whitespace-nowrap">
                  {fmtAgo(incident.reported_at)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusChip status={incident.status} />
                <PriorityMark priority={incident.priority} />
              </div>
            </div>

            {/* hero — glyph tile, classification, address */}
            <div className="mt-2.5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-flame/25 bg-wine/50 shadow-[inset_0_0_14px_rgb(255_46_46/0.12)]">
                <ClassIcon
                  aria-hidden
                  strokeWidth={1.75}
                  className="h-5 w-5 text-flame"
                />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-display text-sm font-bold uppercase tracking-[0.1em] text-bone">
                  {incident.classification || "Unclassified"}
                </h4>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-bone/60">
                  <MapPin
                    aria-hidden
                    className="h-3 w-3 shrink-0 text-flame/70"
                  />
                  <span className="truncate">{incident.address || "—"}</span>
                </p>
              </div>
              {selected && (
                <ChevronRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 animate-pulse text-flame"
                />
              )}
            </div>

            {/* metric strip — calls, units, on-scene weather */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-flame/10 pt-2.5">
              {incident.call_count !== undefined && (
                <CardMetric
                  icon={Phone}
                  value={String(incident.call_count)}
                  label={incident.call_count === 1 ? "call" : "calls"}
                />
              )}
              {incident.unit_count !== undefined && (
                <CardMetric
                  icon={Truck}
                  value={String(incident.unit_count)}
                  label={incident.unit_count === 1 ? "unit" : "units"}
                />
              )}
              <span
                aria-hidden
                className="hidden h-3 w-px bg-flame/15 sm:block"
              />
              <CardMetric icon={Wind} value={wind || "—"} />
              <CardMetric
                icon={Thermometer}
                value={
                  incident.temp_c != null
                    ? `${Math.round(incident.temp_c)}°C`
                    : "—"
                }
              />
              <CardMetric
                icon={Droplets}
                value={
                  incident.humidity_pct != null
                    ? `${Math.round(incident.humidity_pct)}%`
                    : "—"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
