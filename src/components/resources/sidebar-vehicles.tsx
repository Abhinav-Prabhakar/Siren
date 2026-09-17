"use client";

import { useState } from "react";
import { Truck, Warehouse, Waypoints, type LucideIcon } from "lucide-react";
import { Led, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtAgo, fmtClock, type Vehicle } from "@/lib/api";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import type { Feed } from "./sidebar";
import { DockCell, fmtFree, fmtPos, InspectorDock } from "./rows";
import { STATUS_SHORT, TYPE_ICON } from "./vehicle-shared";
import { VehicleBay } from "./vehicle-bay";
import { VehicleGauges } from "./vehicle-gauges";
import { VehicleSpine } from "./vehicle-spine";

/** Dock idle summary groups — same buckets the spine uses. */
const GROUPS: { label: string; statuses: Vehicle["status"][] }[] = [
  { label: "Committed", statuses: ["dispatched", "en_route", "on_scene"] },
  { label: "Ready", statuses: ["available"] },
  { label: "Return / refuel", statuses: ["returning", "refuel"] },
  { label: "Out of service", statuses: ["out_of_service"] },
];

type FleetView = "spine" | "bay" | "gauges";

const VIEWS: { id: FleetView; Icon: LucideIcon; label: string }[] = [
  { id: "spine", Icon: Waypoints, label: "spine" },
  { id: "bay", Icon: Warehouse, label: "bay" },
  { id: "gauges", Icon: Truck, label: "gauge" },
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
          <DockCell label="Next free">
            {v.free_at !== null
              ? `${fmtFree(v.free_at)} · ${fmtClock(v.free_at)}`
              : "—"}
          </DockCell>
          <DockCell label="Position">{fmtPos(v.lat, v.lng)}</DockCell>
          <DockCell label="Speed">
            {v.speed_kmh > 0 ? `${Math.round(v.speed_kmh)} km/h` : "parked"}
          </DockCell>
          <DockCell label="Fuel / water">
            {Math.round(v.fuel_pct)}% · {Math.round(v.water_pct)}%
          </DockCell>
          <DockCell label="Battery">
            {v.battery_v.toFixed(1)}v · upd {fmtAgo(v.updated_at)}
          </DockCell>
        </>
      )}
    </InspectorDock>
  );
}

/**
 * The fleet manifest — three renderings of the same data, switched by
 * the icon row: dispatch spine (transit map), apparatus bay (floor
 * plan), silhouette gauges (vehicle-as-meter). Hover docks detail,
 * click opens the unit record.
 */
export function VehiclesList({ feed }: { feed: Feed<Vehicle> }) {
  const { data, error, loading } = feed;
  const [view, setView] = useState<FleetView>("spine");
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Vehicle | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* view switcher */}
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-flame/15 px-3 py-1.5">
        {VIEWS.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em] transition-colors",
              view === id
                ? "bg-flame/10 text-flame"
                : "text-ash hover:text-bone",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {data === null && loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data === null ? (
          <div className="flex items-center gap-3 px-4 py-6">
            <Led tone="off" size="sm" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
              {error ?? "Fleet feed down"}
            </span>
          </div>
        ) : view === "spine" ? (
          <VehicleSpine
            vehicles={data}
            onSelect={setSelected}
            onHover={setInspected}
          />
        ) : view === "bay" ? (
          <VehicleBay
            vehicles={data}
            onSelect={setSelected}
            onHover={setInspected}
          />
        ) : (
          <VehicleGauges
            vehicles={data}
            onSelect={setSelected}
            onHover={setInspected}
          />
        )}
      </div>

      <VehicleInspector v={inspected} all={data} />
      {selected && (
        <VehicleDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
