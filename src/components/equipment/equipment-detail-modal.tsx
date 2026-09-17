"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  Clock,
  Hash,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  Alert,
  Badge,
  Modal,
  Skeleton,
  Sparkline,
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
  CategoryIcon,
  MONITORING,
  MonitoringReadout,
} from "./monitoring";
import {
  LOW_CONDITION_AT,
  attentionReasons,
  fmtStamp,
  fmtStatus,
} from "./shared";

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

/** icon + trailing text for the service-record line. */
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
  const traceLabel =
    current && MONITORING[current.category].traceLabel
      ? MONITORING[current.category].traceLabel!.replace(
          "{n}",
          String(points.length),
        )
      : null;

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title={current ? `${current.name}` : "Item detail"}
      led={reasons.length > 0 ? "flame" : "bone"}
      className="max-w-xl"
    >
      {itemError && !current && (
        <Alert tone="critical" title="Uplink error">
          {itemError} — backend unreachable.
        </Alert>
      )}

      {itemError && current && (
        <Alert tone="warning" title="Uplink degraded">
          {itemError} — showing last synced record; polling continues every 4s.
        </Alert>
      )}

      {!current && !itemError && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {current && (
        <div className="space-y-5">
          {/* identity — bare pictogram, no frame */}
          <div className="flex items-center gap-4">
            <CategoryIcon
              category={current.category}
              size={64}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge tone={statusTone(current.status)}>
                {fmtStatus(current.status)}
              </Badge>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                {current.category} {"//"} {current.id} {"//"} sn{" "}
                {current.serial}
              </span>
            </div>
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

          <MonitoringReadout item={current} />

          {points.length > 1 && traceLabel && (
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
                {traceLabel}
              </div>
              <Sparkline
                data={points.map((p) => p.value)}
                width={560}
                height={40}
                className="mt-1.5 h-auto w-full"
              />
            </div>
          )}

          {/* service record */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <IconField
              icon={Truck}
              text={current.vehicle_name ?? "station stores"}
            />
            <IconField
              icon={Building2}
              text={current.station_name ?? current.station_id}
            />
            <IconField
              icon={ClipboardCheck}
              text={`chk ${fmtStamp(current.last_check)}`}
            />
            <IconField icon={Hash} text={current.serial} />
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
              upd {fmtAgo(current.updated_at)} · {fmtClock(current.updated_at)}
            </span>
          </div>

          {note && (
            <p className="border-l-2 border-flame/50 pl-3 text-[11px] leading-relaxed text-bone/70">
              {note}
            </p>
          )}

          {/* inspection log — the two stamps the backend actually stores */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-bone/70">
              <Clock
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-ash/70"
              />
              <span className="text-ash">{fmtStamp(current.updated_at)}</span>
              <span className="truncate">
                telemetry sync — {fmtStatus(current.status)}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-bone/70">
              <ClipboardCheck
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-flame/70"
              />
              <span className="text-ash">{fmtStamp(current.last_check)}</span>
              <span className="truncate">
                inspection — condition {Math.round(current.condition_pct)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
