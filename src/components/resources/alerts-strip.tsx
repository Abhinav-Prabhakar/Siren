"use client";

import { useMemo } from "react";
import {
  ChevronRight,
  HeartPulse,
  Package,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  attentionReasons,
  needsAttention,
} from "@/components/equipment/shared";
import { vitalsAlert } from "@/components/people/lib";
import { Panel } from "@/components/ui";
import type { Equipment, Personnel, Vehicle } from "@/lib/api";
import type { Feed, ResourceTab } from "./sidebar";

interface Flag {
  id: string;
  tab: ResourceTab;
  Icon: LucideIcon;
  label: string;
  detail: string;
}

/**
 * Cross-domain flag queue — dead units, flagged kit, critical vitals —
 * as icon rows. Clicking a row switches the sidebar to the owning tab.
 */
export function AlertsStrip({
  vehicles,
  equipment,
  personnel,
  onSelect,
}: {
  vehicles: Feed<Vehicle>;
  equipment: Feed<Equipment>;
  personnel: Feed<Personnel>;
  onSelect: (tab: ResourceTab) => void;
}) {
  const flags = useMemo<Flag[]>(() => {
    const rows: Flag[] = [];
    for (const v of vehicles.data ?? []) {
      if (v.status !== "out_of_service") continue;
      rows.push({
        id: `v-${v.id}`,
        tab: "vehicles",
        Icon: Truck,
        label: `${v.callsign} — ${v.name}`,
        detail: "out of service",
      });
    }
    for (const i of equipment.data ?? []) {
      if (!needsAttention(i)) continue;
      rows.push({
        id: `e-${i.id}`,
        tab: "equipment",
        Icon: Package,
        label: `${i.id} — ${i.name}`,
        detail: attentionReasons(i)[0] ?? "flagged",
      });
    }
    for (const p of personnel.data ?? []) {
      if (vitalsAlert(p) !== "critical") continue;
      rows.push({
        id: `p-${p.id}`,
        tab: "people",
        Icon: HeartPulse,
        label: `${p.id} — ${p.name}`,
        detail: `HR ${p.heart_rate} · SCBA ${Math.round(p.scba_pct)}%`,
      });
    }
    return rows;
  }, [vehicles.data, equipment.data, personnel.data]);

  return (
    <Panel
      title="Attention"
      led={flags.length > 0 ? "pulse" : "off"}
      right={`${flags.length} flagged`}
      bodyClassName="max-h-[220px] space-y-1.5 overflow-y-auto"
    >
      {flags.length === 0 ? (
        <div className="flex items-center gap-3 px-1 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          <ShieldCheck className="h-4 w-4 text-bone/50" />
          All clear — nothing flagged
        </div>
      ) : (
        flags.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.tab)}
            className="group flex w-full cursor-pointer items-center gap-3 border border-flame/15 bg-smoke/40 px-3 py-2 text-left transition-colors hover:border-flame/50 hover:bg-wine/30"
          >
            <f.Icon className="h-4 w-4 shrink-0 text-flame" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.15em] text-bone/85 group-hover:text-bone">
                {f.label}
              </span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash/80">
                {f.detail}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ash transition-colors group-hover:text-flame" />
          </button>
        ))
      )}
    </Panel>
  );
}
