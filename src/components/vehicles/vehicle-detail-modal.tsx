"use client";

import {
  Activity,
  Crosshair,
  Droplets,
  FlaskConical,
  Gauge,
  MapPin,
  Route,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Alert,
  Badge,
  Led,
  Modal,
  Skeleton,
  Sparkline,
} from "@/components/ui";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type Equipment,
  type Incident,
  type Personnel,
  type PersonnelStatus,
  type VehicleDetail,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/equipment/monitoring";
import { ROLE_SHORT } from "@/components/people/lib";
import { Minimap } from "@/components/resources/minimap";
import { targetOf } from "@/components/resources/vehicle-shared";
import { Silhouette } from "@/components/resources/vehicle-gauges";

/** battery_v (~11.5–14.4v) → 0–100 for the tank board. */
function batteryPct(v: number): number {
  return Math.round(Math.max(0, Math.min(100, ((v - 11.5) / 2.9) * 100)));
}

const SEGS = 14;

function MicroBar({ value, low }: { value: number; low?: boolean }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGS);
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: SEGS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1",
            i < filled ? (low ? "bg-flame" : "bg-blaze/80") : "bg-smoke",
          )}
        />
      ))}
    </span>
  );
}

/** One tank row — icon | segmented fill | readout. */
function TankBar({
  icon: Icon,
  value,
  display,
  lowAt = 20,
}: {
  icon: LucideIcon;
  value: number;
  display: string;
  lowAt?: number;
}) {
  const low = value <= lowAt;
  return (
    <div className="flex items-center gap-3">
      <Icon
        aria-hidden
        strokeWidth={2}
        className={cn("h-4 w-4 shrink-0", low ? "text-flame" : "text-ash")}
      />
      <div className="min-w-0 flex-1">
        <MicroBar value={value} low={low} />
      </div>
      <span
        className={cn(
          "w-14 shrink-0 text-right font-mono text-[10px] tabular-nums tracking-[0.1em]",
          low ? "text-flame" : "text-bone/80",
        )}
      >
        {display}
      </span>
    </div>
  );
}

/** Flat telemetry trace — label line + sparkline, no cell. */
function Trace({
  label,
  unit,
  series,
}: {
  label: string;
  unit: string;
  series: number[];
}) {
  const latest = series[series.length - 1];
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.25em]">
        <span className="text-ash">{label} {"//"}</span>
        <span className="tabular-nums text-bone/80">
          {latest !== undefined ? `${latest.toFixed(1)} ${unit}` : "—"}
        </span>
      </div>
      {series.length > 1 ? (
        <Sparkline
          data={series}
          width={300}
          height={36}
          className="mt-1.5 w-full"
        />
      ) : (
        <div className="mt-1.5 flex h-9 items-center font-mono text-[9px] uppercase tracking-[0.25em] text-ash/60">
          awaiting telemetry //
        </div>
      )}
    </div>
  );
}

/** One icon + readout pair in the drive line. */
function Metric({
  icon: Icon,
  value,
  unit,
}: {
  icon: LucideIcon;
  value: string;
  unit?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon
        aria-hidden
        strokeWidth={2}
        className="h-4 w-4 shrink-0 text-flame/70"
      />
      <span className="font-display text-base font-bold tabular-nums text-bone">
        {value}
      </span>
      {unit && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
          {unit}
        </span>
      )}
    </span>
  );
}

const CREW_ICON: Record<PersonnelStatus, string> = {
  on_scene: "text-flame",
  en_route: "text-blaze",
  dispatched: "text-blaze",
  on_duty: "text-bone/80",
  resting: "text-ash",
  off_duty: "text-ash/50",
};

function CrewSeat({ p }: { p: Personnel }) {
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${p.name} — ${p.rank} ${p.role} // ${p.status.replace(/_/g, " ")}`}
    >
      <User
        aria-hidden
        strokeWidth={2}
        className={cn("h-4 w-4 shrink-0", CREW_ICON[p.status])}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone/80">
        {p.name.split(" ").slice(-1)[0]}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ash/70">
        {ROLE_SHORT[p.role]}
      </span>
    </span>
  );
}

function KitRow({ e }: { e: Equipment }) {
  const worn = e.condition_pct <= 40;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <CategoryIcon category={e.category} size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-bone/80">
        {e.name}
      </span>
      <span className="w-16 shrink-0">
        <MicroBar value={e.condition_pct} low={worn} />
      </span>
      <span
        className={cn(
          "w-9 shrink-0 text-right font-mono text-[9px] tabular-nums",
          worn ? "text-flame" : "text-ash",
        )}
      >
        {Math.round(e.condition_pct)}%
      </span>
      <Led
        tone={e.status === "ready" ? "bone" : e.status === "in_use" ? "flame" : "off"}
        size="sm"
      />
    </div>
  );
}

