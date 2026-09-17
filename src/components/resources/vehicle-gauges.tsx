"use client";

import { useId } from "react";
import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle, type VehicleType } from "@/lib/api";
import { fmtFree, Row, RowMeta, TONE_TEXT } from "./rows";
import { placeOf, STATUS_SHORT } from "./vehicle-shared";

/**
 * Line-art apparatus — 96×34 viewBox, facing right. `outline` is the
 * silhouette (stroked, and clipped to for the fuel fill); `windows`,
 * `details` and `accent` layer interior linework and type-specific
 * equipment on top.
 */
interface Drawing {
  outline: string;
  windows?: string[];
  details?: string[];
  accent?: string[];
  /** wheel center-x positions (cy 26.5, r 4) */
  wheels: number[];
  /** top of the fuel-fill region; bottom is always 24 */
  fillTop: number;
}

const PUMPER_OUTLINE = "M6 10 H68 L84 16 V24 H6 Z";
const CAB_WINDOW = "M70 11.5 L79 15 V18.5 H70 Z";
const CAB_DOOR = "M68 10.5 V24";
const REAR_STEP = "M6 20 H3 V24";

const DRAWINGS: Record<VehicleType, Drawing> = {
  pumper: {
    outline: PUMPER_OUTLINE,
    windows: [CAB_WINDOW],
    details: [
      CAB_DOOR,
      "M18 10 V24",
      "M32 10 V24",
      "M46 10 V24",
      "M8 7 H54 M8 7 V10 M54 7 V10",
      REAR_STEP,
    ],
    accent: ["M60 6.5 H72 V10 H60 Z"],
    wheels: [16, 26, 76],
    fillTop: 10,
  },
  tender: {
    outline:
      "M10 8 H56 Q64 8 64 16 Q64 24 56 24 H10 Q2 24 2 16 Q2 8 10 8 Z",
    windows: ["M73 11.5 L80 15 V18.5 H73 Z"],
    details: [
      "M64 10 H72 L84 16 V24 H64 Z",
      "M22 8 V24",
      "M40 8 V24",
    ],
    accent: ["M28 5 H38 V8 H28 Z"],
    wheels: [14, 26, 50, 76],
    fillTop: 8,
  },
  ladder: {
    outline: "M4 12 H66 L84 17 V24 H4 Z",
    windows: ["M68 13.5 L77 17 V20 H68 Z"],
    details: ["M14 12 V24", "M28 12 V24", "M42 12 V24"],
    accent: [
      "M8 9 L62 4",
      "M8 11 L62 6",
      "M20 7.5 V9.7",
      "M32 6.8 V8.9",
      "M44 6 V8.1",
      "M56 5.1 V7.2",
    ],
    wheels: [14, 24, 34, 76],
    fillTop: 12,
  },
  ambulance: {
    outline: "M4 5 H70 L84 13 V24 H4 Z",
    windows: ["M71 7 L80 12 V16 H71 Z", "M10 8 H19 V14 H10 Z"],
    details: ["M66 6.5 V24", "M30 5 V24", "M84 19 H88 V24"],
    accent: ["M44 10 V18 M40 14 H48"],
    wheels: [20, 76],
    fillTop: 5,
  },
  rescue: {
    outline: PUMPER_OUTLINE,
    windows: [CAB_WINDOW],
    details: [CAB_DOOR, "M20 10 V24", "M36 10 V24", REAR_STEP],
    accent: ["M28 4 V10", "M44 6 V10", "M52 6.5 H62 V10 H52 Z"],
    wheels: [16, 30, 76],
    fillTop: 10,
  },
  hazmat: {
    outline: PUMPER_OUTLINE,
    windows: [CAB_WINDOW],
    details: [CAB_DOOR, "M16 10 V24", "M50 10 V24", REAR_STEP],
    accent: [
      "M26 13 L30 17 L26 21 L22 17 Z",
      "M40 13 L44 17 L40 21 L36 17 Z",
    ],
    wheels: [16, 30, 76],
    fillTop: 10,
  },
  command: {
    outline: "M14 15 L24 9 H40 L50 13 H62 L66 16 V24 H14 Z",
    windows: ["M26 10.5 H38 L46 14 H26 Z"],
    details: ["M40 10.5 V24", "M43 16 h2"],
    accent: ["M27 6.5 H37 V9 H27 Z", "M46 9 V5"],
    wheels: [26, 54],
    fillTop: 9,
  },
  special: {
    outline: PUMPER_OUTLINE,
    windows: [CAB_WINDOW],
    details: [CAB_DOOR, "M18 10 V24", "M32 10 V24", "M46 10 V24", REAR_STEP],
    accent: ["M60 6.5 H72 V10 H60 Z"],
    wheels: [16, 26, 76],
    fillTop: 10,
  },
};

