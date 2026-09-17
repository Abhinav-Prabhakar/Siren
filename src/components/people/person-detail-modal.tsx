"use client";

import {
  Building2,
  Crosshair,
  Heart,
  MapPin,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type PersonnelDetail,
  type TelemetryPoint,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";
import { dutyLed, ROLE_LABELS, vitalsAlert } from "./lib";

interface PersonData {
  person: PersonnelDetail;
  hr: TelemetryPoint[];
  scba: TelemetryPoint[];
}

/** icon + trailing text for the assignment line. */
function IconField({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-bone/75">
      <Icon
        aria-hidden
        strokeWidth={2}
        className="h-3.5 w-3.5 shrink-0 text-flame/70"
      />
      <span className="truncate">{text}</span>
    </span>
  );
}

/** Air cylinder — the fill drains bottom-up as SCBA % drops. */
function ScbaCylinder({ pct, className }: { pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  const low = v < 25;
  const innerH = 38;
  const fill = (innerH * v) / 100;
  return (
    <svg viewBox="0 0 20 48" className={cn("h-12 w-5", className)} aria-hidden>
      <rect x="7" y="1" width="6" height="4" className="fill-ash/40" />
      <rect
        x="4"
        y="6"
        width="12"
        height="40"
        fill="none"
        strokeWidth="1.2"
        className={low ? "stroke-flame" : "stroke-ash/50"}
      />
      <rect
        x="5.5"
        y={7 + (innerH - fill)}
        width="9"
        height={Math.max(fill - 1, 0)}
        className={low ? "fill-flame" : "fill-blaze/80"}
      />
    </svg>
  );
}

/** Elapsed-time bar for the watch window — ◆ is "now" (last telemetry). */
function ShiftBar({
  start,
  end,
  now,
}: {
  start: string;
  end: string;
  now: number;
}) {
  const s = Date.parse(start);
  const e = Date.parse(end);
  const frac = Math.max(
    0,
    Math.min(1, (now - s) / Math.max(e - s, 1)),
  );
  const overdue = now > e;
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.25em]">
        <span className="text-ash">watch {fmtClock(start)}</span>
        <span className={overdue ? "text-flame" : "text-ash"}>
          {overdue ? "relief due //" : `relief ${fmtClock(end)}`}
        </span>
      </div>
      <div className="relative mt-2 h-1.5 bg-smoke">
        <div
          className={cn("h-full", overdue ? "bg-flame" : "bg-blaze/80")}
          style={{ width: `${frac * 100}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-[3px] h-3 w-[3px] rotate-45 bg-bone"
          style={{ left: `calc(${frac * 100}% - 1.5px)` }}
        />
      </div>
    </div>
  );
}

/** One vital — glyph + big readout + flat trace. */
function Vital({
  glyph,
  label,
  value,
  unit,
  hot,
  points,
}: {
  glyph: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  hot: boolean;
  points: TelemetryPoint[];
}) {
  const data = points.map((pt) => pt.value);
  return (
    <div>
      <div className="flex items-center gap-3">
        {glyph}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-display text-2xl font-black tabular-nums leading-none",
              hot ? "text-flame text-glow" : "text-bone",
            )}
          >
            {Math.round(value)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
            {unit} {"//"} {label}
          </span>
        </div>
      </div>
      {data.length >= 2 ? (
        <Sparkline
          data={data}
          width={240}
          height={30}
          className="mt-2 w-full"
        />
      ) : (
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash/60">
          no telemetry on record
        </div>
      )}
    </div>
  );
}

/** Live personnel dossier — vitals monitor, assignment, shift window. */
export function PersonDetailModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, error, loading } = usePolling<PersonData>(async () => {
    const [person, hr, scba] = await Promise.all([
      api.person(id),
      api.telemetry("personnel", id, "heart_rate"),
      api.telemetry("personnel", id, "scba_pct"),
    ]);
    return { person, hr, scba };
  }, 4000);

  const p = data?.person;
  const flag = p ? vitalsAlert(p) : null;
  const lamp = p ? dutyLed(p.status) : { tone: "off" as const, pulse: false };

  return (
    <Modal
      open
      onClose={onClose}
      led={flag === "critical" ? "flame" : lamp.tone}
      title={p ? `${p.name} // ${p.id}` : `Personnel // ${id}`}
      className="max-w-xl"
    >
      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error && !data ? (
        <Alert tone="critical" title="Link lost">
          Personnel record unreachable — {error}.
        </Alert>
      ) : p ? (
        <div className="space-y-5">
          {error && (
            <Alert tone="warning" title="Uplink degraded">
              {error} — showing last synced record; polling continues every 4s.
            </Alert>
          )}

          {/* status line */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={statusTone(p.status)}>
              {p.status.replace(/_/g, " ")}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              {p.rank} {"//"} {ROLE_LABELS[p.role]}
            </span>
            {flag === "critical" && <Badge tone="hot">Vitals alert</Badge>}
            {flag === "warning" && <Badge tone="warm">Vitals watch</Badge>}
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
              seen {fmtAgo(p.updated_at)}
            </span>
          </div>

          {/* vitals monitor — the heart literally beats at bpm */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Vital
              glyph={
                <Heart
                  aria-hidden
                  strokeWidth={2}
                  fill="currentColor"
                  className={cn(
                    "animate-heartbeat h-6 w-6",
                    p.heart_rate > 160 ? "text-flame" : "text-flame/80",
                  )}
                  style={{
                    animationDuration: `${60 / Math.max(p.heart_rate, 40)}s`,
                  }}
                />
              }
              label="heart rate"
              value={p.heart_rate}
              unit="bpm"
              hot={p.heart_rate > 160}
              points={data.hr}
            />
            <Vital
              glyph={<ScbaCylinder pct={p.scba_pct} />}
              label="scba air"
              value={p.scba_pct}
              unit="%"
              hot={p.scba_pct < 25}
              points={data.scba}
            />
          </div>

          {/* assignment */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <IconField icon={Truck} text={p.vehicle_name ?? "no unit"} />
            <IconField
              icon={Crosshair}
              text={p.incident_address ?? "no incident"}
            />
            <IconField
              icon={MapPin}
              text={`${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`}
            />
            <IconField icon={Building2} text={p.station_id} />
          </div>

          {/* watch window — "now" is the freshest telemetry stamp */}
          <ShiftBar
            start={p.shift_start}
            end={p.shift_end}
            now={Date.parse(p.updated_at)}
          />
        </div>
      ) : null}
    </Modal>
  );
}
