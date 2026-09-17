"use client";

import type { ReactNode } from "react";
import { Led, Meter, Panel, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

const VEHICLE_STATUSES = [
  "available",
  "dispatched",
  "en_route",
  "on_scene",
  "returning",
  "refuel",
  "out_of_service",
] as const;

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/**
 * Fleet readiness panel — moved off the control-room console onto /resources.
 * Polls api.overview() itself so it can live on any page. `actions` slot
 * receives navigation controls (links or tab-switchers depending on context).
 */
export function FleetReadiness({ actions }: { actions?: ReactNode }) {
  const { data: ov, error, loading } = usePolling(() => api.overview(), 4000);

  const vCounts = ov?.counts.vehicles ?? {};
  const pCounts = ov?.counts.personnel ?? {};
  const eCounts = ov?.counts.equipment ?? {};

  const totalVehicles = Object.values(vCounts).reduce((a, b) => a + b, 0);
  const totalPersonnel = Object.values(pCounts).reduce((a, b) => a + b, 0);
  const totalEquipment = Object.values(eCounts).reduce((a, b) => a + b, 0);

  const unitsReady = vCounts.available ?? 0;
  const crewOnDuty =
    (pCounts.on_duty ?? 0) +
    (pCounts.dispatched ?? 0) +
    (pCounts.en_route ?? 0) +
    (pCounts.on_scene ?? 0);
  const kitReady = eCounts.ready ?? 0;

  return (
    <Panel
      title="Fleet readiness"
      led={error !== null && ov === null ? "off" : "on"}
      right={
        error !== null && ov === null
          ? "link down"
          : `${unitsReady}/${totalVehicles} ready`
      }
      bodyClassName="space-y-4"
    >
      {ov === null ? (
        loading && error === null ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-ash/15 bg-smoke/40 px-4 py-5">
            <Led tone="off" size="sm" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
              Readiness feed down — backend :8000 unreachable
            </span>
          </div>
        )
      ) : (
        <>
          <Meter
            label="Fleet ready"
            value={pct(unitsReady, totalVehicles)}
            lowAt={50}
          />
          <Meter
            label="Crew ready"
            value={pct(crewOnDuty, totalPersonnel)}
            lowAt={50}
          />
          <Meter
            label="Kit ready"
            value={pct(kitReady, totalEquipment)}
            lowAt={60}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-flame/10 pt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
            {VEHICLE_STATUSES.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span>{s.replace(/_/g, " ")}</span>
                <span className="text-bone/70">{vCounts[s] ?? 0}</span>
              </div>
            ))}
          </div>
          {actions !== undefined && (
            <div className="flex flex-wrap gap-3 pt-1">{actions}</div>
          )}
        </>
      )}
    </Panel>
  );
}