const SVG_TONE: Record<
  BadgeTone,
  { stroke: string; fill: string; strokeOpacity?: number; fillOpacity: number }
> = {
  hot: { stroke: "stroke-flame", fill: "fill-flame", fillOpacity: 0.7 },
  warm: { stroke: "stroke-blaze", fill: "fill-blaze", fillOpacity: 0.55 },
  cold: {
    stroke: "stroke-bone",
    fill: "fill-bone",
    strokeOpacity: 0.45,
    fillOpacity: 0.25,
  },
  dead: {
    stroke: "stroke-ash",
    fill: "fill-ash",
    strokeOpacity: 0.25,
    fillOpacity: 0.1,
  },
  plain: {
    stroke: "stroke-flame",
    fill: "fill-flame",
    strokeOpacity: 0.85,
    fillOpacity: 0.5,
  },
};

/**
 * The vehicle as its own gauge — a detailed apparatus silhouette whose
 * interior fill height IS the fuel level. Rolling units get a dashed
 * outline (in motion), dead units go thin and grey.
 */
function Silhouette({ v }: { v: Vehicle }) {
  const clip = useId();
  const tone = statusTone(v.status);
  const s = SVG_TONE[tone];
  const d = DRAWINGS[v.type];
  const rolling =
    v.status === "en_route" ||
    v.status === "dispatched" ||
    v.status === "returning";
  const dead = v.status === "out_of_service";
  const h =
    ((24 - d.fillTop) * Math.max(0, Math.min(100, v.fuel_pct))) / 100;

  return (
    <svg viewBox="0 0 96 34" className="h-9 w-[86px] shrink-0" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={d.outline} />
        </clipPath>
      </defs>

      {/* fuel fill — clipped to the silhouette body */}
      <rect
        x="2"
        y={24 - h}
        width="90"
        height={h}
        clipPath={`url(#${clip})`}
        fillOpacity={s.fillOpacity}
        className={s.fill}
      />

      {/* ground line */}
      <path d="M2 31 H94" strokeWidth="0.8" className="stroke-ash/30" />

      {/* silhouette + linework */}
      <path
        d={d.outline}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity={s.strokeOpacity}
        strokeDasharray={dead ? "2 3" : rolling ? "6 3" : undefined}
        className={s.stroke}
      />
      {d.details?.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          strokeWidth="1"
          strokeOpacity={s.strokeOpacity}
          className={s.stroke}
        />
      ))}
      {d.windows?.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          strokeWidth="1.2"
          strokeOpacity={s.strokeOpacity}
          className={s.stroke}
        />
      ))}
      {d.accent?.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          strokeWidth="1.3"
          strokeOpacity={s.strokeOpacity}
          className={s.stroke}
        />
      ))}

      {/* wheels — ink-filled discs, stroked rim + hub */}
      {d.wheels.map((cx) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy="26.5"
            r="4"
            fill="var(--color-ink)"
            strokeWidth="1.4"
            strokeOpacity={s.strokeOpacity}
            className={s.stroke}
          />
          <circle
            cx={cx}
            cy="26.5"
            r="1.4"
            fill="none"
            strokeWidth="1"
            strokeOpacity={s.strokeOpacity}
            className={s.stroke}
          />
        </g>
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
