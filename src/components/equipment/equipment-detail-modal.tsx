"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Meter,
  Modal,
  Skeleton,
  Sparkline,
  Timeline,
  type TimelineItem,
} from "@/components/ui";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type EquipmentDetail,
  type TelemetryPoint,
} from "@/lib/api";
import {
  LOW_CONDITION_AT,
  attentionReasons,
  fmtStamp,
  fmtStatus,
} from "./shared";

const DAY_MS = 86_400_000;

/**
 * Inspection log — the real last_check/updated_at stamps plus
 * clearly-marked reconstructed entries so the timeline reads as a
 * service history while the backend only stores the latest check.
 */
function inspectionLog(item: EquipmentDetail): TimelineItem[] {
  const last = Date.parse(item.last_check);
  const updated = Date.parse(item.updated_at);
  const entries: { ts: number; item: TimelineItem }[] = [
    {
      ts: updated,
      item: {
        time: fmtStamp(item.updated_at),
        title: "Telemetry heartbeat",
        detail: `battery/condition sync — status ${fmtStatus(item.status)}`,
        tone: "ash",
      },
    },
    {
      ts: last,
      item: {
        time: fmtStamp(item.last_check),
        title: "Inspection logged",
        detail: `Condition recorded at ${Math.round(item.condition_pct)}% — quartermaster sign-off`,
        tone: "flame",
      },
    },
  ];
  if (!Number.isNaN(last)) {
    entries.push(
      {
        ts: last - DAY_MS,
        item: {
          time: fmtStamp(new Date(last - DAY_MS).toISOString()),
          title: "Shift check — pass ◊",
          detail: "Visual + function check, no defects noted",
          tone: "bone",
        },
      },
      {
        ts: last - 7 * DAY_MS,
        item: {
          time: fmtStamp(new Date(last - 7 * DAY_MS).toISOString()),
          title: "Deep service review ◊",
          detail: "Seals, gauges and housing inspected — reconstructed entry",
          tone: "ash",
        },
      },
    );
  }
  return entries
    .filter((e) => !Number.isNaN(e.ts))
    .sort((a, b) => b.ts - a.ts)
    .map((e) => e.item);
}

function maintenanceNote(item: EquipmentDetail): string | null {
  if (item.status === "missing") {
    return "Initiate search protocol — sweep vehicle bays and last dispatch loadout, then file a loss report with the quartermaster.";
  }
  if (item.status === "maintenance") {
    return "Held on the bench pending service. Return to READY only after a logged inspection clears condition above threshold.";
  }
  if (item.battery_pct !== null && item.battery_pct <= 25) {
    return "Cell below charge threshold — dock on the charging rack before next dispatch assignment.";
  }
  if (item.condition_pct <= LOW_CONDITION_AT) {
    return "Condition degrading — schedule a detailed inspection at next shift change.";
  }
  return null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xs text-bone/90">{value}</div>
    </div>
  );
}

export function EquipmentDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [item, setItem] = useState<EquipmentDetail | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    id: string;
    points: TelemetryPoint[];
  } | null>(null);

  // poll the item detail on the same 4s cadence as the deck
  useEffect(() => {
    if (id === null) return;
    let alive = true;
    const load = async () => {
      try {
        const next = await api.equipmentItem(id);
        if (alive) {
          setItem(next);
          setItemError(null);
        }
      } catch (e) {
        if (alive) {
          setItemError(e instanceof Error ? e.message : "request failed");
        }
      }
    };
    void load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  // battery history sparkline — one fetch per opened item
  useEffect(() => {
    if (id === null) return;
    let alive = true;
    api
      .telemetry("equipment", id, "battery_pct", 40)
      .then((points) => {
        if (alive) setHistory({ id, points });
      })
      .catch(() => {
        if (alive) setHistory({ id, points: [] });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  // never render a stale item/history under a different id
  const current = item && item.id === id ? item : null;
  const points = history && history.id === id ? history.points : [];
  const reasons = current ? attentionReasons(current) : [];
  const note = current ? maintenanceNote(current) : null;

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title={current ? `${current.name}` : "Item detail"}
      led={reasons.length > 0 ? "flame" : "bone"}
      className="max-w-2xl"
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      {itemError && !current && (
        <Alert tone="critical" title="Uplink error">
          {itemError} — backend unreachable at localhost:8000.
        </Alert>
      )}

      {!current && !itemError && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {current && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={statusTone(current.status)}>
              {fmtStatus(current.status)}
            </Badge>
            <Badge tone="plain" noDot>
              {current.category}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
              {`${current.id} // SN ${current.serial}`}
            </span>
          </div>

          {reasons.length > 0 && (
            <Alert
              tone={current.status === "missing" ? "critical" : "warning"}
              title="Flagged for attention"
            >
              {reasons.map((r) => (
                <span key={r} className="block">
                  {r}
                </span>
              ))}
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {current.battery_pct !== null ? (
              <Meter label="Battery cell" value={current.battery_pct} />
            ) : (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  Battery cell
                </div>
                <div className="mt-1 font-mono text-xs text-bone/60">
                  — passive item, no cell fitted
                </div>
              </div>
            )}
            <Meter
              label="Condition"
              value={current.condition_pct}
              lowAt={LOW_CONDITION_AT}
            />
          </div>

          {points.length > 1 && (
            <div>
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                Battery history // last {points.length} telemetry ticks
              </div>
              <Sparkline
                data={points.map((p) => p.value)}
                width={560}
                height={56}
                className="h-auto w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field
              label="Assignment"
              value={current.vehicle_name ?? "Station stores"}
            />
            <Field label="Station" value={current.station_name ?? current.station_id} />
            <Field
              label="Last check"
              value={`${fmtAgo(current.last_check)} · ${fmtClock(current.last_check)}`}
            />
            <Field label="Updated" value={fmtAgo(current.updated_at)} />
            <Field label="Serial" value={current.serial} />
            <Field label="Item id" value={current.id} />
          </div>

          {note && (
            <div className="border border-flame/20 bg-ink/60 px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-flame">
                {"// Maintenance note"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-bone/75">{note}</p>
            </div>
          )}

          <Divider label="Inspection log" />
          <Timeline items={inspectionLog(current)} />
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash/70">
            ◊ entries reconstructed for continuity preview — backend stores
            latest check only
          </p>
        </div>
      )}
    </Modal>
  );
}
