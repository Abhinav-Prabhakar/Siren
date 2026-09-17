"use client";

import { useMemo, useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import { CommandPanel } from "@/components/people/command-panel";
import {
  ALL_ROLES,
  ALL_STATUSES,
  dutyLed,
  ROLE_LABELS,
  ROLE_SHORT,
  STATUS_LABELS,
  STATUS_ORDER,
  vitalsAlert,
} from "@/components/people/lib";
import { PersonCard } from "@/components/people/person-card";
import { PersonDetailModal } from "@/components/people/person-detail-modal";
import {
  Alert,
  Badge,
  Button,
  Led,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Stat,
  Tabs,
} from "@/components/ui";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

export default function PeoplePage() {
  const { data, error, loading, refresh } = usePolling(() => api.personnel(), 4000);
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const people = useMemo(() => data ?? [], [data]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) m.set(p.status, (m.get(p.status) ?? 0) + 1);
    return m;
  }, [people]);

  const byRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) m.set(p.role, (m.get(p.role) ?? 0) + 1);
    return m;
  }, [people]);

  const vitalsAlerts = useMemo(
    () => people.filter((p) => vitalsAlert(p) === "critical"),
    [people],
  );

  const filtered = useMemo(
    () =>
      people
        .filter((p) => status === "all" || p.status === status)
        .filter((p) => role === "all" || p.role === role)
        .sort(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            a.name.localeCompare(b.name),
        ),
    [people, status, role],
  );

  const tabs = [
    { id: "all", label: "All", count: people.length, led: "bone" as const },
    ...ALL_STATUSES.map((s) => ({
      id: s,
      label: STATUS_LABELS[s],
      count: byStatus.get(s) ?? 0,
      led: dutyLed(s).tone,
    })),
  ];

  return (
    <div className="bg-grid relative min-h-screen">
      <div
        aria-hidden
        className="bg-scanlines pointer-events-none fixed inset-0 opacity-40"
      />
      <ConsoleNav />

      <main className="relative z-10 mx-auto w-full max-w-[1600px] space-y-6 px-5 py-8">
        <PageHeader
          title="Personnel"
          sub="Crew roster & vitals // STA-01"
          back={{ href: "/", label: "Console" }}
          status={
            <div className="flex items-center gap-3">
              {vitalsAlerts.length > 0 && (
                <Badge tone="hot">{vitalsAlerts.length} vitals</Badge>
              )}
              <Badge tone="plain">
                <Led tone={error ? "off" : "flame"} pulse={!error} size="sm" />
                {people.length} tracked
              </Badge>
            </div>
          }
          actions={
            <Button variant="outline" size="sm" onClick={refresh}>
              Sync
            </Button>
          }
        />

        {loading && !data ? (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-52" />
              ))}
            </div>
          </div>
        ) : error && !data ? (
          <Alert tone="critical" title="Backend unreachable">
            Personnel feed down — no response from the API at localhost:8000.
            Check that the SIREN server is running. ({error})
          </Alert>
        ) : (
          <>
            {error && (
              <Alert tone="warning" title="Stale feed">
                Last poll failed ({error}) — showing previous roster.
              </Alert>
            )}

            {/* roster strip — status matrix + role breakdown */}
            <Panel title="Roster // status matrix" led="on">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
                {ALL_STATUSES.map((s) => (
                  <Stat
                    key={s}
                    label={STATUS_LABELS[s]}
                    value={byStatus.get(s) ?? 0}
                  />
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-flame/10 pt-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  {"// Roles"}
                </span>
                {ALL_ROLES.map((r) => (
                  <span
                    key={r}
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/70"
                  >
                    {ROLE_SHORT[r]}
                    <span className="ml-1.5 text-flame">
                      {String(byRole.get(r) ?? 0).padStart(2, "0")}
                    </span>
                  </span>
                ))}
              </div>
            </Panel>

            <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
              {/* roster */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <Tabs
                    tabs={tabs}
                    activeId={status}
                    onChange={setStatus}
                    className="min-w-0 flex-1 overflow-x-auto"
                  />
                  <div className="w-44 shrink-0">
                    <Select
                      label="Role filter"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="all">All roles</option>
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <Panel>
                    <div className="py-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                      No personnel match this filter
                    </div>
                  </Panel>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {filtered.map((p) => (
                      <PersonCard key={p.id} person={p} onSelect={setSelectedId} />
                    ))}
                  </div>
                )}
              </div>

              {/* command + vitals watch rail */}
              <aside className="space-y-6">
                <CommandPanel people={people} onSelect={setSelectedId} />
                {vitalsAlerts.length > 0 && (
                  <Alert tone="warning" title="Vitals watch">
                    {vitalsAlerts
                      .map(
                        (p) =>
                          `${p.name.split(" ").slice(-1)[0]} — HR ${p.heart_rate} · SCBA ${Math.round(p.scba_pct)}%`,
                      )
                      .join(" // ")}
                  </Alert>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      {selectedId && (
        <PersonDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
