"use client";

import { Package, Truck, Users, type LucideIcon } from "lucide-react";
import { needsAttention } from "@/components/equipment/shared";
import { Led, Panel, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Feed } from "./sidebar";
import type { Equipment, Personnel, Vehicle } from "@/lib/api";

const ON_DUTY: ReadonlySet<string> = new Set([
  "on_duty",
  "dispatched",
  "en_route",
  "on_scene",
]);

const SEGMENTS = 18;

/** One proportion line: icon · segmented ready-share · n/total. */
function ReadyLine({
  Icon,
  label,
  ready,
  total,
}: {
  Icon: LucideIcon;
  label: string;
  ready: number;
  total: number;
}) {
  const filled = total > 0 ? Math.round((ready / total) * SEGMENTS) : 0;
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-ash" />
      <span className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
        {label}
      </span>
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 flex-1",
              i < filled ? "bg-flame/80" : "bg-smoke",
            )}
          />
        ))}
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums">
        <span className="text-bone">{ready}</span>
        <span className="text-ash/60">/{total}</span>
      </span>
    </div>
  );
}

/**
 * Station readiness at a glance — three proportion lines (fleet ready,
 * crew on duty, kit ready) instead of a grid of identical stat cards.
 */
export function ReadinessBar({
  vehicles,
  equipment,
  personnel,
}: {
  vehicles: Feed<Vehicle>;
  equipment: Feed<Equipment>;
  personnel: Feed<Personnel>;
}) {
  const vs = vehicles.data;
  const es = equipment.data;
  const ps = personnel.data;

  const allDown =
    vs === null &&
    es === null &&
    ps === null &&
    (vehicles.error !== null || equipment.error !== null || personnel.error !== null);
  const allLoading = vs === null && es === null && ps === null && vehicles.loading;

  return (
    <Panel
      title="Readiness"
      led={allDown ? "off" : "on"}
      right="live // 4s poll"
    >
      {allLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : allDown ? (
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          <Led tone="off" size="sm" />
          Feeds down — backend unreachable
        </div>
      ) : (
        <div className="space-y-2.5">
          <ReadyLine
            Icon={Truck}
            label="Fleet"
            ready={vs ? vs.filter((v) => v.status === "available").length : 0}
            total={vs?.length ?? 0}
          />
          <ReadyLine
            Icon={Users}
            label="Crew"
            ready={ps ? ps.filter((p) => ON_DUTY.has(p.status)).length : 0}
            total={ps?.length ?? 0}
          />
          <ReadyLine
            Icon={Package}
            label="Kit"
            ready={
              es ? es.filter((i) => i.status === "ready" && !needsAttention(i)).length : 0
            }
            total={es?.length ?? 0}
          />
        </div>
      )}
    </Panel>
  );
}
