"use client";

import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";

const Z = 13;
const SIZE = 44;

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
 * Smartwatch-style minimap — a bezel-ringed circle of offline tiles
 * centered on the unit, a status dot at center, and a compass needle
 * pointing where it's heading (incident when rolling, station when
 * returning). Parked units show no needle.
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
  const half = SIZE / 2;

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
    <span className="relative block h-11 w-11 shrink-0" aria-hidden>
      {/* bezel + clipped tile disc */}
      <span className="absolute inset-0 block overflow-hidden rounded-full border border-ash/30 bg-ink">
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

      {/* heading needle — rotates around the center point */}
      {bearing !== null && (
        <span
          className="absolute left-1/2 top-1/2 block h-0 w-0"
          style={{ transform: `rotate(${bearing}deg)` }}
        >
          <span className="absolute bottom-0 left-1/2 block h-[13px] w-[2px] -translate-x-1/2 bg-flame" />
          <span className="absolute -top-[17px] left-1/2 block h-0 w-0 -translate-x-1/2 border-x-[3px] border-b-[5px] border-x-transparent border-b-flame" />
        </span>
      )}

      {/* unit marker */}
      <span
        className={cn(
          "absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45",
          CENTER_DOT[tone],
        )}
      />
    </span>
  );
}
