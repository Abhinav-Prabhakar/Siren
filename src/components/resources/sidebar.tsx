"use client";

import { useMemo } from "react";
import { Package, Truck, Users, type LucideIcon } from "lucide-react";
import { needsAttention } from "@/components/equipment/shared";
import { vitalsAlert } from "@/components/people/lib";
import { cn } from "@/lib/utils";
import type { Equipment, Incident, Personnel, Vehicle } from "@/lib/api";
import { EquipmentList } from "./sidebar-equipment";
import { PersonnelList } from "./sidebar-people";
import { VehiclesList } from "./sidebar-vehicles";

export type ResourceTab = "vehicles" | "equipment" | "people";

export const TABS: { id: ResourceTab; label: string; Icon: LucideIcon }[] = [
  { id: "vehicles", label: "Fleet", Icon: Truck },
  { id: "equipment", label: "Kit", Icon: Package },
  { id: "people", label: "Crew", Icon: Users },
];

export interface Feed<T> {
  data: T[] | null;
  error: string | null;
  loading: boolean;
}

/**
 * Right-hand resource rail — icon tabs (Fleet / Kit / Crew) with live
 * counts and a flag pip per tab; the active manifest fills the rest of
 * the column and scrolls independently.
 */
export function ResourceSidebar({
  active,
  onSelect,
  vehicles,
  equipment,
  personnel,
  incidents,
  station,
  className,
}: {
  active: ResourceTab;
  onSelect: (tab: ResourceTab) => void;
  vehicles: Feed<Vehicle>;
  equipment: Feed<Equipment>;
  personnel: Feed<Personnel>;
  incidents: Incident[];
  station: { lat: number; lng: number } | null;
  className?: string;
}) {
  const meta = useMemo<Record<ResourceTab, { count: number | null; flags: number }>>(() => {
    const vs = vehicles.data;
    const es = equipment.data;
    const ps = personnel.data;
    return {
      vehicles: {
        count: vs ? vs.length : null,
        flags: vs ? vs.filter((v) => v.status === "out_of_service").length : 0,
      },
      equipment: {
        count: es ? es.length : null,
        flags: es ? es.filter(needsAttention).length : 0,
      },
      people: {
        count: ps ? ps.length : null,
        flags: ps ? ps.filter((p) => vitalsAlert(p) === "critical").length : 0,
      },
    };
  }, [vehicles.data, equipment.data, personnel.data]);

  return (
    <div className={cn("flex flex-col border border-flame/15 bg-coal", className)}>
      {/* icon tab rail */}
      <div role="tablist" className="flex border-b border-flame/15">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          const m = meta[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(id)}
              className={cn(
                "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2.5 transition-colors",
                isActive
                  ? "bg-flame/10 text-flame"
                  : "text-ash hover:bg-flame/5 hover:text-bone",
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {m.flags > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center bg-flame px-0.5 font-mono text-[8px] font-bold leading-none text-ink">
                    {m.flags}
                  </span>
                )}
              </span>
              <span className="font-display text-sm font-bold tabular-nums leading-none">
                {m.count ?? "—"}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.25em]">
                {label}
              </span>
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 h-[2px] bg-flame transition-opacity",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* active manifest — list scrolls inside itself, inspector dock pinned below */}
      {active === "vehicles" && (
        <VehiclesList feed={vehicles} incidents={incidents} station={station} />
      )}
      {active === "equipment" && <EquipmentList feed={equipment} />}
      {active === "people" && <PersonnelList feed={personnel} />}
    </div>
  );
}