function DetailBody({
  v,
  fuelSeries,
  speedSeries,
  target,
}: {
  v: VehicleDetail;
  fuelSeries: number[];
  speedSeries: number[];
  target: { lat: number; lng: number } | null;
}) {
  const tone = statusTone(v.status);
  const dead = v.status === "out_of_service";

  return (
    <div className={cn("space-y-5", dead && "saturate-50")}>
      {/* identity */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl font-black uppercase tracking-[0.1em] text-bone">
            {v.name}
          </h3>
          <Badge tone={tone}>{v.status.replace(/_/g, " ")}</Badge>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
          {v.callsign} {"//"} {v.type} {"//"} {v.station_id}
          {v.free_at && ` · free ${fmtClock(v.free_at)}`}
        </span>
      </div>

      {/* committed */}
      {v.incident_id && (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-flame">
          <Crosshair aria-hidden className="h-3.5 w-3.5" />
          committed → {v.incident_id}
        </div>
      )}

      {/* schematic — the apparatus IS the fuel gauge */}
      <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="justify-self-center text-center">
          <Silhouette v={v} className="h-16 w-[168px]" />
          <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
            fuel{" "}
            <span
              className={cn(
                "tabular-nums",
                v.fuel_pct <= 20 ? "text-flame" : "text-bone/80",
              )}
            >
              {Math.round(v.fuel_pct)}%
            </span>
          </div>
        </div>
        <div className="space-y-2.5">
          <TankBar
            icon={Droplets}
            value={v.water_pct}
            display={`${Math.round(v.water_pct)}%`}
          />
          <TankBar
            icon={FlaskConical}
            value={v.foam_pct}
            display={`${Math.round(v.foam_pct)}%`}
          />
          <TankBar
            icon={Zap}
            value={batteryPct(v.battery_v)}
            display={`${v.battery_v.toFixed(1)}v`}
          />
        </div>
      </div>

      {/* drive line */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Metric
          icon={Gauge}
          value={String(Math.round(v.speed_kmh))}
          unit="km/h"
        />
        <Metric
          icon={Activity}
          value={v.pump_pressure_bar.toFixed(1)}
          unit="bar"
        />
        <Metric
          icon={Route}
          value={Math.round(v.mileage_km).toLocaleString("en-US")}
          unit="km"
        />
        <Metric
          icon={MapPin}
          value={`${Math.abs(v.lat).toFixed(2)}°${v.lat >= 0 ? "N" : "S"} ${Math.abs(v.lng).toFixed(2)}°${v.lng >= 0 ? "E" : "W"}`}
        />
        <span className="ml-auto flex items-center gap-3">
          <Minimap v={v} target={target} />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
            upd {fmtAgo(v.updated_at)}
          </span>
        </span>
      </div>

      {/* traces */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Trace label="fuel" unit="%" series={fuelSeries} />
        <Trace label="speed" unit="km/h" series={speedSeries} />
      </div>

      {/* crew manifest */}
      <div>
        <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
          crew {"//"} {v.crew.length || "none"}
        </div>
        {v.crew.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {v.crew.map((p) => (
              <CrewSeat key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/60">
            riding empty //
          </div>
        )}
      </div>

      {/* mounted kit */}
      {v.equipment.length > 0 && (
        <div>
          <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
            mounted kit {"//"} {v.equipment.length}
          </div>
          <div className="divide-y divide-ash/10">
            {v.equipment.map((e) => (
              <KitRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Live unit record — polls api.vehicle + telemetry while open.
 * Mount only when a vehicle is selected.
 */
export function VehicleDetailModal({
  id,
  incidents,
  station,
  onClose,
}: {
  id: string;
  incidents: Incident[];
  station: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const { data, error, loading } = usePolling(
    () =>
      Promise.all([
        api.vehicle(id),
        api.telemetry("vehicle", id, "fuel_pct", 60),
        api.telemetry("vehicle", id, "speed_kmh", 60),
      ]),
    4000,
  );

  const v = data?.[0] ?? null;
  const fuelSeries = data?.[1].map((p) => p.value) ?? [];
  const speedSeries = data?.[2].map((p) => p.value) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={v ? `${v.callsign} // unit record` : "Unit record"}
      led={v && statusTone(v.status) === "hot" ? "flame" : "bone"}
      className="max-w-2xl"
    >
      {loading && !v ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-28" />
          <Skeleton className="h-16" />
          <Skeleton className="h-20" />
        </div>
      ) : error && !v ? (
        <Alert tone="critical" title="Uplink lost">
          Unit record for {id} could not be loaded — {error}. Polling continues
          every 4s.
        </Alert>
      ) : v ? (
        <div className="space-y-4">
          {error && (
            <Alert tone="warning" title="Uplink degraded">
              {error} — showing last synced record; polling continues every 4s.
            </Alert>
          )}
          <DetailBody
            v={v}
            fuelSeries={fuelSeries}
            speedSeries={speedSeries}
            target={targetOf(v, incidents, station)}
          />
        </div>
      ) : null}
    </Modal>
  );
}
