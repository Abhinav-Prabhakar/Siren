"use client";

import { Panel } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAD = 14; // percent inset so markers never sit on the frame

const markerDot: Record<BadgeTone, string> = {
  hot: "bg-flame shadow-[0_0_12px_2px_rgb(255_46_46/0.8)] animate-pulse",
  warm: "bg-blaze shadow-[0_0_8px_1px_rgb(255_106_61/0.7)]",
  cold: "bg-bone/70 shadow-[0_0_6px_rgb(236_233_226/0.4)]",
  dead: "bg-ash/30",
  plain: "bg-flame/70",
};

const markerLabel: Record<BadgeTone, string> = {
  hot: "border-flame/60 bg-wine/80 text-flame",
  warm: "border-blaze/40 bg-coal/90 text-blaze",
  cold: "border-bone/25 bg-coal/90 text-bone/80",
  dead: "border-ash/20 bg-coal/90 text-ash/60",
  plain: "border-flame/30 bg-coal/90 text-bone/80",
};

/**
 * Schematic sector board — vehicle lat/lng normalized into the panel frame.
 * No map library; pure HUD.
 */
export function PositionBoard({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const lats = vehicles.map((v) => v.lat);
  const lngs = vehicles.map((v) => v.lng);
  const minLat = lats.length ? Math.min(...lats) : 0;
  const maxLat = lats.length ? Math.max(...lats) : 0;
  const minLng = lngs.length ? Math.min(...lngs) : 0;
  const maxLng = lngs.length ? Math.max(...lngs) : 0;
  const latSpan = Math.max(maxLat - minLat, 0.004);
  const lngSpan = Math.max(maxLng - minLng, 0.004);
  const station = vehicles[0]?.station_id ?? "—";

  const px = (v: Vehicle) =>
    PAD + ((v.lng - minLng) / lngSpan) * (100 - PAD * 2);
  const py = (v: Vehicle) =>
    PAD + (1 - (v.lat - minLat) / latSpan) * (100 - PAD * 2);

  return (
    <Panel
      title="Position board // sector grid"
      led="on"
      right="live gps // wgs84"
      bodyClassName="p-3"
    >
      <div className="bg-grid relative h-80 overflow-hidden border border-flame/15 bg-ink/70">
        {/* slow radar sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-spin [animation-duration:9s]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, rgb(255 46 46 / 0.10), transparent 70deg)",
          }}
        />
        {/* center crosshair */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 border-t border-flame/10"
        />
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 border-l border-flame/10"
        />
        <div
          aria-hidden
          className="bg-scanlines pointer-events-none absolute inset-0 opacity-60"
        />

        {/* frame readouts */}
        <span className="absolute left-2 top-1.5 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
          lat {maxLat.toFixed(4)}
        </span>
        <span className="absolute bottom-1.5 left-2 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
          lat {minLat.toFixed(4)}
        </span>
        <span className="absolute right-2 top-1.5 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
          lng {maxLng.toFixed(4)}
        </span>
        <span className="absolute bottom-1.5 right-2 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
          {station} {"//"} sector
        </span>

        {vehicles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
            no position telemetry //
          </div>
        )}

        {vehicles.map((v) => {
          const tone = statusTone(v.status);
          const selected = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus-visible:outline-none"
              style={{ left: `${px(v)}%`, top: `${py(v)}%` }}
              title={`${v.callsign} — ${v.status}`}
            >
              <span className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "block h-3 w-3 rotate-45 border border-ink/60 transition-transform group-hover:scale-125",
                    markerDot[tone],
                    selected && "shadow-[0_0_0_2px_var(--color-ink),0_0_0_3px_var(--color-flame)]",
                  )}
                />
                <span
                  className={cn(
                    "clip-tag border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] [--chamfer:4px]",
                    markerLabel[tone],
                    selected && "text-glow",
                  )}
                >
                  {v.callsign}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
