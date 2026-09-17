"use client";

import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui";
import { statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtFree, IconChip, RowMeta, TONE_TEXT } from "./rows";
import { placeOf, STATUS_SHORT, TYPE_ICON } from "./vehicle-shared";

type Marker = "node" | "joint" | "hollow" | "dead" | null;

/**
 * One rail cell — draws the line segments, junction stub and stop
 * marker for its row. Solid = live spine, dashed ash = dead spur.
 */
function Rail({
  up = false,
  down = false,
  stub = false,
  marker = null,
  dead = false,
}: {
  up?: boolean;
  down?: boolean;
  stub?: boolean;
  marker?: Marker;
  dead?: boolean;
}) {
  const line = dead ? "border-dashed border-ash/25" : "border-flame/30";
  return (
    <span aria-hidden className="relative flex w-5 shrink-0 self-stretch">
      {up && (
        <span
          className={cn(
            "absolute left-1/2 top-0 h-1/2 -translate-x-px border-l-2",
            line,
          )}
        />
      )}
      {down && (
        <span
          className={cn(
            "absolute bottom-0 left-1/2 h-1/2 -translate-x-px border-l-2",
            line,
          )}
        />
      )}
      {marker === "node" && (
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-flame" />
      )}
      {marker === "joint" && (
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-flame/70 bg-ink" />
      )}
      {marker === "hollow" && (
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ash/50" />
      )}
      {marker === "dead" && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[11px] leading-none text-ash/60">
          ×
        </span>
      )}
      {stub && (
        <span
          className={cn(
            "absolute left-1/2 right-0 top-1/2 border-t-2",
            dead ? "border-dashed border-ash/30" : "border-flame/30",
          )}
        />
      )}
    </span>
  );
}

function SpineRow({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-stretch">
      {rail}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Small callsign chip — home units parked at a node, or spur entries. */
function CallsignChip({
  v,
  dim = false,
  onSelect,
  onHover,
}: {
  v: Vehicle;
  dim?: boolean;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(v.id)}
      onMouseEnter={() => onHover(v)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(v)}
      onBlur={() => onHover(null)}
      className={cn(
        "cursor-pointer border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] transition-colors",
        dim
          ? "border-ash/20 text-ash/50 hover:border-ash/50 hover:text-ash"
          : "border-ash/25 text-bone/80 hover:border-flame/60 hover:text-flame",
      )}
    >
      {v.callsign}
    </button>
  );
}

/** A fixed station on the line — BAY / SCENE — with parked-unit chips. */
function NodeRow({
  label,
  vehicles,
  rail,
  onSelect,
  onHover,
}: {
  label: string;
  vehicles: Vehicle[];
  rail: ReactNode;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  return (
    <SpineRow rail={rail}>
      <div className="flex flex-wrap items-center gap-1.5 px-1 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-flame/90">
          {label}
        </span>
        {vehicles.length === 0 ? (
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ash/40">
            empty
          </span>
        ) : (
          vehicles.map((v) => (
            <CallsignChip
              key={v.id}
              v={v}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))
        )}
      </div>
    </SpineRow>
  );
}

/** A dead spur off the line — RETURN / OOS — dashed connectors. */
function SpurRow({
  label,
  vehicles,
  marker,
  onSelect,
  onHover,
}: {
  label: string;
  vehicles: Vehicle[];
  marker: Marker;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  return (
    <SpineRow rail={<Rail up dead stub marker={marker} />}>
      <div className="flex flex-wrap items-center gap-1.5 px-1 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash/60">
          {label}
        </span>
        {vehicles.map((v) => (
          <CallsignChip
            key={v.id}
            v={v}
            dim
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </SpineRow>
  );
}

/** A rolling unit — junction stop on the spine with the full entry. */
function EntryRow({
  v,
  onSelect,
  onHover,
}: {
  v: Vehicle;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const tone: BadgeTone = statusTone(v.status);
  const Icon = TYPE_ICON[v.type];
  return (
    <SpineRow rail={<Rail up down stub marker="joint" />}>
      <button
        type="button"
        onClick={() => onSelect(v.id)}
        onMouseEnter={() => onHover(v)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(v)}
        onBlur={() => onHover(null)}
        className="flex w-full cursor-pointer items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-flame/5 focus-visible:outline-none focus-visible:bg-flame/10"
      >
        <IconChip tone={tone}>
          <Icon className="h-4 w-4" />
        </IconChip>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-bone">
            {v.callsign}
          </span>
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
            {v.type} · {placeOf(v)}
            {v.speed_kmh > 5 && ` · ${Math.round(v.speed_kmh)} km/h`}
          </span>
        </span>
        <RowMeta
          top={STATUS_SHORT[v.status]}
          topClassName={TONE_TEXT[tone]}
          bottom={v.free_at !== null ? `free ${fmtFree(v.free_at)}` : ""}
        />
      </button>
    </SpineRow>
  );
}

const byCallsign = (a: Vehicle, b: Vehicle) =>
  a.callsign.localeCompare(b.callsign);

/**
 * The dispatch spine — the fleet as a transit map. BAY node on top,
 * SCENE node at the bottom, rolling units as junction stops, returning
 * and dead units hanging off dashed spurs. Status is position.
 */
export function VehicleSpine({
  vehicles,
  onSelect,
  onHover,
}: {
  vehicles: Vehicle[];
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const bay = vehicles
    .filter((v) => v.status === "available" || v.status === "refuel")
    .sort(byCallsign);
  const rolling = vehicles
    .filter((v) => v.status === "dispatched" || v.status === "en_route")
    .sort(
      (a, b) =>
        (a.status === "dispatched" ? 0 : 1) -
          (b.status === "dispatched" ? 0 : 1) || byCallsign(a, b),
    );
  const scene = vehicles
    .filter((v) => v.status === "on_scene")
    .sort(byCallsign);
  const returning = vehicles
    .filter((v) => v.status === "returning")
    .sort(byCallsign);
  const dead = vehicles
    .filter((v) => v.status === "out_of_service")
    .sort(byCallsign);

  const hasSpurs = returning.length > 0 || dead.length > 0;

  return (
    <div className="px-3 pb-1 pt-2">
      <NodeRow
        label="bay"
        vehicles={bay}
        rail={<Rail down marker="node" />}
        onSelect={onSelect}
        onHover={onHover}
      />
      {rolling.map((v) => (
        <EntryRow key={v.id} v={v} onSelect={onSelect} onHover={onHover} />
      ))}
      <NodeRow
        label="scene"
        vehicles={scene}
        rail={
          <Rail up down={hasSpurs} dead={hasSpurs} marker="node" />
        }
        onSelect={onSelect}
        onHover={onHover}
      />
      {returning.length > 0 && (
        <SpurRow
          label="return"
          vehicles={returning}
          marker="hollow"
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
      {dead.length > 0 && (
        <SpurRow
          label="oos"
          vehicles={dead}
          marker="dead"
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
    </div>
  );
}
