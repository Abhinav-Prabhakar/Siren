"use client";

import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  CallCard,
  CrewChip,
  DataTable,
  Divider,
  Panel,
  Skeleton,
  Timeline,
  WeatherStrip,
  type TimelineItem,
} from "@/components/ui";
import {
  api,
  fmtAgo,
  fmtClock,
  fmtDuration,
  statusTone,
  type Dispatch,
  type Event,
  type IncidentDetail,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

const POLL_MS = 4000;
const EVENT_LIMIT = 100;

const CONTACT_SERVICES = [
  { id: "ems", label: "EMS" },
  { id: "police", label: "Police" },
  { id: "utility", label: "Utility" },
] as const;

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

function Meta({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-bone/80">{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/60">
      {text} {"//"}
    </p>
  );
}

/**
 * Chronological story of the incident — milestones derived from real record
 * fields (reported/resolved, calls, dispatches, external contacts) merged with
 * any backend event rows that name the incident id. Nothing invented.
 */
function buildTimeline(inc: IncidentDetail, events: Event[]): TimelineItem[] {
  const items: { ts: string; item: TimelineItem }[] = [];
  const seen = new Set<string>();
  const push = (
    ts: string | null | undefined,
    item: Omit<TimelineItem, "time">,
  ) => {
    if (!ts || seen.has(ts)) return;
    seen.add(ts);
    items.push({ ts, item: { time: fmtClock(ts), ...item } });
  };

  push(inc.reported_at, {
    title: "Incident reported",
    detail: `${inc.classification || "unclassified"} // ${inc.address || "no address"}`,
    tone: "flame",
  });

  for (const c of inc.calls) {
    push(c.started_at, {
      title: `Call ${c.id}${c.live ? " — live" : ""}`,
      detail: `${c.caller_name || "unknown caller"} // ${c.caller_number || "no number"} // ${c.duration_s != null ? fmtDuration(c.duration_s) : "in progress"}`,
      tone: c.live ? "flame" : "bone",
    });
    push(c.ended_at, { title: `Call ${c.id} ended`, tone: "ash" });
  }

  for (const d of inc.dispatches) {
    const units = `${d.vehicle_ids.length}u ${d.personnel_ids.length}p ${d.equipment_ids.length}e`;
    push(d.created_at, {
      title: `Dispatch ${d.id} proposed`,
      detail: `by ${d.proposed_by} // ${units}`,
      tone: "bone",
    });
    push(d.decided_at, {
      title: `Dispatch ${d.id} ${d.status}`,
      detail: d.notes || undefined,
      tone: d.status === "rejected" ? "ash" : "flame",
    });
  }

  for (const ct of inc.external_contacts ?? []) {
    push(ct.ts, { title: `External contact // ${ct.service}`, tone: "bone" });
  }

  push(inc.resolved_at, { title: "Incident resolved", tone: "ash" });

  // backend event-log rows that name this incident
  for (const e of events) {
    if (!e.message.toLowerCase().includes(inc.id.toLowerCase())) continue;
    push(e.ts, {
      title: e.message,
      detail: e.tag ? `tag ${e.tag}` : undefined,
      tone: e.tone,
    });
  }

  items.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return items.map((i) => i.item);
}

/**
 * Live incident record — polls api.incident + api.events while mounted.
 * Remount per selection (key={id}) so stale detail never leaks across records.
 */
export function IncidentDetailPanel({ id }: { id: string }) {
  const { data, error, loading, refresh } = usePolling(
    () =>
      Promise.all([
        api.incident(id),
        api.events(EVENT_LIMIT).catch(() => [] as Event[]),
      ]),
    POLL_MS,
  );

  const inc = data?.[0] ?? null;
  const events = data?.[1] ?? [];

  const [acting, setActing] = useState<string | null>(null);
  const [contacting, setContacting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(d: Dispatch, intent: "approve" | "reject") {
    if (acting) return;
    setActing(`${d.id}:${intent}`);
    setActionError(null);
    try {
      if (intent === "approve") await api.approveDispatch(d.id);
      else await api.rejectDispatch(d.id);
      refresh();
    } catch (e) {
      setActionError(
        `${d.id} // ${intent} failed — ${e instanceof Error ? e.message : "request failed"}`,
      );
    } finally {
      setActing(null);
    }
  }

  async function contact(service: string) {
    if (contacting) return;
    setContacting(service);
    setActionError(null);
    try {
      await api.contactService(id, service);
      refresh();
    } catch (e) {
      setActionError(
        `contact ${service} failed — ${e instanceof Error ? e.message : "request failed"}`,
      );
    } finally {
      setContacting(null);
    }
  }

  const contacts = inc?.external_contacts ?? [];
  const timeline = inc ? buildTimeline(inc, events) : [];

  return (
    <Panel
      title={`Incident record // ${id}`}
      led={inc?.status === "active" ? "pulse" : "on"}
      right={
        inc ? (
          <Button
            variant="outline"
            size="sm"
            led="on"
            href={api.reportUrl(inc.id)}
          >
            Download report
          </Button>
        ) : undefined
      }
    >
      {loading && !inc ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-28" />
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      ) : error && !inc ? (
        <Alert tone="critical" title="Backend unreachable at localhost:8000">
          Incident record {id} could not be loaded — {error}. Polling continues
          every 4s.
        </Alert>
      ) : inc ? (
        <div className="space-y-5">
          {error && (
            <Alert tone="warning" title="Link unstable — showing last sync">
              {error}
            </Alert>
          )}
          {actionError && (
            <Alert tone="warning" title="Action failed">
              {actionError}
            </Alert>
          )}

          {/* identity strip */}
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl font-black uppercase tracking-[0.1em] text-bone">
              {inc.classification || "Unclassified"}
            </h3>
            <Badge tone={statusTone(inc.priority)}>{inc.priority}</Badge>
            <Badge tone={statusTone(inc.status)}>{inc.status}</Badge>
          </div>

          {/* meta grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border border-flame/15 bg-ink/60 p-4 sm:grid-cols-3">
            <Meta label="Incident">{inc.id}</Meta>
            <Meta label="Classification">{inc.classification || "—"}</Meta>
            <Meta label="Priority">
              <Badge tone={statusTone(inc.priority)} noDot>
                {inc.priority}
              </Badge>
            </Meta>
            <Meta label="Status">
              <Badge tone={statusTone(inc.status)} noDot>
                {inc.status}
              </Badge>
            </Meta>
            <Meta label="Address" className="col-span-2">
              {inc.address || "—"}
            </Meta>
            <Meta label="Coords">
              {inc.lat != null && inc.lng != null
                ? `${inc.lat.toFixed(4)} / ${inc.lng.toFixed(4)}`
                : "—"}
            </Meta>
            <Meta label="Reported">
              {fmtAgo(inc.reported_at)} {"//"} {fmtClock(inc.reported_at)}
            </Meta>
            <Meta label="Resolved">
              {inc.resolved_at
                ? `${fmtAgo(inc.resolved_at)} // ${fmtClock(inc.resolved_at)}`
                : "—"}
            </Meta>
            {inc.notes ? (
              <Meta label="Notes" className="col-span-2 sm:col-span-3">
                <span className="normal-case tracking-normal">{inc.notes}</span>
              </Meta>
            ) : null}
          </div>

          {/* on-scene weather */}
          <div>
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
              On-scene weather
            </div>
            <WeatherStrip
              wind={inc.wind || "—"}
              windDir={inc.wind_dir || undefined}
              temp={inc.temp_c != null ? `${Math.round(inc.temp_c)}°C` : "—"}
              humidity={
                inc.humidity_pct != null ? `${Math.round(inc.humidity_pct)}%` : "—"
              }
              precip={inc.precip || "—"}
            />
          </div>

          {/* responding units */}
          <Divider label={`Responding units // ${inc.vehicles.length}`} />
          {inc.vehicles.length > 0 ? (
            <DataTable
              dense
              columns={[
                { key: "callsign", label: "Callsign" },
                { key: "unit", label: "Unit" },
                { key: "type", label: "Type" },
                { key: "status", label: "Status" },
                { key: "speed", label: "Speed", align: "right" },
                { key: "upd", label: "Updated", align: "right" },
              ]}
              rows={inc.vehicles.map((v) => ({
                callsign: (
                  <span className="font-mono text-[11px] text-bone">
                    {v.callsign}
                  </span>
                ),
                unit: <span className="text-xs text-bone/80">{v.name}</span>,
                type: (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
                    {v.type}
                  </span>
                ),
                status: (
                  <Badge tone={statusTone(v.status)} noDot>
                    {v.status.replace(/_/g, " ")}
                  </Badge>
                ),
                speed: (
                  <span className="font-mono text-[11px] text-bone/80">
                    {Math.round(v.speed_kmh)} km/h
                  </span>
                ),
                upd: (
                  <span className="font-mono text-[10px] text-ash">
                    {fmtAgo(v.updated_at)}
                  </span>
                ),
              }))}
            />
          ) : (
            <EmptyLine text="No units assigned" />
          )}

          {/* crew */}
          <Divider label={`Crew on incident // ${inc.personnel.length}`} />
          {inc.personnel.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {inc.personnel.map((p) => (
                <CrewChip
                  key={p.id}
                  member={{
                    name: p.name,
                    role: `${p.rank} ${p.role}`,
                    status: p.status.replace(/_/g, " "),
                    onDuty:
                      p.status !== "off_duty" && p.status !== "resting",
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyLine text="No personnel assigned" />
          )}

          {/* calls */}
          <Divider label={`Calls // ${inc.calls.length}`} />
          {inc.calls.length > 0 ? (
            <div className="space-y-4">
              {inc.calls.map((c) => (
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
              ))}
            </div>
          ) : (
            <EmptyLine text="No calls linked to this incident" />
          )}

          {/* dispatches */}
          <Divider label={`Dispatches // ${inc.dispatches.length}`} />
          {inc.dispatches.length > 0 ? (
            <DataTable
              dense
              columns={[
                { key: "id", label: "Dispatch" },
                { key: "status", label: "Status" },
                { key: "by", label: "By" },
                { key: "units", label: "Units" },
                { key: "created", label: "Created" },
                { key: "decided", label: "Decided" },
                { key: "act", label: "", align: "right" },
              ]}
              rows={inc.dispatches.map((d) => ({
                id: (
                  <span className="font-mono text-[11px] text-bone">{d.id}</span>
                ),
                status: (
                  <Badge tone={statusTone(d.status)} noDot>
                    {d.status}
                  </Badge>
                ),
                by: (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
                    {d.proposed_by}
                  </span>
                ),
                units: (
                  <span className="font-mono text-[10px] text-bone/70">
                    {d.vehicle_ids.join(", ") || "—"}
                  </span>
                ),
                created: (
                  <span className="font-mono text-[10px] text-ash">
                    {fmtClock(d.created_at)}
                  </span>
                ),
                decided: (
                  <span className="font-mono text-[10px] text-ash">
                    {d.decided_at ? fmtClock(d.decided_at) : "—"}
                  </span>
                ),
                act:
                  d.status === "pending" ? (
                    <span className="inline-flex gap-2">
                      <Button
                        variant="solid"
                        size="sm"
                        disabled={acting !== null}
                        onClick={() => void decide(d, "approve")}
                      >
                        {acting === `${d.id}:approve` ? "…" : "Approve"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={acting !== null}
                        onClick={() => void decide(d, "reject")}
                      >
                        {acting === `${d.id}:reject` ? "…" : "Reject"}
                      </Button>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-ash/50">—</span>
                  ),
              }))}
            />
          ) : (
            <EmptyLine text="No dispatches for this incident" />
          )}

          {/* external contacts — real operator contact records */}
          <Divider label={`External contacts // ${contacts.length}`} />
          <div className="flex flex-wrap gap-3">
            {CONTACT_SERVICES.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                led={contacting === s.id ? "pulse" : "off"}
                disabled={contacting !== null}
                onClick={() => void contact(s.id)}
              >
                {contacting === s.id
                  ? `Contacting ${s.label}…`
                  : `Contact ${s.label}`}
              </Button>
            ))}
          </div>
          {contacts.length > 0 ? (
            <DataTable
              dense
              columns={[
                { key: "service", label: "Service" },
                { key: "ts", label: "Contacted", align: "right" },
              ]}
              rows={contacts.map((ct) => ({
                service: (
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-bone">
                    {ct.service}
                  </span>
                ),
                ts: (
                  <span className="font-mono text-[10px] text-ash">
                    {fmtClock(ct.ts)} {"//"} {fmtAgo(ct.ts)}
                  </span>
                ),
              }))}
            />
          ) : (
            <EmptyLine text="No external services contacted" />
          )}

          {/* event log */}
          <Divider label={`Event log // ${timeline.length}`} />
          {timeline.length > 0 ? (
            <Timeline items={timeline} />
          ) : (
            <EmptyLine text="No logged events for this incident" />
          )}
        </div>
      ) : null}
    </Panel>
  );
}
