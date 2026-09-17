"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ConsoleNav } from "@/components/console-nav";
import { LlmChat } from "@/components/chat/llm-chat";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Led,
  Modal,
  Panel,
  Skeleton,
  Switch,
  WeatherStrip,
  type BadgeTone,
} from "@/components/ui";
import { CallWire } from "@/components/console/call-wire";
import { StatusStrip } from "@/components/console/status-strip";
import { NewDispatchModal } from "@/components/console/new-dispatch-modal";
import { IncidentLogCard } from "@/components/incidents/incident-log-card";
import {
  CLASSIFICATION_ICONS,
  classificationKey,
  DISPATCH_ICON_FALLBACK,
  DISPATCH_ICONS,
} from "@/components/incidents/incident-icons";
import { GlyphTile, PriorityMark } from "@/components/incidents/marks";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type Dispatch,
  type DispatchStatus,
  type Incident,
  type IncidentDetail,
  type IncidentPriority,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

const PRIORITY_RANK: Record<IncidentPriority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

/** Priority rail on the left edge of a proposal row. */
const PROPOSAL_RAIL: Record<BadgeTone, string> = {
  hot: "bg-flame shadow-[2px_0_12px_-2px_rgb(255_46_46/0.7)]",
  warm: "bg-blaze",
  cold: "bg-bone/40",
  dead: "bg-ash/30",
  plain: "bg-flame/50",
};

