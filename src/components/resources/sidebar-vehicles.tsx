"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { Led, Skeleton } from "@/components/ui";
import { fmtClock, type Incident, type Vehicle } from "@/lib/api";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import type { Feed } from "./sidebar";
import { DockCell, fmtFree, InspectorDock } from "./rows";
import { STATUS_SHORT, TYPE_ICON } from "./vehicle-shared";
import { VehicleGauges } from "./vehicle-gauges";

/** Dock idle summary groups. */
const GROUPS: { label: string; statuses: Vehicle["status"][] }[] = [
  { label: "committed", statuses: ["dispatched", "en_route", "on_scene"] },
  { label: "ready", statuses: ["available"] },
  { label: "returning", statuses: ["returning", "refuel"] },
  { label: "oos", statuses: ["out_of_service"] },
];

function VehicleInspector({
  v,
  all,
}: {
  v: Vehicle | null;
  all: Vehicle[] | null;
}) {
  const Icon = v === null ? Truck : TYPE_ICON[v.type];
  return (
    <InspectorDock
      title={v === null ? null : `${v.callsign} — ${v.name}`}
      icon={<Icon className="h-3.5 w-3.5 text-flame" />}
      idle={
        all !== null && (
          <>
            {GROUPS.map((g) => {
              const n = all.filter((x) => g.statuses.includes(x.status)).length;
              return n > 0 ? (
                <span key={g.label}>
                  <span className="text-bone/70">{n}</span> {g.label}
                </span>
              ) : null;
            })}
          </>
        )
      }
    >
      {v !== null && (
        <>
          <DockCell label="Task">
            {STATUS_SHORT[v.status]}
            {v.incident_id !== null && ` · ${v.incident_id}`}
          </DockCell>
          <DockCell label="Free">
            {v.free_at !== null
              ? `${fmtFree(v.free_at)} · ${fmtClock(v.free_at)}`
              : "—"}
          </DockCell>
          <DockCell label="Speed">
            {v.speed_kmh > 0 ? `${Math.round(v.speed_kmh)} km/h` : "parked"}
          </DockCell>
          <DockCell label="Fuel / water">
            {Math.round(v.fuel_pct)}% · {Math.round(v.water_pct)}%
          </DockCell>
        </>
      )}
    </InspectorDock>
  );
}

/**
 * The fleet manifest — every unit drawn as an apparatus silhouette
 * whose interior fill is the fuel level. Hover docks detail, click
 * opens the unit record.
 */
export function VehiclesList({
  feed,
  incidents,
  station,
}: {
  feed: Feed<Vehicle>;
  incidents: Incident[];
  station: { lat: number; lng: number } | null;
}) {
  const { data, error, loading } = feed;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Vehicle | null>(null);

  let body;
  if (data === null && loading) {
    body = (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (data === null) {
    body = (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Fleet feed down"}
        </span>
      </div>
    );
  } else {
    body = (
      <VehicleGauges
        vehicles={data}
        incidents={incidents}
        station={station}
        onSelect={setSelected}
        onHover={setInspected}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">{body}</div>
      <VehicleInspector v={inspected} all={data} />
      {selected && (
        <VehicleDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
