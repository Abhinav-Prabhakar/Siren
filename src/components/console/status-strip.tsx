"use client";

import {
  CloudRain,
  Droplets,
  Eye,
  Flame,
  Hourglass,
  Package,
  PhoneCall,
  Radio,
  ShieldCheck,
  Siren,
  Thermometer,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { RadialGauge, Skeleton } from "@/components/ui";
import {
  fmtClock,
  type Incident,
  type IncidentPriority,
  type Overview,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/* ---------- strength pips — one square per entity, colour = status ---------- */

type PipTone = "hot" | "warm" | "cold" | "dead" | "down";

const PIP_CLASS: Record<PipTone, string> = {
  hot: "bg-flame shadow-[0_0_5px_rgb(255_46_46/0.8)]",
  warm: "bg-blaze",
  cold: "bg-bone/55",
  dead: "bg-ash/40",
  down: "bg-ash/15",
};

interface PipSpec {
  tone: PipTone;
  pulse?: boolean;
}

/* order = paint order: committed first, ready next, dark last */
const VEHICLE_PIPS: Record<string, PipSpec> = {
  on_scene: { tone: "hot", pulse: true },
  en_route: { tone: "warm" },
  dispatched: { tone: "warm" },
  available: { tone: "cold" },
  returning: { tone: "dead" },
  refuel: { tone: "dead" },
  out_of_service: { tone: "down" },
};

const PERSONNEL_PIPS: Record<string, PipSpec> = {
  on_scene: { tone: "hot", pulse: true },
  en_route: { tone: "warm" },
  dispatched: { tone: "warm" },
  on_duty: { tone: "cold" },
  resting: { tone: "dead" },
  off_duty: { tone: "down" },
};

const EQUIPMENT_PIPS: Record<string, PipSpec> = {
  in_use: { tone: "hot" },
  maintenance: { tone: "warm" },
  ready: { tone: "cold" },
  missing: { tone: "down" },
};

function PipRow({
  icon: Icon,
  label,
  counts,
  spec,
  ready,
  total,
}: {
  icon: LucideIcon;
  label: string;
  counts: Record<string, number>;
  spec: Record<string, PipSpec>;
  ready: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3" title={label}>
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-ash" />
      <span className="flex min-w-0 flex-1 flex-wrap gap-[3px]">
        {Object.entries(spec).flatMap(([status, s]) =>
          Array.from({ length: counts[status] ?? 0 }, (_, i) => (
            <span
              key={`${status}-${i}`}
              title={status.replace(/_/g, " ")}
              className={cn(
                "h-3 w-1.5",
                PIP_CLASS[s.tone],
                s.pulse && "animate-pulse",
              )}
            />
          )),
        )}
        {total === 0 && <span className="h-3 w-1.5 bg-smoke" />}
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums">
        <span className="text-bone">{total > 0 ? ready : "—"}</span>
        <span className="text-ash/50">/{total > 0 ? total : "—"}</span>
      </span>
    </div>
  );
}

/* ---------- threat board ---------- */

type BoardLevel = "quiet" | "watch" | "alert" | "critical";

const LEVEL_META: Record<
  BoardLevel,
  { icon: LucideIcon; text: string; cls: string; hazard: boolean }
> = {
  quiet: { icon: ShieldCheck, text: "Quiet", cls: "text-ash", hazard: false },
  watch: { icon: Eye, text: "Watch", cls: "text-bone", hazard: false },
  alert: { icon: Siren, text: "Alert", cls: "text-blaze", hazard: false },
  critical: { icon: Flame, text: "Critical", cls: "text-flame", hazard: true },
};

const P_BAR: Record<IncidentPriority, string> = {
  P1: "bg-flame shadow-[0_0_6px_rgb(255_46_46/0.7)]",
  P2: "bg-blaze",
  P3: "bg-bone/50",
  P4: "bg-ash/40",
};

function boardLevel(incidents: Incident[]): BoardLevel {
  if (incidents.some((i) => i.priority === "P1")) return "critical";
  if (incidents.some((i) => i.priority === "P2")) return "alert";
  return incidents.length > 0 ? "watch" : "quiet";
}

/* ---------- wind compass ---------- */

const COMPASS_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function windDeg(dir: string | undefined): number | undefined {
  if (!dir) return undefined;
  const s = dir.trim().toUpperCase();
  if (s in COMPASS_DEG) return COMPASS_DEG[s];
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function Compass({
  deg,
  dim = false,
}: {
  deg?: number;
  dim?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-14 w-14 shrink-0", dim && "opacity-40")}
      role="img"
      aria-label="wind compass"
    >
      <circle
        cx="24" cy="24" r="20" fill="none"
        stroke="var(--color-smoke)" strokeWidth="2.5"
      />
      {[0, 90, 180, 270].map((a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        const x1 = 24 + 20 * Math.cos(rad);
        const y1 = 24 + 20 * Math.sin(rad);
        const x2 = 24 + 15 * Math.cos(rad);
        const y2 = 24 + 15 * Math.sin(rad);
        return (
          <line
            key={a}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={a === 0 ? "var(--color-flame)" : "var(--color-ash)"}
            strokeOpacity={a === 0 ? 0.9 : 0.4}
            strokeWidth="1.5"
          />
        );
      })}
      <text
        x="24" y="11.5" textAnchor="middle"
        fill="var(--color-ash)" fontSize="5.5" fontFamily="var(--font-mono)"
      >
        N
      </text>
      {deg !== undefined && (
        <g transform={`rotate(${deg} 24 24)`}>
          <line
            x1="24" y1="24" x2="24" y2="11"
            stroke="var(--color-flame)" strokeWidth="1.5"
          />
          <polygon points="24,7 21,12.5 27,12.5" fill="var(--color-flame)" />
        </g>
      )}
      <rect
        x="22" y="22" width="4" height="4"
        transform="rotate(45 24 24)"
        fill={deg === undefined ? "var(--color-ash)" : "var(--color-flame)"}
      />
    </svg>
  );
}

/* ---------- the strip ---------- */

/**
 * Command strip — station posture at a glance, no stat cards.
 * Ring: fleet ready share. Pips: every entity as a status square.
 * Threat: DEFCON-style board state + priority histogram. WX: live
 * compass at the hottest incident. Tape: newest signal on the wire.
 */
export function StatusStrip({
  overview,
  activeIncidents,
  pendingCount,
  liveCalls,
  loading,
  onSelectIncident,
}: {
  overview: Overview | null;
  activeIncidents: Incident[];
  pendingCount: number;
  liveCalls: number;
  loading: boolean;
  onSelectIncident: (incident: Incident) => void;
}) {
  if (overview === null && loading) {
    return (
      <section className="border border-flame/15 bg-coal p-5">
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }

  const vCounts = overview?.counts.vehicles ?? {};
  const pCounts = overview?.counts.personnel ?? {};
  const eCounts = overview?.counts.equipment ?? {};

  const totalVehicles = Object.values(vCounts).reduce((a, b) => a + b, 0);
  const fleetReady = vCounts["available"] ?? 0;
  const totalCrew = Object.values(pCounts).reduce((a, b) => a + b, 0);
  const crewUp =
    (pCounts["on_duty"] ?? 0) +
    (pCounts["dispatched"] ?? 0) +
    (pCounts["en_route"] ?? 0) +
    (pCounts["on_scene"] ?? 0);
  const totalKit = Object.values(eCounts).reduce((a, b) => a + b, 0);
  const kitReady = eCounts["ready"] ?? 0;
  const fleetPct = totalVehicles > 0 ? (fleetReady / totalVehicles) * 100 : 0;

  const topIncident = [...activeIncidents].sort(
    (a, b) =>
      ({ P1: 0, P2: 1, P3: 2, P4: 3 })[a.priority] -
      ({ P1: 0, P2: 1, P3: 2, P4: 3 })[b.priority],
  )[0];

  const level = boardLevel(activeIncidents);
  const LevelIcon = LEVEL_META[level].icon;
  const pCountsByPriority = (["P1", "P2", "P3", "P4"] as const).map((p) => ({
    p,
    n: activeIncidents.filter((i) => i.priority === p).length,
  }));
  const pMax = Math.max(...pCountsByPriority.map((x) => x.n), 1);

  const events = overview?.latest_events ?? [];
  const latest = events[events.length - 1];

  return (
    <section className="border border-flame/15 bg-flame/10">
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-12">
        {/* fleet readiness ring */}
        <div className="flex items-center gap-4 bg-coal px-5 py-4 xl:col-span-2">
          <RadialGauge
            variant="ring"
            value={fleetPct}
            size={76}
            label="ready"
          />
          <div className="min-w-0">
            <div className="font-display text-2xl font-black leading-none text-bone">
              {totalVehicles > 0 ? `${fleetReady}/${totalVehicles}` : "—"}
            </div>
            <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
              fleet
            </div>
          </div>
        </div>

        {/* strength pips — fleet / crew / kit */}
        <div className="flex flex-col justify-center gap-3 bg-coal px-5 py-4 sm:col-span-2 xl:col-span-4">
          <PipRow
            icon={Truck}
            label="fleet"
            counts={vCounts}
            spec={VEHICLE_PIPS}
            ready={fleetReady}
            total={totalVehicles}
          />
          <PipRow
            icon={Users}
            label="crew"
            counts={pCounts}
            spec={PERSONNEL_PIPS}
            ready={crewUp}
            total={totalCrew}
          />
          <PipRow
            icon={Package}
            label="kit"
            counts={eCounts}
            spec={EQUIPMENT_PIPS}
            ready={kitReady}
            total={totalKit}
          />
        </div>

        {/* threat board — level + priority histogram + ops counters */}
        <div className="relative flex items-center gap-5 overflow-hidden bg-coal px-5 py-4 xl:col-span-3">
          {LEVEL_META[level].hazard && (
            <span
              aria-hidden
              className="bg-hazard-tight absolute inset-y-0 right-0 w-10 opacity-20"
            />
          )}
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <LevelIcon
                aria-hidden
                className={cn(
                  "h-4 w-4",
                  LEVEL_META[level].cls,
                  level === "critical" && "animate-pulse",
                )}
              />
              <span
                className={cn(
                  "font-display text-2xl font-black uppercase leading-none tracking-[0.08em]",
                  LEVEL_META[level].cls,
                  level === "critical" && "text-glow",
                )}
              >
                {LEVEL_META[level].text}
              </span>
            </div>
            <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
              board state
            </div>
          </div>

          {/* priority histogram — one bar per grade */}
          <div className="flex items-end gap-1.5 self-stretch pt-1">
            {pCountsByPriority.map(({ p, n }) => (
              <div key={p} className="flex w-4 flex-col items-center gap-1">
                <span
                  title={`${p} ×${n}`}
                  className={cn("w-full", P_BAR[p], n === 0 && "opacity-15")}
                  style={{
                    height: `${n > 0 ? 6 + (n / pMax) * 26 : 3}px`,
                  }}
                />
                <span className="font-mono text-[7px] tracking-[0.1em] text-ash/70">
                  {p}
                </span>
              </div>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] tabular-nums",
                pendingCount > 0 ? "text-blaze" : "text-ash/60",
              )}
              title="pending approvals"
            >
              <Hourglass
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5",
                  pendingCount > 0 && "animate-pulse",
                )}
              />
              {pendingCount}
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] tabular-nums",
                liveCalls > 0 ? "text-flame" : "text-ash/60",
              )}
              title="live calls"
            >
              <PhoneCall
                aria-hidden
                className={cn(
                  "h-3.5 w-3.5",
                  liveCalls > 0 && "animate-pulse",
                )}
              />
              {liveCalls}
            </span>
          </div>
        </div>

        {/* wx at hottest incident — compass + readouts */}
        <button
          type="button"
          disabled={!topIncident}
          onClick={() => topIncident && onSelectIncident(topIncident)}
          className={cn(
            "group flex items-center gap-4 bg-coal px-5 py-4 text-left transition-colors sm:col-span-2 xl:col-span-3",
            topIncident && "cursor-pointer hover:bg-wine/30",
          )}
        >
          <Compass
            deg={windDeg(topIncident?.wind_dir)}
            dim={!topIncident}
          />
          {topIncident ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-bone">
                <Thermometer
                  aria-hidden
                  className="h-3.5 w-3.5 text-flame/70"
                />
                {topIncident.temp_c != null
                  ? `${Math.round(topIncident.temp_c)}°C`
                  : "—"}
                <Droplets
                  aria-hidden
                  className="ml-2 h-3.5 w-3.5 text-flame/70"
                />
                {topIncident.humidity_pct != null
                  ? `${Math.round(topIncident.humidity_pct)}%`
                  : "—"}
                <CloudRain
                  aria-hidden
                  className="ml-2 h-3.5 w-3.5 text-flame/70"
                />
                {topIncident.precip || "—"}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                <span className="text-flame/80">{topIncident.id}</span>
                <span className="truncate">
                  {topIncident.classification}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
                wind {topIncident.wind || "—"}
              </div>
            </div>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash/60">
              no active incident
              <br />
              wx on standby
            </span>
          )}
        </button>
      </div>

      {/* signal tape — newest event on the wire */}
      {latest !== undefined && (
        <div className="flex items-center gap-2.5 overflow-hidden border-t border-flame/10 bg-coal px-5 py-2 font-mono text-[9px] uppercase tracking-[0.2em]">
          <Radio aria-hidden className="h-3 w-3 shrink-0 text-flame/70" />
          <span className="shrink-0 text-ash/60">{fmtClock(latest.ts)}</span>
          <span className="shrink-0 text-flame/80">[{latest.tag}]</span>
          <span
            className={cn(
              "truncate",
              latest.tone === "flame"
                ? "text-flame"
                : latest.tone === "ash"
                  ? "text-ash"
                  : "text-bone/75",
            )}
          >
            {latest.message}
          </span>
          {events.length > 1 && (
            <span className="ml-auto shrink-0 text-ash/50">
              +{events.length - 1}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
