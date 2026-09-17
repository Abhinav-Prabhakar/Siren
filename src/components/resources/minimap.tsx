"use client";

import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";

const BIG = 176; // expanded disc diameter — everything renders at this size
const RING = 16; // compass band width around the disc
const BOX = BIG + RING * 2;
const DOCK = 0.3; // docked scale — band reads as a thin ring when small
const Z = 14;

const CENTER_DOT: Record<BadgeTone, string> = {
  hot: "bg-flame shadow-[0_0_5px_1px_rgb(255_46_46/0.8)]",
  warm: "bg-blaze",
  cold: "bg-bone/60",
  dead: "bg-ash/40",
  plain: "bg-flame/80",
};

/** WGS84 → slippy pixel coords at zoom Z. */
function tileXY(lat: number, lng: number): { x: number; y: number } {
  const n = 2 ** Z;
  const x = ((lng + 180) / 360) * n * 256;
  const r = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256;
  return { x, y };
}

/** Initial bearing from → to, degrees clockwise from north. */
function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Compass band ringing the tile disc — tick marks, cardinal letters and
 * a flame caret at the unit's heading (bearing to its target). Fixed
 * north-up, matching the tiles underneath.
 */
function Compass({ bearing, size }: { bearing: number | null; size: number }) {
  const c = size / 2;
  const rim = c - 1;
  const marks: ReactNode[] = [];
  for (let d = 0; d < 360; d += 15) {
    if (d % 90 === 0) continue; // cardinals get letters, not ticks
    const a = ((d - 90) * Math.PI) / 180;
    const r1 = rim - (d % 45 === 0 ? 7 : 4);
    marks.push(
      <line
        key={d}
        x1={c + rim * Math.cos(a)}
        y1={c + rim * Math.sin(a)}
        x2={c + r1 * Math.cos(a)}
        y2={c + r1 * Math.sin(a)}
        strokeWidth={d % 45 === 0 ? 1 : 0.6}
        className={d % 45 === 0 ? "stroke-bone/60" : "stroke-ash/50"}
      />,
    );
  }
  const lr = rim - 8;
  return (
    <svg width={size} height={size} className="absolute inset-0 block">
      {/* bezel fill so the band reads over whatever it overlaps */}
      <circle
        cx={c}
        cy={c}
        r={rim + 0.5}
        fill="var(--color-coal)"
        fillOpacity={0.95}
      />
      <circle
        cx={c}
        cy={c}
        r={rim}
        fill="none"
        strokeWidth={0.8}
        className="stroke-ash/30"
      />
      {marks}
      {(["N", "E", "S", "W"] as const).map((L, i) => {
        const a = ((i * 90 - 90) * Math.PI) / 180;
        return (
          <text
            key={L}
            x={c + lr * Math.cos(a)}
            y={c + lr * Math.sin(a)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9.5}
            className="fill-bone/80 font-mono"
          >
            {L}
          </text>
        );
      })}
      {bearing !== null && (
        <g transform={`rotate(${bearing} ${c} ${c})`}>
          <path
            d={`M${c} 0.5 L${c + 4} 9 L${c - 4} 9 Z`}
            className="fill-flame"
            style={{ filter: "drop-shadow(0 0 3px rgb(255 46 46 / 0.9))" }}
          />
        </g>
      )}
    </svg>
  );
}

/**
 * Smartwatch minimap — a compass-ringed circle of offline tiles centered
 * on the unit, status pip at center, heading caret on the band pointing
 * where it's going (incident when rolling, station when returning).
 * Rendered once at full size; the docked state is just a CSS scale-down,
 * so hover grows it smoothly with no re-render.
 */
export function Minimap({
  v,
  target,
}: {
  v: Vehicle;
  target: { lat: number; lng: number } | null;
}) {
  const tone = statusTone(v.status);
  const { x, y } = tileXY(v.lat, v.lng);
  const half = BIG / 2;

  const tiles: { tx: number; ty: number }[] = [];
  for (
    let tx = Math.floor((x - half) / 256);
    tx <= Math.floor((x + half) / 256);
    tx++
  ) {
    for (
      let ty = Math.floor((y - half) / 256);
      ty <= Math.floor((y + half) / 256);
      ty++
    ) {
      tiles.push({ tx, ty });
    }
  }

  const bearing =
    target !== null ? bearingDeg(v.lat, v.lng, target.lat, target.lng) : null;

  return (
    <span
      className="relative block shrink-0"
      style={{ width: BOX * DOCK, height: BOX * DOCK }}
      aria-hidden
    >
      {/* anchored bottom-right so it swells over the dialog, not the layout */}
      <span
        className="absolute bottom-0 right-0 z-20 block origin-bottom-right scale-[0.3] transition-transform duration-200 ease-out hover:scale-100"
        style={{ width: BOX, height: BOX }}
      >
        <Compass bearing={bearing} size={BOX} />

        {/* clipped tile disc inside the band */}
        <span
          className="absolute block overflow-hidden rounded-full border border-ash/30 bg-ink"
          style={{ inset: RING }}
        >
          <span
            className="absolute inset-0 block"
            style={{
              filter:
                "invert(0.92) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.35)",
            }}
          >
            {tiles.map(({ tx, ty }) => (
              <span
                key={`${tx}-${ty}`}
                className="absolute block h-64 w-64"
                style={{
                  left: tx * 256 - x + half,
                  top: ty * 256 - y + half,
                  backgroundImage: `url(/map/hyderabad/${Z}/${tx}/${ty}.png)`,
                }}
              />
            ))}
          </span>
          {/* vignette */}
          <span className="absolute inset-0 block rounded-full shadow-[inset_0_0_10px_4px_rgb(6_6_7/0.9)]" />
        </span>

        {/* unit pip */}
        <span
          className={cn(
            "absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45",
            CENTER_DOT[tone],
          )}
        />
      </span>
    </span>
  );
}
