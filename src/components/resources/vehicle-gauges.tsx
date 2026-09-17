"use client";

import { useId } from "react";
import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle, type VehicleType } from "@/lib/api";
import { fmtFree, Row, RowMeta, TONE_TEXT } from "./rows";
import { placeOf, STATUS_SHORT } from "./vehicle-shared";

/** Body outline per apparatus type — 72×26 viewBox, cab on the right. */
const BODY: Record<VehicleType, string> = {
  pumper: "M5 8 H50 V4 H58 L66 9 V19 H5 Z",
  tender: "M5 9 Q5 4 11 4 H52 V6 H58 L66 10 V19 H5 Z",
  ladder: "M5 8 H50 V4 H58 L66 9 V19 H5 Z",
  ambulance: "M5 4 H66 V19 H5 Z",
  rescue: "M5 8 H50 V4 H58 L66 9 V19 H5 Z",
  hazmat: "M5 8 H50 V4 H58 L66 9 V19 H5 Z",
  command: "M12 7 H62 V19 H12 Z",
  special: "M5 8 H50 V4 H58 L66 9 V19 H5 Z",
};

/** Type accents — ladder rack, hazmat triangle, command antenna… */
const ACCENT: Partial<Record<VehicleType, string>> = {
  ladder: "M10 2 H44",
  rescue: "M14 4 H30",
  hazmat: "M20 13 L24 7 L28 13 Z",
  command: "M56 7 V2",
};

const WHEELS = [13, 26, 48, 62];

const SVG_TONE: Record<
  BadgeTone,
  { stroke: string; fill: string; strokeOpacity?: number; fillOpacity: number }
> = {
  hot: { stroke: "stroke-flame", fill: "fill-flame", fillOpacity: 0.7 },
  warm: { stroke: "stroke-blaze", fill: "fill-blaze", fillOpacity: 0.55 },
  cold: {
    stroke: "stroke-bone",
    fill: "fill-bone",
    strokeOpacity: 0.7,
    fillOpacity: 0.35,
  },
  dead: {
    stroke: "stroke-ash",
    fill: "fill-ash",
    strokeOpacity: 0.45,
    fillOpacity: 0.15,
  },
  plain: {
    stroke: "stroke-flame",
    fill: "fill-flame",
    strokeOpacity: 0.85,
    fillOpacity: 0.5,
  },
};

/**
 * The vehicle as its own gauge — a stroked apparatus silhouette whose
 * interior fill height IS the fuel level. Rolling units get a dashed
 * outline (in motion), dead units go thin and grey.
 */
function Silhouette({ v }: { v: Vehicle }) {
  const clip = useId();
  const tone = statusTone(v.status);
  const s = SVG_TONE[tone];
  const rolling =
    v.status === "en_route" ||
    v.status === "dispatched" ||
    v.status === "returning";
  const dead = v.status === "out_of_service";
  const h = (14 * Math.max(0, Math.min(100, v.fuel_pct))) / 100;
  return (
    <svg viewBox="0 0 72 26" className="h-8 w-[76px] shrink-0" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={BODY[v.type]} />
        </clipPath>
      </defs>
      <rect
        x="4"
        y={19 - h}
        width="64"
        height={h}
        clipPath={`url(#${clip})`}
        fillOpacity={s.fillOpacity}
        className={s.fill}
      />
      <path
        d={BODY[v.type]}
        fill="none"
        strokeWidth="1.5"
        strokeOpacity={s.strokeOpacity}
        strokeDasharray={dead ? "2 3" : rolling ? "5 3" : undefined}
        className={s.stroke}
      />
      {ACCENT[v.type] && (
        <path
          d={ACCENT[v.type]}
          fill="none"
          strokeWidth="1.2"
          strokeOpacity={s.strokeOpacity}
          className={s.stroke}
        />
      )}
      {WHEELS.map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy="21.5"
          r="2.4"
          fill="none"
          strokeWidth="1.3"
          strokeOpacity={s.strokeOpacity}
          className={s.stroke}
        />
      ))}
    </svg>
  );
}

const STATUS_RANK: Record<Vehicle["status"], number> = {
  on_scene: 0,
  en_route: 1,
  dispatched: 2,
  available: 3,
  returning: 4,
  refuel: 5,
  out_of_service: 6,
};

/** Fleet as a column of silhouette gauges — fill level reads fuel. */
export function VehicleGauges({
  vehicles,
  onSelect,
  onHover,
}: {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const sorted = [...vehicles].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.callsign.localeCompare(b.callsign),
  );

  return (
    <div>
      {sorted.map((v) => {
        const tone = statusTone(v.status);
        return (
          <Row
            key={v.id}
            onClick={() => onSelect(v.id)}
            onHover={(hov) => onHover(hov ? v : null)}
            dimmed={v.status === "out_of_service"}
          >
            <Silhouette v={v} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-bone">
                {v.callsign}
              </span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
                {v.type} · {placeOf(v)}
              </span>
            </span>
            <RowMeta
              top={STATUS_SHORT[v.status]}
              topClassName={TONE_TEXT[tone]}
              bottom={v.free_at !== null ? `free ${fmtFree(v.free_at)}` : ""}
            />
          </Row>
        );
      })}
    </div>
  );
}
