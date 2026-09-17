"use client";

import { MoveRight, Undo2 } from "lucide-react";
import { statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TONE_TEXT } from "./rows";
import { isHome, TYPE_ICON } from "./vehicle-shared";

/** One parking stall on the bay floor. */
function Stall({
  v,
  onSelect,
  onHover,
}: {
  v: Vehicle;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const tone = statusTone(v.status);
  const Icon = TYPE_ICON[v.type];
  const home = isHome(v);
  const dead = v.status === "out_of_service";
  return (
    <button
      type="button"
      onClick={() => onSelect(v.id)}
      onMouseEnter={() => onHover(v)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(v)}
      onBlur={() => onHover(null)}
      className={cn(
        "flex aspect-[5/3] cursor-pointer flex-col items-center justify-center gap-0.5 transition-colors",
        dead
          ? "bg-hazard-tight border border-ash/30"
          : home
            ? "border border-flame/35 bg-smoke/70 hover:border-flame/70"
            : "border border-dashed border-ash/25 hover:border-ash/50",
      )}
    >
      {dead ? (
        <>
          <Icon className="h-4 w-4 text-ash/60" />
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ash/70">
            {v.callsign}
          </span>
        </>
      ) : home ? (
        <>
          <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} />
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-bone/85">
            {v.callsign}
          </span>
        </>
      ) : (
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ash/40">
          {v.callsign}
        </span>
      )}
    </button>
  );
}

/**
 * Apparatus bay — top-down floor plan of the station garage. Parked
 * units fill their stalls; committed units leave hollow stalls and
 * roll down the exit lane toward their incident. Dead units get the
 * hazard hatched stall.
 */
export function VehicleBay({
  vehicles,
  onSelect,
  onHover,
}: {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const sorted = [...vehicles].sort((a, b) =>
    a.callsign.localeCompare(b.callsign),
  );
  const rolling = sorted.filter((v) => !isHome(v));
  const homeCount = sorted.length - rolling.length;

  return (
    <div className="p-3">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
        <span>{vehicles[0]?.station_id ?? "—"} apparatus bay</span>
        <span>
          {homeCount}/{sorted.length} home
        </span>
      </div>

      {/* bay floor — one stall per unit, forever */}
      <div className="border border-flame/20 bg-ink/50 p-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          {sorted.map((v) => (
            <Stall key={v.id} v={v} onSelect={onSelect} onHover={onHover} />
          ))}
        </div>
      </div>

      {/* exit lane — everything out on the road */}
      <div className="border border-t-0 border-dashed border-ash/25 bg-ink/30 px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {rolling.length === 0 ? (
            <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash/40">
              lane clear — all units home
            </span>
          ) : (
            rolling.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                onMouseEnter={() => onHover(v)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(v)}
                onBlur={() => onHover(null)}
                className="flex cursor-pointer items-center gap-1 border border-flame/35 bg-wine/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bone/85 transition-colors hover:border-flame/70 hover:text-flame"
              >
                {v.callsign}
                {v.status === "returning" ? (
                  <Undo2 className="h-3 w-3 text-blaze" />
                ) : (
                  <MoveRight className="h-3 w-3 text-flame" />
                )}
                {v.incident_id ?? v.status.replace("_", " ")}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
