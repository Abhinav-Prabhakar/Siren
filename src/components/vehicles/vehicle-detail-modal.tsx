"use client";

import {
  Alert,
  Badge,
  Button,
  CrewChip,
  DataTable,
  Divider,
  Meter,
  Modal,
  RadialGauge,
  Skeleton,
  Sparkline,
  Stat,
} from "@/components/ui";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type VehicleDetail,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

/** battery_v (~11.5–14.4v) → 0–100 for Meter. */
function batteryPct(v: number): number {
  return Math.round(Math.max(0, Math.min(100, ((v - 11.5) / 2.9) * 100)));
}

function TelemetryCell({
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
    <div className="border border-flame/15 bg-ink/60 p-3">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.25em]">
        <span className="text-ash">{label}</span>
        <span className="text-bone/80">
          {latest !== undefined ? `${latest.toFixed(1)} ${unit}` : "—"}
        </span>
      </div>
      {series.length > 1 ? (
        <div className="flex justify-center">
          <Sparkline data={series} width={300} height={44} />
        </div>
      ) : (
        <div className="flex h-11 items-center justify-center font-mono text-[9px] uppercase tracking-[0.25em] text-ash/60">
          awaiting telemetry //
        </div>
      )}
    </div>
  );
}

function DetailBody({
  v,
  fuelSeries,
  speedSeries,
}: {
  v: VehicleDetail;
  fuelSeries: number[];
  speedSeries: number[];
}) {
  const tone = statusTone(v.status);
  const dead = v.status === "out_of_service";

  return (
    <div className={cn("space-y-5", dead && "saturate-50")}>
      {/* identity strip */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl font-black uppercase tracking-[0.1em] text-bone">
              {v.name}
            </h3>
            <Badge tone={tone}>{v.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            {v.callsign} {"//"} {v.type} {"//"} {v.station_id}
          </p>
        </div>
        <div className="text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ash">
          <div>
            upd <span className="text-bone/80">{fmtAgo(v.updated_at)}</span>
          </div>
          <div>
            free{" "}
            <span className="text-bone/80">
              {v.free_at ? `${fmtClock(v.free_at)} (${fmtAgo(v.free_at)})` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* committed banner */}
      {v.incident_id && (
        <div className="flex items-center justify-between border border-blaze/30 bg-wine/40 px-4 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
            Assigned incident
          </span>
          <Badge tone="hot">{v.incident_id}</Badge>
        </div>
      )}

      {/* hero levels */}
      <div className="grid grid-cols-2 gap-4 border border-flame/15 bg-ink/60 p-4 lg:grid-cols-[auto_auto_1fr]">
        <RadialGauge
          value={v.fuel_pct}
          variant="ring"
          size={110}
          label="Fuel"
          className="mx-auto"
        />
        <RadialGauge
          value={v.water_pct}
          variant="ring"
          size={110}
          label="Water"
          className="mx-auto"
        />
        <div className="col-span-2 flex flex-col justify-center gap-5 lg:col-span-1">
          <Meter label="Foam concentrate" value={v.foam_pct} lowAt={20} />
          <Meter
            label={`Battery // ${v.battery_v.toFixed(1)}v`}
            value={batteryPct(v.battery_v)}
            lowAt={20}
          />
        </div>
      </div>

      {/* telemetry history */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TelemetryCell label="Fuel burn // 60 ticks" unit="%" series={fuelSeries} />
        <TelemetryCell label="Speed // 60 ticks" unit="km/h" series={speedSeries} />
      </div>

      {/* vitals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Speed" value={Math.round(v.speed_kmh)} sub="km/h" />
        <Stat label="Pump" value={v.pump_pressure_bar.toFixed(1)} sub="bar" />
        <Stat
          label="Mileage"
          value={Math.round(v.mileage_km).toLocaleString("en-US")}
          sub="km"
        />
        <Stat
          label="Position"
          value={`${Math.abs(v.lat).toFixed(2)}°`}
          sub={`${v.lat >= 0 ? "N" : "S"} / ${Math.abs(v.lng).toFixed(2)}° ${v.lng >= 0 ? "E" : "W"}`}
        />
      </div>

      <Divider label={`Crew // ${v.crew.length}`} />
      {v.crew.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {v.crew.map((p) => (
            <CrewChip
              key={p.id}
              member={{
                name: p.name,
                role: `${p.rank} ${p.role}`,
                status: p.status.replace(/_/g, " "),
                onDuty: p.status !== "off_duty" && p.status !== "resting",
              }}
            />
          ))}
        </div>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/60">
          No crew assigned //
        </p>
      )}

      <Divider label={`Mounted equipment // ${v.equipment.length}`} />
      {v.equipment.length > 0 ? (
        <DataTable
          dense
          columns={[
            { key: "name", label: "Item" },
            { key: "cat", label: "Cat" },
            { key: "status", label: "Status" },
            { key: "cond", label: "Cond", align: "right" },
          ]}
          rows={v.equipment.map((e) => ({
            name: <span className="font-mono text-[11px]">{e.name}</span>,
            cat: (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
                {e.category}
              </span>
            ),
            status: (
              <Badge tone={statusTone(e.status)} noDot>
                {e.status.replace(/_/g, " ")}
              </Badge>
            ),
            cond: (
              <span className="font-mono text-[11px] text-bone/80">
                {Math.round(e.condition_pct)}%
              </span>
            ),
          }))}
        />
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/60">
          No equipment mounted //
        </p>
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
  onClose,
}: {
  id: string;
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
      className="max-w-3xl"
      footer={
        <>
          {error && v && (
            <span className="mr-auto font-mono text-[9px] uppercase tracking-[0.25em] text-blaze">
              link unstable — showing last sync
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {loading && !v ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-36" />
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : error && !v ? (
        <Alert tone="critical" title="Backend unreachable at localhost:8000">
          Unit record for {id} could not be loaded — {error}. Polling continues
          every 4s.
        </Alert>
      ) : v ? (
        <DetailBody v={v} fuelSeries={fuelSeries} speedSeries={speedSeries} />
      ) : null}
    </Modal>
  );
}
