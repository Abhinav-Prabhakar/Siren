"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  Crosshair,
  Droplets,
  FileDown,
  Flag,
  Gauge,
  Heart,
  History,
  MapPin,
  Navigation,
  NotebookPen,
  Package,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Radio,
  RadioTower,
  Send,
  Siren,
  Sun,
  Thermometer,
  Truck,
  Users,
  Wind,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Alert,
  Button,
  Compass,
  Panel,
  Skeleton,
  Timeline,
  windDeg,
  type TimelineItem,
} from "@/components/ui";
import { CallWire } from "@/components/console/call-wire";
import { Silhouette } from "@/components/resources/vehicle-gauges";
import {
  api,
  fmtAgo,
  fmtClock,
  fmtDuration,
  fmtElapsed,
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
  classificationKey,
  toneTextClass,
} from "./incident-icons";
import {
  PriorityMark,
  SectionHead,
  StatusChip,
} from "./marks";
import { SectorScope, type ScopeBlip } from "./sector-scope";

const POLL_MS = 4000;
const EVENT_LIMIT = 100;

const CONTACT_SERVICES = [
  { id: "ems", label: "EMS" },
  { id: "police", label: "Police" },
  { id: "utility", label: "Utility" },
] as const;

/* status stamps — decided orders read as stamps, never badges */
const STAMP_TONE: Record<string, string> = {
  pending: "border-blaze/50 text-blaze",
  approved: "border-flame/50 text-flame",
  completed: "border-bone/30 text-bone/70",
  rejected: "border-ash/30 text-ash/60",
};

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

/* precip is free text — keyword-match to a glyph key, never the component */
const PRECIP_ICONS = {
  storm: CloudRain,
  rain: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  clear: Sun,
  default: Cloud,
} satisfies Record<string, LucideIcon>;

const PRECIP_RULES: [RegExp, keyof typeof PRECIP_ICONS][] = [
  [/storm|lightning|thunder/, "storm"],
  [/rain|drizzle|shower/, "rain"],
  [/snow|hail|sleet/, "snow"],
  [/fog|mist|haze|smoke/, "fog"],
  [/none|clear|dry/, "clear"],
];

function precipKey(precip: string | undefined): keyof typeof PRECIP_ICONS {
  const s = (precip ?? "").toLowerCase();
  for (const [re, key] of PRECIP_RULES) {
    if (re.test(s)) return key;
  }
  return "default";
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
    icon: Siren,
  });

  for (const c of inc.calls) {
    push(c.started_at, {
      title: `Call ${c.id}${c.live ? " — live" : ""}`,
      detail: `${c.caller_name || "unknown caller"} // ${c.caller_number || "no number"} // ${c.duration_s != null ? fmtDuration(c.duration_s) : "in progress"}`,
      tone: c.live ? "flame" : "bone",
      icon: c.live ? PhoneCall : Phone,
    });
    push(c.ended_at, {
      title: `Call ${c.id} ended`,
      tone: "ash",
      icon: PhoneOff,
    });
  }

  for (const d of inc.dispatches) {
    const units = `${d.vehicle_ids.length}u ${d.personnel_ids.length}p ${d.equipment_ids.length}e`;
    push(d.created_at, {
      title: `Dispatch ${d.id} proposed`,
      detail: `by ${d.proposed_by} // ${units}`,
      tone: "bone",
      icon: Send,
    });
    push(d.decided_at, {
      title: `Dispatch ${d.id} ${d.status}`,
      detail: d.notes || undefined,
      tone: d.status === "rejected" ? "ash" : "flame",
      icon: d.status === "rejected" ? XCircle : CheckCircle2,
    });
  }

  for (const ct of inc.external_contacts ?? []) {
    push(ct.ts, {
      title: `External contact // ${ct.service}`,
      tone: "bone",
      icon: RadioTower,
    });
  }

  push(inc.resolved_at, {
    title: "Incident resolved",
    tone: "ash",
    icon: Flag,
  });

  // backend event-log rows that name this incident
  for (const e of events) {
    if (!e.message.toLowerCase().includes(inc.id.toLowerCase())) continue;
    push(e.ts, {
      title: e.message,
      detail: e.tag ? `tag ${e.tag}` : undefined,
      tone: e.tone,
      icon: Radio,
    });
  }

  items.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return items.map((i) => i.item);
}