/** Decided-dispatch rows get a glyph + tone, never a badge. */
const DECIDE_ICON_CLS: Record<DispatchStatus, string> = {
  pending: "text-blaze",
  approved: "text-flame",
  rejected: "text-ash/50",
  completed: "text-bone/70",
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

/** Icon-headed id chips — a resource manifest read, not a label. */
function Manifest({
  icon: Icon,
  items,
  max = 4,
}: {
  icon: LucideIcon;
  items: string[];
  max?: number;
}) {
  if (items.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-flame/70" />
      {items.slice(0, max).map((id) => (
        <span
          key={id}
          className="clip-tag bg-smoke px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone/75 [--chamfer:4px]"
        >
          {id}
        </span>
      ))}
      {items.length > max && (
        <span className="font-mono text-[9px] tracking-[0.15em] text-ash">
          +{items.length - max}
        </span>
      )}
    </span>
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

  const activeIncidents = [...(incidents.data ?? [])].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );

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

  const firstError =
    overview.error ??
    incidents.error ??
    calls.error ??
    dispatches.error ??
    settings.error;
  const hasData =
    overview.data !== null ||
    incidents.data !== null ||
    calls.data !== null ||
    dispatches.data !== null;
  /* error + nothing on screen → critical; error + stale data → warning */
  const backendDown = firstError !== null && !hasData;
  const staleData = firstError !== null && hasData;

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
          <Alert tone="critical" title="Backend unreachable">
            Telemetry uplink lost — polling keeps retrying every 4 s and the
            control room self-heals when the API returns. Last error:{" "}
            {firstError}
          </Alert>
        )}
        {staleData && (
          <Alert tone="warning" title="Uplink degraded — showing last-known state">
            One or more feeds failed the last refresh; figures below may be
            stale until the API answers again. Last error: {firstError}
          </Alert>
        )}

        {/* slim ops bar — station identity left, operator actions right */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em]">
            <Led
              tone={backendDown ? "off" : "blaze"}
              size="sm"
              pulse={!backendDown}
            />
            <span className="text-bone/80">
              {ov ? ov.station.name : "uplink pending"}
            </span>
            {ov && (
              <span className="hidden text-ash sm:inline">
                {"//"} {ov.station.address}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {nightMode && <Badge tone="hot">AUTO-DISPATCH ARMED</Badge>}
            <Switch
              label="Night watch"
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
        </div>

        {/* command strip — posture, threat, wx, wire at a glance */}
        <StatusStrip
          overview={ov}
          activeIncidents={activeIncidents}
          pendingCount={pendingDispatches.length}
          liveCalls={callList.filter((c) => Boolean(c.live)).length}
          loading={overview.loading}
          onSelectIncident={setIncidentFocus}
        />

        {/* main board */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
          {/* left — incidents + inbound calls */}
          <div className="space-y-6 xl:col-span-4">
            <Panel
              title="Active incidents"
              led={activeIncidents.length > 0 ? "pulse" : "off"}
              right={`${activeIncidents.length} on board`}
              bodyClassName="max-h-[560px] space-y-3 overflow-y-auto"
            >
              {incidents.data === null && incidents.loading ? (
                skeletonCards(2)
              ) : activeIncidents.length === 0 ? (
                <PanelEmpty text="No active incidents — all quiet on the wire" />
              ) : (
                activeIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setIncidentFocus(inc)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIncidentFocus(inc);
                      }
                    }}
                    className="cursor-pointer transition-shadow hover:shadow-[0_0_24px_-8px_rgb(255_46_46/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame"
                  >
                    <IncidentLogCard incident={inc} />
                  </div>
                ))
              )}
            </Panel>

            <Panel
              title="Inbound calls"
              led={callList.some((c) => Boolean(c.live)) ? "pulse" : "off"}
              right={`${callList.length} records`}
              bodyClassName="max-h-[520px] overflow-y-auto p-0"
            >
              {calls.data === null && calls.loading ? (
                <div className="space-y-4 p-4">{skeletonCards(2)}</div>
              ) : callList.length === 0 ? (
                <div className="p-4">
                  <PanelEmpty text="No inbound traffic on the wire" />
                </div>
              ) : (
                <CallWire calls={callList} extracted={asStringList} />
              )}
            </Panel>
          </div>

          {/* center — human-in-the-loop approvals */}
          <div className="space-y-6 xl:col-span-5">
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
                <div className="divide-y divide-flame/10">
                  {pendingDispatches.map((d) => {
                    const tone = d.incident_priority
                      ? statusTone(d.incident_priority)
                      : "plain";
                    const ClassIcon =
                      CLASSIFICATION_ICONS[
                        classificationKey(d.incident_classification ?? "")
                      ];
                    return (
                      <div key={d.id} className="flex items-stretch">
                        <span
                          aria-hidden
                          className={cn("w-1 shrink-0", PROPOSAL_RAIL[tone])}
                        />
                        <div className="min-w-0 flex-1 px-3.5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <GlyphTile icon={ClassIcon} size="md" />
                            <div className="min-w-0">
                              <div className="truncate font-display text-xs font-bold uppercase tracking-[0.12em] text-bone">
                                {d.incident_classification ?? d.incident_id}
                              </div>
                              <div className="truncate font-mono text-[9px] tracking-[0.15em] text-bone/55">
                                {d.incident_address ?? d.incident_id}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            {d.incident_priority && (
                              <PriorityMark priority={d.incident_priority} />
                            )}
                            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                              {fmtAgo(d.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <Manifest icon={Truck} items={d.vehicle_ids} />
                          <Manifest icon={Users} items={d.personnel_ids} />
                          <Manifest icon={Package} items={d.equipment_ids} />
                        </div>

                        {d.notes && (
                          <p className="mt-2 truncate border-l-2 border-blaze/40 pl-2 text-[10px] leading-relaxed text-bone/60">
                            {d.notes}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-end gap-2">
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
                      </div>
                    );
                  })}
                </div>
              )}
              {dispatches.data !== null && (
                <>
                  <Divider label="decided" className="pt-1" />
                  {decidedDispatches.length === 0 ? (
                    <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                      No decisions on record
                    </div>
                  ) : (
                    <div className="divide-y divide-ash/10">
                      {decidedDispatches.map((d) => {
                        const DecideIcon =
                          DISPATCH_ICONS[d.status] ?? DISPATCH_ICON_FALLBACK;
                        return (
                          <div
                            key={d.id}
                            className="flex items-center gap-2.5 px-1 py-2"
                          >
                            <DecideIcon
                              aria-hidden
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                DECIDE_ICON_CLS[d.status],
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">
                              {d.id} —{" "}
                              {d.incident_classification ?? d.incident_id}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                              {d.decided_at
                                ? `${fmtClock(d.decided_at)} · ${fmtAgo(d.decided_at)}`
                                : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>

          {/* right — agent link rail */}
          <div className="space-y-6 lg:col-span-2 xl:col-span-3">
            <LlmChat />
          </div>
        </section>
      </main>

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
              <Manifest
                icon={Truck}
                items={dispatchFocus.vehicle_ids}
                max={8}
              />
              <Manifest
                icon={Users}
                items={dispatchFocus.personnel_ids}
                max={8}
              />
              <Manifest
                icon={Package}
                items={dispatchFocus.equipment_ids}
                max={8}
              />
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
