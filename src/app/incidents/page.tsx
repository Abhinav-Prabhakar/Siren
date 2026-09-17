"use client";

import { useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Panel,
  Skeleton,
  Tabs,
  type BadgeTone,
  type LedTone,
  type TabItem,
} from "@/components/ui";
import {
  api,
  statusTone,
  type Incident,
  type IncidentPriority,
  type IncidentStatus,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";
import { IncidentDetailPanel } from "@/components/incidents/incident-detail";
import { IncidentTape } from "@/components/incidents/incident-tape";
import {
  SectorScope,
  type ScopeBlip,
} from "@/components/incidents/sector-scope";

const POLL_MS = 4000;

const STATUSES: IncidentStatus[] = [
  "active",
  "contained",
  "monitoring",
  "resolved",
];

const PRIORITY_RANK: Record<IncidentPriority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

const PRIORITY_BAR: Record<IncidentPriority, string> = {
  P1: "bg-flame shadow-[0_0_5px_rgb(255_46_46/0.7)]",
  P2: "bg-blaze",
  P3: "bg-bone/50",
  P4: "bg-ash/40",
};

const toneToLed: Record<BadgeTone, LedTone> = {
  hot: "flame",
  warm: "blaze",
  cold: "bone",
  dead: "off",
  plain: "flame",
};

/** Most urgent first — priority rank, then newest report. */
function byUrgency(a: Incident, b: Incident): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    Date.parse(b.reported_at) - Date.parse(a.reported_at)
  );
}

/** Priority mix of the whole board — one mini bar per grade. */
function PrioritySpectrum({ incidents }: { incidents: Incident[] }) {
  const counts = (["P1", "P2", "P3", "P4"] as const).map((p) => ({
    p,
    n: incidents.filter((i) => i.priority === p).length,
  }));
  const max = Math.max(...counts.map((c) => c.n), 1);
  return (
    <span
      className="flex items-end gap-1"
      title="incidents by priority grade"
    >
      {counts.map(({ p, n }) => (
        <span key={p} className="flex flex-col items-center gap-[3px]">
          <span
            className={cn("w-1.5", PRIORITY_BAR[p], n === 0 && "opacity-15")}
            style={{ height: `${n > 0 ? 4 + (n / max) * 14 : 2}px` }}
          />
          <span className="font-mono text-[6px] leading-none tracking-[0.05em] text-ash/70">
            {p}
          </span>
        </span>
      ))}
    </span>
  );
}

function IncidentsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-5">
        <Skeleton className="h-56" />
        <Skeleton className="h-11" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="xl:col-span-7">
        <Skeleton className="h-[560px]" />
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const { data, error, loading, refresh } = usePolling<Incident[]>(
    api.incidents,
    POLL_MS,
  );
  const overview = usePolling(api.overview, 8000);
  const incidents = data ?? [];

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [picked, setPicked] = useState<string | null>(null);

  // master-detail: default focus is the most urgent incident on the board
  const selected =
    picked ??
    (incidents.length > 0 ? [...incidents].sort(byUrgency)[0].id : null);

  const countBy = (s: IncidentStatus) =>
    incidents.filter((i) => i.status === s).length;
  const active = countBy("active");

  const filtered = incidents
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .sort(byUrgency);

  // sector scope mirrors the filtered tape — blips keyed to the same rows
  const blips: ScopeBlip[] = filtered.map((i) => ({
    id: i.id,
    lat: i.lat,
    lng: i.lng,
    tone: statusTone(i.priority),
    pulse: i.status === "active",
    hollow: i.status === "resolved",
    selected: selected === i.id,
    label: selected === i.id ? i.id : undefined,
  }));
  const station = overview.data?.station ?? null;

  const tabs: TabItem[] = [
    { id: "all", label: "All", count: incidents.length, led: "flame" },
    ...STATUSES.map((s) => ({
      id: s,
      label: s.replace(/_/g, " "),
      count: countBy(s),
      led: toneToLed[statusTone(s)],
    })),
  ];

  return (
    <div className="min-h-screen bg-ink">
      <ConsoleNav />
      <main className="mx-auto max-w-[1600px] space-y-6 px-5 py-6">
        <PageHeader
          title="Incidents"
          sub="Event log & response // STA-01"
          back={{ href: "/", label: "Control room" }}
          status={
            <span className="flex items-center gap-4">
              {incidents.length > 0 && (
                <PrioritySpectrum incidents={incidents} />
              )}
              <Badge tone={error && !data ? "dead" : active > 0 ? "hot" : "cold"}>
                {error && !data
                  ? "Link down"
                  : `${incidents.length} incidents // ${active} active`}
              </Badge>
            </span>
          }
          actions={
            <Button variant="outline" size="sm" led="on" onClick={refresh}>
              Resync
            </Button>
          }
        />

        {error &&
          (data === null ? (
            <Alert tone="critical" title="Backend unreachable at localhost:8000">
              {error} — incident log unavailable. Polling retries every 4s.
            </Alert>
          ) : (
            <Alert tone="warning" title="Link unstable — showing last sync">
              {error} — incident data may be stale. Polling retries every 4s.
            </Alert>
          ))}

        {loading && !data ? (
          <IncidentsSkeleton />
        ) : (
          <div className="grid gap-6 xl:grid-cols-12">
            {/* master — sector scope over the log tape */}
            <div className="xl:col-span-5">
              <Panel
                title="Incident board"
                led={active > 0 ? "pulse" : "on"}
                right={`${filtered.length}/${incidents.length} records`}
                bodyClassName="p-0"
              >
                <div className="border-b border-flame/15">
                  <SectorScope
                    blips={blips}
                    center={
                      station
                        ? {
                            lat: station.lat,
                            lng: station.lng,
                            label: station.code,
                          }
                        : null
                    }
                    onSelect={setPicked}
                    className="h-56"
                  />
                </div>
                <Tabs
                  tabs={tabs}
                  activeId={statusFilter}
                  onChange={setStatusFilter}
                  className="border-b-0"
                />
                <div className="max-h-[600px] overflow-y-auto border-t border-flame/15">
                  <IncidentTape
                    incidents={filtered}
                    selectedId={selected}
                    onSelect={setPicked}
                    emptyText={
                      statusFilter === "all"
                        ? "no incidents on record"
                        : `no ${statusFilter.replace(/_/g, " ")} incidents in this state`
                    }
                  />
                </div>
              </Panel>
            </div>

            {/* detail — live incident record */}
            <div className="xl:col-span-7">
              <div className="sticky xl:top-20">
                {selected ? (
                  <IncidentDetailPanel key={selected} id={selected} />
                ) : (
                  <Panel title="Incident record" led="off">
                    <div className="flex h-48 items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
                      select an incident from the log //
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