/* ---------- instruments ---------- */

/** Thin readout bar for the WX console — label, fill, value. */
function WxBar({
  label,
  pct,
  value,
  icon: Icon,
}: {
  label: string;
  /** 0–100 fill */
  pct: number | null;
  value: string;
  icon: LucideIcon;
}) {
  const v = pct === null ? null : Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-flame/70" />
      <span className="w-14 shrink-0 font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
        {label}
      </span>
      <span className="h-[5px] min-w-0 flex-1 bg-smoke">
        {v !== null && (
          <span
            className="block h-full bg-gradient-to-r from-blood via-flame/80 to-flame"
            style={{ width: `${v}%` }}
          />
        )}
      </span>
      <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-bone/80">
        {value}
      </span>
    </div>
  );
}

/**
 * WX console — compass dial + thin readout bars, no cells.
 * Wind is a needle, temp/humidity are bars, precip is a sky glyph.
 */
function WxConsole({ inc }: { inc: IncidentDetail }) {
  const PrecipIcon = PRECIP_ICONS[precipKey(inc.precip)];
  return (
    <div className="flex items-center gap-4 p-3.5">
      <Compass deg={windDeg(inc.wind_dir)} dim={!inc.wind_dir} />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline gap-2 font-mono text-[11px] tracking-[0.1em]">
          <Wind aria-hidden className="h-3 w-3 translate-y-px text-flame/70" />
          <span className="text-bone">{inc.wind || "—"}</span>
          <span className="text-flame/80">{inc.wind_dir || ""}</span>
          <span className="ml-auto text-[8px] uppercase tracking-[0.25em] text-ash">
            wind
          </span>
        </div>
        <WxBar
          icon={Thermometer}
          label="temp"
          pct={inc.temp_c != null ? (inc.temp_c / 50) * 100 : null}
          value={inc.temp_c != null ? `${Math.round(inc.temp_c)}°c` : "—"}
        />
        <WxBar
          icon={Droplets}
          label="humid"
          pct={inc.humidity_pct}
          value={
            inc.humidity_pct != null ? `${Math.round(inc.humidity_pct)}%` : "—"
          }
        />
        <div className="flex items-center gap-2.5">
          <PrecipIcon
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-flame/70"
          />
          <span className="w-14 shrink-0 font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
            precip
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-bone/80">
            {inc.precip || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * One responding apparatus — its own silhouette IS the readout (fill level
 * tracks fuel), flanked by callsign, live speed and status.
 */
function UnitRow({ v }: { v: IncidentDetail["vehicles"][number] }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-flame/10 py-2 last:border-b-0">
      <Silhouette v={v} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-bone">
            {v.callsign}
          </span>
          <span className="truncate text-[11px] text-bone/60">{v.name}</span>
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
      <span
        className={cn(
          "shrink-0 font-mono text-[8px] uppercase tracking-[0.2em]",
          toneTextClass(statusTone(v.status)),
        )}
      >
        {v.status.replace(/_/g, " ")}
      </span>
    </div>
  );
}

/**
 * One responder as a vitals strip — the heart literally beats at their bpm,
 * SCBA reads as a segmented air bar. People pulse; machines roll.
 */
function VitalRow({ p }: { p: IncidentDetail["personnel"][number] }) {
  const bpm = Math.round(p.heart_rate);
  const scba = Math.max(0, Math.min(100, p.scba_pct));
  const low = scba < 25;
  const segs = Math.round(scba / 10);
  return (
    <div className="flex items-center gap-3.5 border-b border-flame/10 py-2.5 last:border-b-0">
      <Heart
        aria-hidden
        fill="currentColor"
        className={cn(
          "animate-heartbeat h-4 w-4 shrink-0",
          bpm > 160 ? "text-flame" : "text-flame/75",
        )}
        style={{ animationDuration: `${60 / Math.max(bpm, 40)}s` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[12px] font-bold uppercase tracking-[0.1em] text-bone">
            {p.name}
          </span>
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
            {p.rank} {p.role.replace(/_/g, " ")}
          </span>
        </div>
      </div>
      <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-bone/70 sm:block">
        {bpm}
      </span>
      <span
        className="flex shrink-0 items-center gap-1.5"
        title={`scba ${Math.round(scba)}%`}
      >
        <span className="flex gap-[2px]">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-[3px]",
                i < segs
                  ? low
                    ? "bg-flame"
                    : "bg-bone/55"
                  : "bg-smoke",
                low && i === segs - 1 && "animate-pulse",
              )}
            />
          ))}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-bone/70">
          {Math.round(scba)}%
        </span>
      </span>
      <span
        className={cn(
          "hidden shrink-0 font-mono text-[8px] uppercase tracking-[0.2em] md:block",
          toneTextClass(statusTone(p.status)),
        )}
      >
        {p.status.replace(/_/g, " ")}
      </span>
    </div>
  );
}

