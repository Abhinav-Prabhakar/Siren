"use client";

import { useState } from "react";
import {
  Clock,
  FileDown,
  Flag,
  Gauge,
  Hash,
  History,
  MapPin,
  Navigation,
  NotebookPen,
  Package,
  Phone,
  PhoneOutgoing,
  Send,
  Truck,
  Users,
  Wind,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CallCard,
  CrewChip,
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
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_ICONS,
  DISPATCH_ICON_FALLBACK,
  DISPATCH_ICONS,
  SERVICE_ICON_FALLBACK,
  SERVICE_ICONS,
  VEHICLE_ICON_FALLBACK,
  VEHICLE_ICONS,
  classificationKey,
  toneTextClass,
} from "./incident-icons";
import {
  GlyphTile,
  MetaCell,
  PriorityMark,
  SectionHead,
  StatusChip,
} from "./marks";

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

/** One responding apparatus — type glyph, callsign, live speed, status. */
function UnitRow({ v }: { v: IncidentDetail["vehicles"][number] }) {
  const VIcon = VEHICLE_ICONS[v.type] ?? VEHICLE_ICON_FALLBACK;
  return (
    <div className="flex items-center gap-3 border border-flame/10 bg-ink/50 px-3 py-2">
      <GlyphTile icon={VIcon} className="border-flame/15 bg-smoke/60" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-bone">
            {v.callsign}
          </span>
          <span className="truncate text-[11px] text-bone/60">{v.name}</span>
        </div>
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
          {v.type}
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] tracking-wider text-bone/75">
          <Gauge aria-hidden className="h-3 w-3 text-ash" />
          {Math.round(v.speed_kmh)} km/h
        </div>
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ash/70">
          upd {fmtAgo(v.updated_at)}
        </div>
      </div>
      <Badge tone={statusTone(v.status)} noDot className="shrink-0">
        {v.status.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}

/**
 * One dispatch order — status glyph, resource counts, decision actions.
 * Approve/reject stay inline for pending proposals.
 */
function DispatchRow({
  d,
  acting,
  onDecide,
}: {
  d: Dispatch;
  acting: string | null;
  onDecide: (d: Dispatch, intent: "approve" | "reject") => void;
}) {
  const DIcon = DISPATCH_ICONS[d.status] ?? DISPATCH_ICON_FALLBACK;
  return (
    <div className="border border-flame/10 bg-ink/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <DIcon
          aria-hidden
          className={cn("h-3.5 w-3.5 shrink-0", toneTextClass(statusTone(d.status)))}
        />
        <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-bone">
          {d.id}
        </span>
        <Badge tone={statusTone(d.status)} noDot>
          {d.status}
        </Badge>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
          by {d.proposed_by}
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-bone/70">
          <span className="flex items-center gap-1" title="vehicles">
            <Truck aria-hidden className="h-3 w-3 text-flame/70" />
            {d.vehicle_ids.length}
          </span>
          <span className="flex items-center gap-1" title="personnel">
            <Users aria-hidden className="h-3 w-3 text-flame/70" />
            {d.personnel_ids.length}
          </span>
          <span className="flex items-center gap-1" title="equipment">
            <Package aria-hidden className="h-3 w-3 text-flame/70" />
            {d.equipment_ids.length}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
          <Clock aria-hidden className="h-3 w-3" />
          {fmtClock(d.created_at)}
        </span>
        {d.decided_at && (
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
            <Flag aria-hidden className="h-3 w-3" />
            decided {fmtClock(d.decided_at)}
          </span>
        )}
        {d.notes ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash/80">
            {d.notes}
          </span>
        ) : null}
        {d.status === "pending" && (
          <span className="ml-auto inline-flex gap-2">
            <Button
              variant="solid"
              size="sm"
              disabled={acting !== null}
              onClick={() => onDecide(d, "approve")}
            >
              {acting === `${d.id}:approve` ? "…" : "Approve"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={acting !== null}
              onClick={() => onDecide(d, "reject")}
            >
              {acting === `${d.id}:reject` ? "…" : "Reject"}
            </Button>
          </span>
        )}
      </div>
    </div>
  );
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
  const ClassIcon = inc
    ? CLASSIFICATION_ICONS[classificationKey(inc.classification)]
    : null;

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
            <span className="inline-flex items-center gap-1.5">
              <FileDown aria-hidden className="h-3 w-3" />
              Report
            </span>
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

          {/* hero — classification glyph, status, priority, meta grid */}
          <div className="relative overflow-hidden border border-flame/20 bg-gradient-to-br from-wine/50 via-coal to-ink">
            {ClassIcon && (
              <ClassIcon
                aria-hidden
                strokeWidth={1}
                className="pointer-events-none absolute -right-5 -top-6 h-32 w-32 text-flame/[0.07]"
              />
            )}
            <div className="relative flex items-center gap-4 p-4">
              {ClassIcon && <GlyphTile icon={ClassIcon} size="lg" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  <Hash aria-hidden className="h-3 w-3 text-flame/60" />
                  {inc.id}
                </div>
                <h3 className="mt-0.5 font-display text-xl font-black uppercase tracking-[0.08em] text-bone">
                  {inc.classification || "Unclassified"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <StatusChip status={inc.status} />
                  <PriorityMark priority={inc.priority} />
                </div>
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-px border-t border-flame/15 bg-flame/10 sm:grid-cols-4">
              <MetaCell icon={MapPin} label="Address" className="col-span-2">
                {inc.address || "—"}
              </MetaCell>
              <MetaCell icon={Clock} label="Reported">
                {fmtClock(inc.reported_at)} {"//"} {fmtAgo(inc.reported_at)}
              </MetaCell>
              <MetaCell icon={Flag} label="Resolved">
                {inc.resolved_at
                  ? `${fmtClock(inc.resolved_at)} // ${fmtAgo(inc.resolved_at)}`
                  : "open"}
              </MetaCell>
              <MetaCell
                icon={Navigation}
                label="Coords"
                className="col-span-2 sm:col-span-1"
              >
                {inc.lat != null && inc.lng != null
                  ? `${inc.lat.toFixed(4)} / ${inc.lng.toFixed(4)}`
                  : "—"}
              </MetaCell>
              {inc.notes ? (
                <MetaCell
                  icon={NotebookPen}
                  label="Notes"
                  className="col-span-2 sm:col-span-3"
                >
                  <span className="normal-case tracking-normal">
                    {inc.notes}
                  </span>
                </MetaCell>
              ) : null}
            </div>
          </div>

          {/* on-scene weather */}
          <section className="space-y-2.5">
            <SectionHead icon={Wind} label="On-scene weather" />
            <WeatherStrip
              wind={inc.wind || "—"}
              windDir={inc.wind_dir || undefined}
              temp={inc.temp_c != null ? `${Math.round(inc.temp_c)}°C` : "—"}
              humidity={
                inc.humidity_pct != null ? `${Math.round(inc.humidity_pct)}%` : "—"
              }
              precip={inc.precip || "—"}
            />
          </section>

          {/* responding units */}
          <section className="space-y-2.5">
            <SectionHead
              icon={Truck}
              label="Responding units"
              count={inc.vehicles.length}
            />
            {inc.vehicles.length > 0 ? (
              <div className="space-y-1.5">
                {inc.vehicles.map((v) => (
                  <UnitRow key={v.id} v={v} />
                ))}
              </div>
            ) : (
              <EmptyLine text="No units assigned" />
            )}
          </section>

          {/* crew */}
          <section className="space-y-2.5">
            <SectionHead
              icon={Users}
              label="Crew on incident"
              count={inc.personnel.length}
            />
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
          </section>

          {/* calls */}
          <section className="space-y-2.5">
            <SectionHead
              icon={Phone}
              label="Linked calls"
              count={inc.calls.length}
            />
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
          </section>

          {/* dispatches */}
          <section className="space-y-2.5">
            <SectionHead
              icon={Send}
              label="Dispatches"
              count={inc.dispatches.length}
            />
            {inc.dispatches.length > 0 ? (
              <div className="space-y-1.5">
                {inc.dispatches.map((d) => (
                  <DispatchRow
                    key={d.id}
                    d={d}
                    acting={acting}
                    onDecide={(dd, intent) => void decide(dd, intent)}
                  />
                ))}
              </div>
            ) : (
              <EmptyLine text="No dispatches for this incident" />
            )}
          </section>

          {/* external contacts — real operator contact records */}
          <section className="space-y-2.5">
            <SectionHead
              icon={PhoneOutgoing}
              label="External contacts"
              count={contacts.length}
            />
            <div className="flex flex-wrap gap-3">
              {CONTACT_SERVICES.map((s) => {
                const SIcon = SERVICE_ICONS[s.id] ?? SERVICE_ICON_FALLBACK;
                return (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    led={contacting === s.id ? "pulse" : "off"}
                    disabled={contacting !== null}
                    onClick={() => void contact(s.id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <SIcon aria-hidden className="h-3 w-3" />
                      {contacting === s.id
                        ? `Contacting ${s.label}…`
                        : `Contact ${s.label}`}
                    </span>
                  </Button>
                );
              })}
            </div>
            {contacts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contacts.map((ct, i) => {
                  const SIcon =
                    SERVICE_ICONS[ct.service.toLowerCase()] ??
                    SERVICE_ICON_FALLBACK;
                  return (
                    <span
                      key={`${ct.service}-${ct.ts}-${i}`}
                      className="clip-tag inline-flex items-center gap-1.5 bg-smoke px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/80 [--chamfer:4px]"
                    >
                      <SIcon
                        aria-hidden
                        className="h-3 w-3 text-flame/80"
                      />
                      {ct.service}
                      <span className="text-ash">
                        {fmtClock(ct.ts)} {"//"} {fmtAgo(ct.ts)}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <EmptyLine text="No external services contacted" />
            )}
          </section>

          {/* event log */}
          <section className="space-y-2.5">
            <SectionHead
              icon={History}
              label="Event log"
              count={timeline.length}
            />
            {timeline.length > 0 ? (
              <Timeline items={timeline} />
            ) : (
              <EmptyLine text="No logged events for this incident" />
            )}
          </section>
        </div>
      ) : null}
    </Panel>
  );
}
