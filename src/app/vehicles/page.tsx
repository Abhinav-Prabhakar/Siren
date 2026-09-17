"use client";

import { useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import {
  Alert,
  Badge,
  BarChart,
  Button,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Stat,
  Tabs,
} from "@/components/ui";
import type { BadgeTone, LedTone } from "@/components/ui";
import {
  api,
  fmtAgo,
  statusTone,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { PositionBoard } from "@/components/vehicles/position-board";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";

const STATUS_ORDER: VehicleStatus[] = [
  "available",
  "dispatched",
  "en_route",
  "on_scene",
  "returning",
  "refuel",
  "out_of_service",
];

const STATUS_SHORT: Record<VehicleStatus, string> = {
  available: "Avail",
  dispatched: "Disp",
  en_route: "En rte",
  on_scene: "Scene",
  returning: "Ret",
  refuel: "Refuel",
  out_of_service: "OOS",
};

const COMMITTED: ReadonlySet<VehicleStatus> = new Set([
  "dispatched",
  "en_route",
  "on_scene",
]);

const toneToLed: Record<BadgeTone, LedTone> = {
  hot: "flame",
  warm: "blaze",
  cold: "bone",
  dead: "off",
  plain: "flame",
};

function FleetSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const { data, error, loading, refresh } = usePolling<Vehicle[]>(
    api.vehicles,
    4000,
  );
  const vehicles = data ?? [];

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const countBy = (s: VehicleStatus) =>
    vehicles.filter((v) => v.status === s).length;
  const committed = vehicles.filter((v) => COMMITTED.has(v.status)).length;
  const oos = countBy("out_of_service");
  const available = countBy("available");
  const latest = vehicles.reduce<string | null>(
    (acc, v) => (acc && acc > v.updated_at ? acc : v.updated_at),
    null,
  );

  const types = [...new Set(vehicles.map((v) => v.type))].sort();
  const filtered = vehicles.filter(
    (v) =>
      (statusFilter === "all" || v.status === statusFilter) &&
      (typeFilter === "all" || v.type === typeFilter),
  );

  const barData = STATUS_ORDER.map((s) => ({
    label: STATUS_SHORT[s],
    value: countBy(s),
    muted: countBy(s) === 0,
  }));

  const tabs = [
    { id: "all", label: "All", count: vehicles.length, led: "flame" as LedTone },
    ...STATUS_ORDER.filter((s) => countBy(s) > 0).map((s) => ({
      id: s,
      label: STATUS_SHORT[s],
      count: countBy(s),
      led: toneToLed[statusTone(s)],
    })),
  ];

  return (
    <div className="min-h-screen bg-ink">
      <ConsoleNav />
      <main className="mx-auto max-w-[1600px] space-y-6 px-5 py-6">
        <PageHeader
          title="Apparatus bay"
          sub="Fleet telemetry // STA-01"
          back={{ href: "/", label: "Console" }}
          status={
            <Badge tone={error ? "dead" : committed > 0 ? "hot" : "cold"}>
              {error
                ? "Link down"
                : `${vehicles.length} units // poll 4s`}
            </Badge>
          }
          actions={
            <Button variant="outline" size="sm" led="on" onClick={refresh}>
              Resync
            </Button>
          }
        />

        {error && (
          <Alert
            tone={data ? "warning" : "critical"}
            title={
              data
                ? "Uplink degraded"
                : "Backend unreachable at localhost:8000"
            }
          >
            {error} —{" "}
            {data
              ? "showing last synced fleet data. Polling retries every 4s."
              : "fleet data unavailable. Check the FastAPI server, then resync."}
          </Alert>
        )}

        {loading && !data ? (
          <FleetSkeleton />
        ) : (
          <>
            {/* fleet status strip */}
            <Panel
              title="Fleet status"
              led={committed > 0 ? "pulse" : "on"}
              right={`last upd ${fmtAgo(latest)}`}
            >
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="grid grid-cols-2 gap-6 self-center">
                  <Stat
                    label="Total units"
                    value={vehicles.length}
                    sub="tracked // STA-01"
                  />
                  <Stat
                    label="Available"
                    value={available}
                    sub="ready for assignment"
                  />
                  <Stat
                    label="Committed"
                    value={committed}
                    sub="disp + en rte + scene"
                  />
                  <Stat
                    label="Out of service"
                    value={oos}
                    sub="dark // no dispatch"
                  />
                </div>
                <BarChart data={barData} height={150} grid={3} />
              </div>
            </Panel>

            <PositionBoard
              vehicles={vehicles}
              selectedId={selected}
              onSelect={setSelected}
            />

            {/* fleet roster */}
            <Panel
              title="Fleet roster"
              led="on"
              right={`${filtered.length}/${vehicles.length} units`}
              bodyClassName="space-y-0 p-0"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-flame/20 pr-4">
                <Tabs
                  tabs={tabs}
                  activeId={statusFilter}
                  onChange={setStatusFilter}
                  className="border-b-0"
                />
                <div className="w-44 pb-3">
                  <Select
                    label="Type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-9"
                  >
                    <option value="all">All types</option>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="p-4">
                {filtered.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((v) => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
                    no units match filter //
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </main>

      {selected && (
        <VehicleDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