/**
 * One dispatch order as a perforated ticket — status glyph stub on the left,
 * stamped state word, resource counts as icon tallies. Pending tickets carry
 * a hazard edge and keep their approve/reject actions inline.
 */
function DispatchTicket({
  d,
  acting,
  onDecide,
}: {
  d: Dispatch;
  acting: string | null;
  onDecide: (d: Dispatch, intent: "approve" | "reject") => void;
}) {
  const DIcon = DISPATCH_ICONS[d.status] ?? DISPATCH_ICON_FALLBACK;
  const pending = d.status === "pending";
  return (
    <div
      className={cn(
        "flex items-stretch border",
        pending ? "border-blaze/30" : "border-flame/10",
      )}
    >
      {/* stub — status glyph on a perforated edge */}
      <span className="relative flex w-11 shrink-0 items-center justify-center border-r border-dashed border-flame/25">
        {pending && (
          <span
            aria-hidden
            className="bg-hazard-tight absolute inset-y-0 left-0 w-[3px]"
          />
        )}
        <DIcon
          aria-hidden
          className={cn(
            "h-4 w-4",
            toneTextClass(statusTone(d.status)),
            pending && "animate-pulse",
          )}
        />
      </span>

      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-bone">
            {d.id}
          </span>
          <span
            className={cn(
              "border px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-[0.25em]",
              STAMP_TONE[d.status] ?? STAMP_TONE.rejected,
            )}
          >
            {d.status}
          </span>
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
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
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
            <span className="truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash/80">
              {d.notes}
            </span>
          ) : null}
          {pending && (
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
  const unitBlips: ScopeBlip[] = inc
    ? inc.vehicles.map((v) => ({
        id: v.id,
        lat: v.lat,
        lng: v.lng,
        tone: statusTone(v.status),
        label: v.callsign,
        pulse:
          v.status === "en_route" ||
          v.status === "dispatched" ||
          v.status === "on_scene",
      }))
    : [];

  return (
    <Panel
      title="Incident record"
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

          {/* hero — glyph, classification, chips, T+ mission clock */}
          <div className="relative overflow-hidden bg-gradient-to-br from-wine/50 via-coal to-ink">
            {ClassIcon && (
              <ClassIcon
                aria-hidden
                strokeWidth={1}
                className="pointer-events-none absolute -right-5 -top-6 h-32 w-32 text-flame/[0.07]"
              />
            )}
            <div className="relative flex flex-wrap items-center gap-4 p-4">
              {ClassIcon && (
                <ClassIcon
                  aria-hidden
                  strokeWidth={1.5}
                  className="h-11 w-11 shrink-0 text-flame"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
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
              {/* elapsed mission clock — the record's heartbeat */}
              <div className="ml-auto shrink-0 text-right">
                <div
                  className={cn(
                    "font-display text-[26px] font-black tabular-nums leading-none tracking-[0.04em]",
                    inc.status === "active"
                      ? "text-glow text-flame"
                      : "text-bone/80",
                  )}
                >
                  {fmtElapsed(inc.reported_at)}
                </div>
                <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.28em] text-ash">
                  elapsed
                </div>
              </div>
            </div>
            {/* readout line — icon fields, no cells */}
            <div className="relative flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-flame/15 px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] text-bone/70">
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin aria-hidden className="h-3 w-3 shrink-0 text-flame/70" />
                <span className="truncate">{inc.address || "—"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock aria-hidden className="h-3 w-3 shrink-0 text-flame/70" />
                {fmtClock(inc.reported_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Flag aria-hidden className="h-3 w-3 shrink-0 text-flame/70" />
                {inc.resolved_at ? fmtClock(inc.resolved_at) : "open"}
              </span>
              <span className="flex items-center gap-1.5">
                <Navigation
                  aria-hidden
                  className="h-3 w-3 shrink-0 text-flame/70"
                />
                {inc.lat != null && inc.lng != null
                  ? `${inc.lat.toFixed(4)} / ${inc.lng.toFixed(4)}`
                  : "—"}
              </span>
              {inc.notes ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <NotebookPen
                    aria-hidden
                    className="h-3 w-3 shrink-0 text-flame/70"
                  />
                  <span className="truncate normal-case tracking-normal text-bone/60">
                    {inc.notes}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* scene picture — AO plot + WX console in one instrument */}
          <section className="space-y-2.5">
            <SectionHead icon={Crosshair} label="Scene picture" />
            <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-flame/10">
              <SectorScope
                blips={unitBlips}
                center={{ lat: inc.lat, lng: inc.lng, label: "IC" }}
                anchor
                vectors
                className="h-44"
              />
              <WxConsole inc={inc} />
            </div>
          </section>

          {/* response — machines left, humans right */}
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <section className="space-y-1">
              <SectionHead
                icon={Truck}
                label="Responding units"
                count={inc.vehicles.length}
              />
              {inc.vehicles.length > 0 ? (
                <div>
                  {inc.vehicles.map((v) => (
                    <UnitRow key={v.id} v={v} />
                  ))}
                </div>
              ) : (
                <EmptyLine text="No units assigned" />
              )}
            </section>

            {/* crew — vitals strips, hearts beat at real bpm */}
            <section className="space-y-1">
              <SectionHead
                icon={Users}
                label="Crew on incident"
                count={inc.personnel.length}
              />
              {inc.personnel.length > 0 ? (
                <div>
                  {inc.personnel.map((p) => (
                    <VitalRow key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <EmptyLine text="No personnel assigned" />
              )}
            </section>
          </div>

          {/* dispatches — perforated order tickets */}
          <section className="space-y-2.5">
            <SectionHead
              icon={Send}
              label="Dispatches"
              count={inc.dispatches.length}
            />
            {inc.dispatches.length > 0 ? (
              <div className="space-y-1.5">
                {inc.dispatches.map((d) => (
                  <DispatchTicket
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

          {/* comms — the wire left, outbound contacts right */}
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <section className="space-y-2.5">
              <SectionHead
                icon={Phone}
                label="Linked calls"
                count={inc.calls.length}
              />
              {inc.calls.length > 0 ? (
                <CallWire calls={inc.calls} extracted={asStringList} />
              ) : (
                <EmptyLine text="No calls linked to this incident" />
              )}
            </section>

            <section className="space-y-2.5">
              <SectionHead
                icon={PhoneOutgoing}
                label="External contacts"
                count={contacts.length}
              />
              <div className="flex flex-wrap gap-2.5">
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
          </div>

          {/* event log — typed glyph nodes on the rail */}
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
