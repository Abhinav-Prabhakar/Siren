"use client";

import { useMemo } from "react";
import {
  ChevronRight,
  HeartPulse,
  Package,
  ShieldCheck,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  attentionReasons,
  needsAttention,
} from "@/components/equipment/shared";
import { vitalsAlert } from "@/components/people/lib";
import type { Equipment, Personnel, Vehicle } from "@/lib/api";
import type { Feed, ResourceTab } from "./sidebar";
import { IconChip, Row } from "./rows";

interface Flag {
  id: string;
  tab: ResourceTab;
  Icon: LucideIcon;
  label: string;
  detail: string;
}

/**
 * Cross-domain flag queue — dead units, flagged kit, critical vitals.
 * Quiet rows that switch the sidebar to the owning tab; the whole
 * section stays visually subordinate to the position board.
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
    <section className="min-w-0">
      <div className="flex items-center gap-2.5 border-b border-flame/10 pb-2">
        <TriangleAlert className="h-3.5 w-3.5 text-flame" />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-flame/80">
          attention
        </span>
        {flags.length > 0 && (
          <span className="font-mono text-[9px] tabular-nums text-ash/60">
            {flags.length} flagged
          </span>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="flex items-center gap-2.5 pt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ash/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          all clear
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto">
          {flags.map((f) => (
            <Row key={f.id} onClick={() => onSelect(f.tab)}>
              <IconChip tone="hot">
                <f.Icon className="h-4 w-4" />
              </IconChip>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-bone">
                  {f.label}
                </span>
                <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
                  {f.detail}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ash transition-colors group-hover:text-flame" />
            </Row>
          ))}
        </div>
      )}
    </section>
  );
}
