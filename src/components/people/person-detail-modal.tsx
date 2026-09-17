"use client";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { Timeline } from "@/components/ui/timeline";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border border-flame/10 bg-ink/50 px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-bone/85">
        {children}
      </div>
    </div>
  );
}

function VitalTrace({
  label,
  unit,
  points,
  current,
  hot,
}: {
  label: string;
  unit: string;
  points: TelemetryPoint[];
  current: number;
  hot: boolean;
}) {
  const data = points.map((pt) => pt.value);
  return (
    <div className="border border-flame/10 bg-ink/50 px-3 py-2.5">
      <div className="flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
        <span>{label}</span>
        <span
          className={cn(
            "font-display text-base font-bold tabular-nums tracking-normal",
            hot ? "text-flame text-glow animate-pulse" : "text-bone",
          )}
        >
          {Math.round(current)}
          <span className="ml-0.5 text-[8px] font-normal text-ash">{unit}</span>
        </span>
      </div>
      {data.length >= 2 ? (
        <Sparkline data={data} width={210} height={34} className="mt-1 w-full" />
      ) : (
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash/60">
          No telemetry on record
        </div>
      )}
    </div>
  );
}

/** Live personnel dossier — vitals traces, assignment, shift timeline. */
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
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Dismiss
        </Button>
      }
      className="max-w-xl"
    >
      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error && !data ? (
        <Alert tone="critical" title="Link lost">
          Personnel record unreachable — backend down at localhost:8000 ({error}).
        </Alert>
      ) : p ? (
        <div className="space-y-4">
          {error && (
            <Alert tone="warning" title="Uplink degraded">
              {error} — showing last synced record; polling continues every 4s.
            </Alert>
          )}

          {/* status line */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone={statusTone(p.status)}>{p.status.replace("_", " ")}</Badge>
            <Badge tone="plain">{p.rank}</Badge>
            <Badge tone="plain">{ROLE_LABELS[p.role]}</Badge>
            {flag === "critical" && <Badge tone="hot">Vitals alert</Badge>}
            {flag === "warning" && <Badge tone="warm">Vitals watch</Badge>}
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
              seen {fmtAgo(p.updated_at)}
            </span>
          </div>

          {/* vitals traces */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <VitalTrace
              label="Heart rate"
              unit="BPM"
              points={data.hr}
              current={p.heart_rate}
              hot={p.heart_rate > 160}
            />
            <VitalTrace
              label="SCBA supply"
              unit="%"
              points={data.scba}
              current={p.scba_pct}
              hot={p.scba_pct < 25}
            />
          </div>

          {/* assignment + position */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned unit">{p.vehicle_name ?? "—"}</Field>
            <Field label="Incident">{p.incident_address ?? "—"}</Field>
            <Field label="Position">
              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </Field>
            <Field label="Station">{p.station_id}</Field>
          </div>

          {/* shift timeline */}
          <div>
            <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
              {"// Shift window"}
            </div>
            <Timeline
              items={[
                {
                  time: fmtClock(p.shift_start),
                  title: "Watch begins",
                  detail: `Shift start — ${p.rank} ${p.name.split(" ").slice(-1)[0]}`,
                  tone: "bone",
                },
                {
                  time: fmtClock(p.updated_at),
                  title: "Last telemetry",
                  detail: `HR ${p.heart_rate} bpm · SCBA ${Math.round(p.scba_pct)}%`,
                  tone: "flame",
                },
                {
                  time: fmtClock(p.shift_end),
                  title: "Relief due",
                  detail:
                    p.status === "off_duty"
                      ? "Off watch — roster slot free"
                      : "Shift end — crew rotation",
                  tone: "ash",
                },
              ]}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
