"use client";

import { useState } from "react";
import {
  Ambulance,
  Biohazard,
  Fuel,
  LifeBuoy,
  Radio,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Led, Skeleton } from "@/components/ui";
import {
  fmtAgo,
  fmtClock,
  statusTone,
  type Vehicle,
  type VehicleStatus,
  type VehicleType,
} from "@/lib/api";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import type { Feed } from "./sidebar";
import {
  DockCell,
  fmtFree,
  fmtPos,
  GroupLabel,
  IconChip,
  InspectorDock,
  Row,
  RowMeta,
  TONE_TEXT,
} from "./rows";

const STATUS_SHORT: Record<VehicleStatus, string> = {
  available: "avail",
  dispatched: "disp",
  en_route: "en rte",
  on_scene: "scene",
  returning: "ret",
  refuel: "refuel",
  out_of_service: "oos",
};

const TYPE_ICON: Record<VehicleType, LucideIcon> = {
  pumper: Truck,
  tender: Fuel,
  ladder: Truck,
  rescue: LifeBuoy,
  ambulance: Ambulance,
  hazmat: Biohazard,
  command: Radio,
  special: Truck,
};

/** Manifest groups — committed work first, dead metal last. */
const GROUPS: { label: string; statuses: VehicleStatus[] }[] = [
  { label: "Committed", statuses: ["dispatched", "en_route", "on_scene"] },
  { label: "Ready", statuses: ["available"] },
  { label: "Return / refuel", statuses: ["returning", "refuel"] },
  { label: "Out of service", statuses: ["out_of_service"] },
];

/** Where the unit sits, in one word. */
function placeOf(v: Vehicle): string {
  if (v.incident_id !== null) return v.incident_id;
  if (v.status === "available") return `${v.station_id} bay`;
  if (v.status === "out_of_service") return "dark";
  return "in transit";
}

function VehicleRow({
  vehicle: v,
  onSelect,
  onHover,
}: {
  vehicle: Vehicle;
  onSelect: (id: string) => void;
  onHover: (v: Vehicle | null) => void;
}) {
  const tone = statusTone(v.status);
  const Icon = TYPE_ICON[v.type];
  return (
    <Row
      onClick={() => onSelect(v.id)}
      onHover={(h) => onHover(h ? v : null)}
      dimmed={v.status === "out_of_service"}
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
        </span>
      </span>
      <RowMeta
        top={STATUS_SHORT[v.status]}
        topClassName={TONE_TEXT[tone]}
        bottom={v.free_at !== null ? `free ${fmtFree(v.free_at)}` : ""}
      />
    </Row>
  );
}

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
            {v.free_at !== null ? `${fmtFree(v.free_at)} · ${fmtClock(v.free_at)}` : "—"}
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

export function VehiclesList({ feed }: { feed: Feed<Vehicle> }) {
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
    body = GROUPS.map((g) => {
      const inGroup = data
        .filter((v) => g.statuses.includes(v.status))
        .sort((a, b) => a.callsign.localeCompare(b.callsign));
      if (inGroup.length === 0) return null;
      return (
        <div key={g.label}>
          <GroupLabel label={g.label} count={inGroup.length} />
          {inGroup.map((v) => (
            <VehicleRow
              key={v.id}
              vehicle={v}
              onSelect={setSelected}
              onHover={setInspected}
            />
          ))}
        </div>
      );
    });
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
