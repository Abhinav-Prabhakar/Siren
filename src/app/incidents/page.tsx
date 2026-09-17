"use client";

import { useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import {
  Alert,
  Badge,
  Button,
  IncidentCard,
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
  fmtAgo,
  statusTone,
  type Incident,
  type IncidentPriority,
  type IncidentStatus,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";
import { IncidentDetailPanel } from "@/components/incidents/incident-detail";

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

function IncidentsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-5">
        <Skeleton className="h-11" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44" />
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
            <Badge tone={error && !data ? "dead" : active > 0 ? "hot" : "cold"}>
              {error && !data
                ? "Link down"
                : `${incidents.length} incidents // ${active} active`}
            </Badge>
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
            {/* master — incident log */}
            <div className="xl:col-span-5">
              <Panel
                title="Incident log"
                led={active > 0 ? "pulse" : "on"}
                right={`${filtered.length}/${incidents.length} records`}
                bodyClassName="p-0"
              >
                <div className="border-b border-flame/20">
                  <Tabs
                    tabs={tabs}
                    activeId={statusFilter}
                    onChange={setStatusFilter}
                    className="border-b-0"
                  />
                </div>
                <div className="max-h-[860px] space-y-4 overflow-y-auto p-4">
                  {filtered.length > 0 ? (
                    filtered.map((inc) => (
                      <div
                        key={inc.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected === inc.id}
                        onClick={() => setPicked(inc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPicked(inc.id);
                          }
                        }}
                        className={cn(
                          "cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame",
                          selected === inc.id &&
                            "ring-1 ring-flame/70 shadow-[0_0_24px_-6px_rgb(255_46_46/0.6)]",
                        )}
                      >
                        <IncidentCard
                          incident={{
                            id: inc.id,
                            priority: inc.priority,
                            classification: inc.classification,
                            address: inc.address,
                            reportedAgo: fmtAgo(inc.reported_at),
                            status: inc.status,
                            statusTone: statusTone(inc.status),
                            calls: `${inc.call_count ?? 0} calls`,
                            units:
                              (inc.unit_count ?? 0) > 0
                                ? [
                                    `${inc.unit_count} unit${inc.unit_count === 1 ? "" : "s"}`,
                                  ]
                                : undefined,
                          }}
                          actions={
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPicked(inc.id);
                              }}
                            >
                              Inspect
                            </Button>
                          }
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex h-32 items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash/60">
                      {statusFilter === "all"
                        ? "no incidents on record //"
                        : `no ${statusFilter.replace(/_/g, " ")} incidents in this state //`}
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {/* detail — live incident record */}
            <div className="xl:col-span-7">
              <div className="xl:sticky xl:top-20">
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
