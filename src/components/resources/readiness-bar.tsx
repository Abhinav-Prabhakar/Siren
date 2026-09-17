"use client";

import { Package, Truck, Users, type LucideIcon } from "lucide-react";
import { needsAttention } from "@/components/equipment/shared";
import { Led } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Feed } from "./sidebar";
import type { Equipment, Personnel, Vehicle } from "@/lib/api";

const ON_DUTY: ReadonlySet<string> = new Set([
  "on_duty",
  "dispatched",
  "en_route",
  "on_scene",
]);

const SEGMENTS = 8;

/** icon · block segments · n/total — one glance per domain. */
function ReadyGroup({
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
    <span className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-ash" />
      <span className="flex gap-[3px]">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn("h-3 w-1.5", i < filled ? "bg-flame/80" : "bg-smoke")}
          />
        ))}
      </span>
      <span className="font-mono text-[10px] tabular-nums">
        <span className="text-bone">{total > 0 ? ready : "—"}</span>
        <span className="text-ash/50">/{total > 0 ? total : "—"}</span>
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
        {label}
      </span>
    </span>
  );
}

/**
 * Slim readiness strip — one line holding fleet/crew/kit ready-shares.
 * Replaces the old stat-card grid: three small patterns, not four
 * identical numbers.
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

  const down =
    vs === null &&
    es === null &&
    ps === null &&
    (vehicles.error !== null ||
      equipment.error !== null ||
      personnel.error !== null);

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-flame/10 pb-4">
      {down ? (
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          <Led tone="off" size="sm" />
          feeds down — backend unreachable
        </span>
      ) : (
        <>
          <ReadyGroup
            Icon={Truck}
            label="fleet"
            ready={vs ? vs.filter((v) => v.status === "available").length : 0}
            total={vs?.length ?? 0}
          />
          <ReadyGroup
            Icon={Users}
            label="crew"
            ready={ps ? ps.filter((p) => ON_DUTY.has(p.status)).length : 0}
            total={ps?.length ?? 0}
          />
          <ReadyGroup
            Icon={Package}
            label="kit"
            ready={
              es
                ? es.filter((i) => i.status === "ready" && !needsAttention(i))
                    .length
                : 0
            }
            total={es?.length ?? 0}
          />
        </>
      )}
    </div>
  );
}
