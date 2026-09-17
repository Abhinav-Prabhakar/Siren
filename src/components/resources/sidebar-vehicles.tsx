"use client";

import { useState } from "react";
import {
  Ambulance,
  Biohazard,
  Fuel,
  LifeBuoy,
  Radio,
  Siren,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Led, Skeleton } from "@/components/ui";
import {
  statusTone,
  type Vehicle,
  type VehicleStatus,
  type VehicleType,
} from "@/lib/api";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import type { Feed } from "./sidebar";
import { MiniBar, Row, TONE_TEXT } from "./rows";

export const VEHICLE_STATUS_ORDER: Record<VehicleStatus, number> = {
  on_scene: 0,
  en_route: 1,
  dispatched: 2,
  available: 3,
  returning: 4,
  refuel: 5,
  out_of_service: 6,
};

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

function VehicleRow({
  vehicle: v,
  onSelect,
}: {
  vehicle: Vehicle;
  onSelect: (id: string) => void;
}) {
  const tone = statusTone(v.status);
  const dead = v.status === "out_of_service";
  const Icon = TYPE_ICON[v.type];
  return (
    <Row onClick={() => onSelect(v.id)} dimmed={dead}>
      <Icon className={`h-5 w-5 shrink-0 ${TONE_TEXT[tone]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-bone">
            {v.callsign}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {v.incident_id !== null && (
              <Siren className="h-3 w-3 text-flame" />
            )}
            <span
              className={`font-mono text-[8px] uppercase tracking-[0.2em] ${TONE_TEXT[tone]}`}
            >
              {STATUS_SHORT[v.status]}
            </span>
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ash">
          {v.name}
          {" · "}
          {v.incident_id ?? `${v.station_id} bay`}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Fuel className="h-3 w-3 shrink-0 text-ash/60" />
          <MiniBar value={v.fuel_pct} />
          {v.speed_kmh > 5 && (
            <span className="shrink-0 font-mono text-[9px] tabular-nums text-blaze">
              {Math.round(v.speed_kmh)} km/h
            </span>
          )}
        </div>
      </div>
    </Row>
  );
}

export function VehiclesList({ feed }: { feed: Feed<Vehicle> }) {
  const { data, error, loading } = feed;
  const [selected, setSelected] = useState<string | null>(null);

  if (data === null && loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Fleet feed down"}
        </span>
      </div>
    );
  }

  const sorted = [...data].sort(
    (a, b) =>
      VEHICLE_STATUS_ORDER[a.status] - VEHICLE_STATUS_ORDER[b.status] ||
      a.callsign.localeCompare(b.callsign),
  );

  return (
    <>
      {sorted.map((v) => (
        <VehicleRow key={v.id} vehicle={v} onSelect={setSelected} />
      ))}
      {selected && (
        <VehicleDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
