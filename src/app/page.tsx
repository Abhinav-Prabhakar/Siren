"use client";

import { useEffect, useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import { LlmChat } from "@/components/chat/llm-chat";
import {
  Alert,
  Badge,
  Button,
  CallCard,
  Divider,
  IncidentCard,
  Led,
  LogFeed,
  Meter,
  Modal,
  PageHeader,
  Panel,
  Skeleton,
  Stat,
  Switch,
  WeatherStrip,
  type BadgeTone,
} from "@/components/ui";
import { NewDispatchModal } from "@/components/console/new-dispatch-modal";
import {
  API_URL,
  api,
  fmtAgo,
  fmtClock,
  fmtDuration,
  statusTone,
  type Call,
  type Dispatch,
  type DispatchStatus,
  type Incident,
  type IncidentDetail,
  type IncidentPriority,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

const POLL_MS = 4000;
const API_HOST = API_URL.replace(/^https?:\/\//, "");

const PRIORITY_RANK: Record<IncidentPriority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

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

/** Dispatch lifecycle → badge tone (statusTone() doesn't cover these). */
const DISPATCH_TONE: Record<DispatchStatus, BadgeTone> = {
  pending: "warm",
  approved: "hot",
  rejected: "dead",
  completed: "cold",
};

const DECIDED_SHOWN = 6;
const EXTERNAL_SERVICES = ["ems", "police", "utility"] as const;

/** `extracted` arrives as a JSON column — accept array or encoded string. */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function ChipGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash/70">
        {label}
        {":"}
      </span>
      {items.map((id) => (
        <span
          key={id}
          className="clip-tag bg-smoke px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bone/75 [--chamfer:4px]"
        >
          {id}
        </span>
      ))}
    </div>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 border border-ash/15 bg-smoke/40 px-4 py-5">
      <Led tone="bone" size="sm" />
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
        {text}
      </span>
    </div>
  );
}

export default function ControlRoomPage() {
  const overview = usePolling(() => api.overview(), POLL_MS);
  const incidents = usePolling(() => api.incidents("active"), POLL_MS);
  const calls = usePolling(() => api.calls(), POLL_MS);
  const dispatches = usePolling(() => api.dispatches(), POLL_MS);
  const events = usePolling(() => api.events(40), POLL_MS);
  const settings = usePolling(() => api.settings(), POLL_MS);

  const [dispatchFocus, setDispatchFocus] = useState<Dispatch | null>(null);
  const [incidentFocus, setIncidentFocus] = useState<Incident | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail | null>(
    null,
  );
  const [newDispatchOpen, setNewDispatchOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [nightBusy, setNightBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(id);
  }, [notice]);

  /* clear stale detail/contact state whenever the focused incident changes
     (render-adjust pattern — keeps the effect below fetch-only) */
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const focusId = incidentFocus?.id ?? null;
  if (focusId !== detailFor) {
    setDetailFor(focusId);
    setIncidentDetail(null);
    setContactError(null);
  }

  /* pull fresh incident detail (incl. external_contacts) when a card opens */
  useEffect(() => {
    if (!incidentFocus) return;
    let cancelled = false;
    api
      .incident(incidentFocus.id)
      .then((d) => {
        if (!cancelled) setIncidentDetail(d);
      })
      .catch(() => {
        /* detail fetch failed — modal falls back to the list-row incident */
      });
    return () => {
      cancelled = true;
    };
  }, [incidentFocus]);

  function refreshAll() {
    overview.refresh();
    incidents.refresh();
    calls.refresh();
    dispatches.refresh();
    events.refresh();
    settings.refresh();
  }

  async function decide(d: Dispatch, intent: "approve" | "reject") {
    if (acting) return;
    setActing(true);
    try {
      if (intent === "approve") await api.approveDispatch(d.id);
      else await api.rejectDispatch(d.id);
      setNotice({
        error: false,
        text: `${d.id} ${intent === "approve" ? "approved" : "rejected"} // dispatch log updated`,
      });
      setDispatchFocus(null);
      refreshAll();
    } catch (e) {
      setNotice({
        error: true,
        text: `${d.id} // decision failed — ${
          e instanceof Error ? e.message : "backend unreachable"
        }`,
      });
    } finally {
      setActing(false);
    }
  }

  async function toggleNight(enabled: boolean) {
    if (nightBusy) return;
    setNightBusy(true);
    try {
      await api.setNightMode(enabled);
      setNotice({
        error: false,
        text: enabled
          ? "night watch armed // agent proposals auto-approve while armed"
          : "night watch off // operator approval restored",
      });
      refreshAll();
    } catch (e) {
      setNotice({
        error: true,
        text: `night watch switch failed — ${
          e instanceof Error ? e.message : "backend unreachable"
        }`,
      });
    } finally {
      setNightBusy(false);
    }
  }

  async function contactService(service: string) {
    if (!incidentFocus || contactBusy) return;
    setContactBusy(true);
    setContactError(null);
    try {
      const updated = await api.contactService(incidentFocus.id, service);
      setIncidentDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setIncidentFocus((prev) =>
        prev ? { ...prev, ...updated } : prev,
      );
      incidents.refresh();
      events.refresh();
    } catch (e) {
      setContactError(
        e instanceof Error ? e.message : "contact request failed",
      );
    } finally {
      setContactBusy(false);
    }
  }

  /* ---------- derived state ---------- */

  const ov = overview.data;
  const vCounts = ov?.counts.vehicles ?? {};
  const pCounts = ov?.counts.personnel ?? {};
  const eCounts = ov?.counts.equipment ?? {};
  const totalVehicles = Object.values(vCounts).reduce((a, b) => a + b, 0);
  const totalPersonnel = Object.values(pCounts).reduce((a, b) => a + b, 0);
  const totalEquipment = Object.values(eCounts).reduce((a, b) => a + b, 0);
  const unitsReady = vCounts["available"] ?? 0;
  const unitsCommitted =
    (vCounts["dispatched"] ?? 0) +
    (vCounts["en_route"] ?? 0) +
    (vCounts["on_scene"] ?? 0);
  const crewOnDuty =
    (pCounts["on_duty"] ?? 0) +
    (pCounts["dispatched"] ?? 0) +
    (pCounts["en_route"] ?? 0) +
    (pCounts["on_scene"] ?? 0);
  const crewResting = pCounts["resting"] ?? 0;
  const kitReady = eCounts["ready"] ?? 0;

  const activeIncidents = incidents.data ?? [];
  const topIncident = [...activeIncidents].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  )[0];

  const allDispatches = dispatches.data ?? [];
  const pendingDispatches = allDispatches.filter(
    (d) => d.status === "pending",
  );
  const decidedDispatches = allDispatches
    .filter((d) => d.status !== "pending")
    .sort(
      (a, b) =>
        Date.parse(b.decided_at ?? b.created_at) -
        Date.parse(a.decided_at ?? a.created_at),
    )
    .slice(0, DECIDED_SHOWN);

  const nightMode = settings.data?.night_mode ?? false;

  /** Fresh detail when it lands, list row otherwise. */
  const incidentView: Incident | null = incidentDetail ?? incidentFocus;

  const callList = [...(calls.data ?? [])].sort(
    (a, b) =>
      Number(Boolean(b.live)) - Number(Boolean(a.live)) ||
      (b.started_at ? Date.parse(b.started_at) : 0) -
        (a.started_at ? Date.parse(a.started_at) : 0),
  );

  const feedLines = [...(events.data ?? [])].reverse().map((e) => ({
    time: fmtClock(e.ts),
    tag: e.tag,
    text: e.message,
    tone: e.tone,
  }));

  const firstError =
    overview.error ??
    incidents.error ??
    calls.error ??
    dispatches.error ??
    events.error ??
    settings.error;
  const hasData =
    overview.data !== null ||
    incidents.data !== null ||
    calls.data !== null ||
    dispatches.data !== null ||
    events.data !== null;
  /* error + nothing on screen → critical; error + stale data → warning */
  const backendDown = firstError !== null && !hasData;
  const staleData = firstError !== null && hasData;

  /** Vehicle ids the agent has proposed for a given incident. */
  function proposedUnits(incidentId: string): string[] | undefined {
    const ids = pendingDispatches
      .filter((d) => d.incident_id === incidentId)
      .flatMap((d) => d.vehicle_ids);
    return ids.length > 0 ? ids : undefined;
  }

  const skeletonCards = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Skeleton key={i} className="h-28 w-full" />
    ));

  /* ---------- render ---------- */

  return (
    <div className="flex min-h-screen flex-col">
      <ConsoleNav />

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-5 py-6">
        {backendDown && (
          <Alert
            tone="critical"
            title={`Backend unreachable at ${API_HOST}`}
          >
            Telemetry uplink lost — polling keeps retrying every 4 s and the
            console self-heals when the API returns. Last error: {firstError}
          </Alert>
        )}
        {staleData && (
          <Alert tone="warning" title="Uplink degraded — showing last-known state">
            One or more feeds failed the last refresh; figures below may be
            stale until the API answers again. Last error: {firstError}
          </Alert>
        )}

        <PageHeader
          title="SIREN // Control room"
          sub={
            ov
              ? `${ov.station.name} — ${ov.station.address}`
              : "uplink pending // standby"
          }
          status={
            backendDown ? (
              <Badge tone="dead">LINK DOWN</Badge>
            ) : staleData ? (
              <Badge tone="warm">LINK DEGRADED</Badge>
            ) : (
              <Badge tone="hot">SYSTEM ONLINE</Badge>
            )
          }
          actions={
            <div className="flex items-center gap-4">
              {nightMode && <Badge tone="hot">AUTO-DISPATCH ARMED</Badge>}
              <Switch
                label="Night watch // auto-approve"
                checked={nightMode}
                disabled={settings.data === null || nightBusy}
                onCheckedChange={(v) => void toggleNight(v)}
              />
              <Button
                variant="solid"
                size="sm"
                led="on"
                onClick={() => setNewDispatchOpen(true)}
              >
                New dispatch
              </Button>
            </div>
          }
        />

        {/* status strip — station vitals + weather at the hottest incident */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Panel
            title="Station status"
            led={backendDown ? "off" : "on"}
            className="lg:col-span-8"
            bodyClassName="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6"
          >
            {ov === null ? (
              Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : (
              <>
                <Stat
                  label="Units ready"
                  value={unitsReady}
                  sub={`${totalVehicles} in fleet`}
                />
                <Stat
                  label="Committed"
                  value={unitsCommitted}
                  sub="dispatched + on scene"
                />
                <Stat
                  label="Crew on duty"
                  value={crewOnDuty}
                  sub={`${crewResting} resting`}
                />
                <Stat
                  label="Active incidents"
                  value={ov.counts.active_incidents}
                  sub="across all priorities"
                />
                <Stat
                  label="Pending approvals"
                  value={ov.counts.pending_dispatches}
                  sub="operator action"
                />
                <Stat
                  label="Live calls"
                  value={ov.counts.live_calls}
                  sub="vapi intake"
                />
              </>
            )}
          </Panel>

          <Panel
            title={topIncident ? `Incident wx // ${topIncident.id}` : "Incident wx"}
            led={topIncident ? "pulse" : "off"}
            className="lg:col-span-4"
            bodyClassName="flex h-full items-center"
          >
            {topIncident ? (
              <div className="w-full space-y-2">
                <WeatherStrip
                  className="w-full"
                  wind={topIncident.wind || "—"}
                  windDir={topIncident.wind_dir || undefined}
                  temp={
                    topIncident.temp_c != null
                      ? `${Math.round(topIncident.temp_c)}°C`
                      : "—"
                  }
                  humidity={
                    topIncident.humidity_pct != null
                      ? `${Math.round(topIncident.humidity_pct)}%`
                      : "—"
                  }
                  precip={topIncident.precip || "—"}
                />
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  {topIncident.classification} — {topIncident.address}
                </div>
              </div>
            ) : incidents.data === null && incidents.loading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                No active incident — wx on standby
              </span>
            )}
          </Panel>
        </section>

        {/* main board */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
          {/* left — incidents + inbound calls */}
          <div className="space-y-6 xl:col-span-5">
            <Panel
              title="Active incidents"
              led={activeIncidents.length > 0 ? "pulse" : "off"}
              right={`${activeIncidents.length} on board`}
            >
              <div className="space-y-4">
                {incidents.data === null && incidents.loading ? (
                  skeletonCards(2)
                ) : activeIncidents.length === 0 ? (
                  <PanelEmpty text="No active incidents — all quiet on the wire" />
                ) : (
                  activeIncidents.map((inc) => (
                    <IncidentCard
                      key={inc.id}
                      incident={{
                        id: inc.id,
                        priority: inc.priority,
                        classification: inc.classification,
                        address: inc.address,
                        reportedAgo: fmtAgo(inc.reported_at),
                        status: inc.status,
                        statusTone: statusTone(inc.status),
                        calls: `${inc.call_count ?? 0} calls`,
                        units: proposedUnits(inc.id),
                      }}
                      actions={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIncidentFocus(inc)}
                        >
                          Detail
                        </Button>
                      }
                    />
                  ))
                )}
              </div>
            </Panel>

            <Panel
              title="Inbound calls"
              led={callList.some((c) => Boolean(c.live)) ? "pulse" : "off"}
              right={`${callList.length} records`}
              bodyClassName="max-h-[520px] space-y-4 overflow-y-auto"
            >
              {calls.data === null && calls.loading ? (
                skeletonCards(2)
              ) : callList.length === 0 ? (
                <PanelEmpty text="No inbound traffic on the wire" />
              ) : (
                callList.map((c: Call) => (
                  <CallCard
                    key={c.id}
                    call={{
                      caller: c.caller_name?.trim() || "Unknown caller",
                      number: c.caller_number || "—",
                      duration:
                        c.duration_s != null
                          ? fmtDuration(c.duration_s)
                          : c.live
                            ? "LIVE"
                            : "—",
                      transcript:
                        c.transcript || c.summary || "Transcript pending…",
                      extracted: asStringList(c.extracted),
                      live: Boolean(c.live),
                    }}
                  />
                ))
              )}
            </Panel>
          </div>

          {/* center — human-in-the-loop approvals + fleet readiness */}
          <div className="space-y-6 xl:col-span-4">
            <Panel
              title="Pending dispatch approvals"
              led={pendingDispatches.length > 0 ? "pulse" : "off"}
              right={`${pendingDispatches.length} queued`}
              chamfered
              bodyClassName="space-y-4"
            >
              {notice && (
                <Alert tone={notice.error ? "critical" : "ok"}>
                  {notice.text}
                </Alert>
              )}
              {dispatches.data === null && dispatches.loading ? (
                skeletonCards(2)
              ) : pendingDispatches.length === 0 ? (
                <PanelEmpty text="Queue clear — no proposals awaiting operator" />
              ) : (
                pendingDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="border border-flame/15 bg-smoke/40"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-flame/10 px-3.5 py-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Led tone="blaze" pulse size="sm" />
                        <span className="truncate font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                          {d.id}
                        </span>
                        <Badge
                          tone={
                            d.incident_priority
                              ? statusTone(d.incident_priority)
                              : "plain"
                          }
                        >
                          {d.incident_priority ?? "P?"}
                        </Badge>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                        {fmtAgo(d.created_at)}
                      </span>
                    </div>
                    <div className="space-y-2.5 px-3.5 py-3">
                      <div>
                        <div className="font-display text-xs font-bold uppercase tracking-[0.12em] text-bone">
                          {d.incident_classification ?? d.incident_id}
                        </div>
                        <div className="font-mono text-[10px] tracking-wider text-bone/60">
                          {d.incident_address ?? d.incident_id}
                        </div>
                      </div>
                      <ChipGroup label="Units" items={d.vehicle_ids} />
                      <ChipGroup label="Crew" items={d.personnel_ids} />
                      <ChipGroup label="Kit" items={d.equipment_ids} />
                      {d.notes && (
                        <p className="border-l-2 border-blaze/40 pl-2.5 text-[11px] leading-relaxed text-bone/70">
                          {d.notes}
                        </p>
                      )}
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                        proposed_by {d.proposed_by} {"//"} awaiting operator
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-flame/10 px-3.5 py-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDispatchFocus(d)}
                      >
                        Detail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={acting}
                        onClick={() => void decide(d, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="solid"
                        size="sm"
                        led="pulse"
                        disabled={acting}
                        onClick={() => void decide(d, "approve")}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
              {dispatches.data !== null && (
                <>
                  <Divider label="decided" className="pt-1" />
                  {decidedDispatches.length === 0 ? (
                    <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                      No decisions on record
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {decidedDispatches.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-3 border border-ash/10 bg-smoke/30 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Badge tone={DISPATCH_TONE[d.status]}>
                              {d.status}
                            </Badge>
                            <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">
                              {d.id} —{" "}
                              {d.incident_classification ?? d.incident_id}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                            {d.decided_at
                              ? `${fmtClock(d.decided_at)} · ${fmtAgo(d.decided_at)}`
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Panel>

            <Panel
              title="Fleet readiness"
              led="on"
              right={`${unitsReady}/${totalVehicles} ready`}
              bodyClassName="space-y-4"
            >
              {ov === null ? (
                skeletonCards(1)
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
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button variant="outline" size="sm" href="/vehicles">
                      Fleet deck
                    </Button>
                    <Button variant="ghost" size="sm" href="/equipment">
                      Equipment
                    </Button>
                    <Button variant="ghost" size="sm" href="/people">
                      People
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          </div>

          {/* right — ops feed + agent link */}
          <div className="space-y-6 lg:col-span-2 xl:col-span-3">
            <Panel
              title="Ops feed"
              led={backendDown ? "off" : "on"}
              right={`${feedLines.length} rows`}
              bodyClassName="max-h-[460px] overflow-y-auto"
            >
              {events.data === null && events.loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : feedLines.length === 0 ? (
                <PanelEmpty text="Feed empty — no events logged" />
              ) : (
                <LogFeed lines={feedLines} />
              )}
            </Panel>

            <LlmChat />
          </div>
        </section>
      </main>

      <footer className="border-t border-flame/15 bg-ink/70">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          <span>
            api {API_HOST} {"//"}{" "}
            {backendDown ? "link down — retrying" : "uplink stable"}
          </span>
          <span className="hidden md:inline">
            {ov ? `${ov.station.code} // ${ov.station.name}` : "station —"}
          </span>
          <span>
            poll {POLL_MS / 1000}s {"//"}{" "}
            {nightMode ? "night watch // auto-approve" : "human-approved dispatch"}
          </span>
        </div>
      </footer>

      {/* dispatch detail + confirm */}
      <Modal
        open={dispatchFocus !== null}
        onClose={() => {
          if (!acting) setDispatchFocus(null);
        }}
        title={dispatchFocus ? `Dispatch ${dispatchFocus.id}` : undefined}
        led="blaze"
        footer={
          dispatchFocus ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={acting}
                onClick={() => setDispatchFocus(null)}
              >
                Abort
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={acting}
                onClick={() => void decide(dispatchFocus, "reject")}
              >
                Reject
              </Button>
              <Button
                variant="solid"
                size="sm"
                led="pulse"
                disabled={acting}
                onClick={() => void decide(dispatchFocus, "approve")}
              >
                Approve dispatch
              </Button>
            </>
          ) : undefined
        }
      >
        {dispatchFocus && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  dispatchFocus.incident_priority
                    ? statusTone(dispatchFocus.incident_priority)
                    : "plain"
                }
              >
                {dispatchFocus.incident_priority ?? "P?"}
              </Badge>
              <Badge tone="warm">pending</Badge>
              <Badge tone="dead">by {dispatchFocus.proposed_by}</Badge>
            </div>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
                {dispatchFocus.incident_classification ??
                  dispatchFocus.incident_id}
              </div>
              <div className="font-mono text-[11px] tracking-wider text-bone/70">
                {dispatchFocus.incident_address ?? dispatchFocus.incident_id}
              </div>
            </div>
            <div className="space-y-2">
              <ChipGroup label="Units" items={dispatchFocus.vehicle_ids} />
              <ChipGroup label="Crew" items={dispatchFocus.personnel_ids} />
              <ChipGroup label="Kit" items={dispatchFocus.equipment_ids} />
            </div>
            {dispatchFocus.notes && (
              <p className="border-l-2 border-blaze/40 pl-3 text-xs leading-relaxed text-bone/75">
                {dispatchFocus.notes}
              </p>
            )}
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
              proposed {fmtAgo(dispatchFocus.created_at)} {"//"} incident{" "}
              {dispatchFocus.incident_id}
            </div>
            <Divider label="operator approval required" />
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ash">
              Agent-proposed dispatch holds until an operator confirms. Approve
              commits listed units and marks them dispatched; reject returns the
              plan to the agent.
            </p>
          </div>
        )}
      </Modal>

      {/* incident detail */}
      <Modal
        open={incidentFocus !== null}
        onClose={() => setIncidentFocus(null)}
        title={incidentFocus ? `Incident ${incidentFocus.id}` : undefined}
        led="flame"
        footer={
          incidentFocus ? (
            <>
              <Button
                variant="outline"
                size="sm"
                href={api.reportUrl(incidentFocus.id)}
              >
                Report PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIncidentFocus(null)}
              >
                Close
              </Button>
            </>
          ) : undefined
        }
      >
        {incidentView && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(incidentView.priority)}>
                {incidentView.priority}
              </Badge>
              <Badge tone={statusTone(incidentView.status)}>
                {incidentView.status}
              </Badge>
            </div>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
                {incidentView.classification || "Unclassified"}
              </div>
              <div className="font-mono text-[11px] tracking-wider text-bone/70">
                {incidentView.address || "—"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-[10px] uppercase tracking-[0.2em]">
              <div>
                <div className="text-ash">Reported</div>
                <div className="mt-0.5 text-bone/80">
                  {fmtAgo(incidentView.reported_at)}
                </div>
              </div>
              <div>
                <div className="text-ash">Reports</div>
                <div className="mt-0.5 text-bone/80">
                  {incidentView.call_count ?? 0} calls {"//"}{" "}
                  {incidentView.unit_count ?? 0} units
                </div>
              </div>
            </div>
            <WeatherStrip
              wind={incidentView.wind || "—"}
              windDir={incidentView.wind_dir || undefined}
              temp={
                incidentView.temp_c != null
                  ? `${Math.round(incidentView.temp_c)}°C`
                  : "—"
              }
              humidity={
                incidentView.humidity_pct != null
                  ? `${Math.round(incidentView.humidity_pct)}%`
                  : "—"
              }
              precip={incidentView.precip || "—"}
            />
            {incidentView.notes && (
              <p className="border-l-2 border-flame/40 pl-3 text-xs leading-relaxed text-bone/75">
                {incidentView.notes}
              </p>
            )}
            {pendingDispatches
              .filter((d) => d.incident_id === incidentView.id)
              .map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setIncidentFocus(null);
                    setDispatchFocus(d);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border border-blaze/30 bg-wine/40 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-blaze transition-colors hover:border-blaze/60"
                >
                  <span>
                    {d.id} — proposal awaiting review
                  </span>
                  <span>review ›</span>
                </button>
              ))}
            <Divider label="external agencies" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                Alert service:
              </span>
              {EXTERNAL_SERVICES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={contactBusy}
                  onClick={() => void contactService(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
            {contactError && (
              <Alert tone="critical" title="External contact failed">
                {contactError}
              </Alert>
            )}
            {(incidentView.external_contacts ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(incidentView.external_contacts ?? []).map((c, i) => (
                  <div
                    key={`${c.service}-${c.ts}-${i}`}
                    className="flex items-center justify-between gap-3 border border-ash/10 bg-smoke/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    <span className="text-bone/80">{c.service} notified</span>
                    <span className="text-ash">
                      {fmtClock(c.ts)} · {fmtAgo(c.ts)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                No external services contacted on this incident
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* operator manual dispatch */}
      <NewDispatchModal
        open={newDispatchOpen}
        onClose={() => setNewDispatchOpen(false)}
        onCreated={(d) => {
          setNewDispatchOpen(false);
          setNotice({
            error: false,
            text: `${d.id} deployed // operator dispatch auto-approved — units committed`,
          });
          refreshAll();
        }}
      />
    </div>
  );
}
