"use client";

import Image from "next/image";
import { Meter, RadialGauge } from "@/components/ui";
import type { Equipment, EquipmentCategory } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LOW_BATTERY_AT, LOW_CONDITION_AT } from "./shared";

/**
 * Per-category monitoring profiles.
 *
 * Every number on screen still comes from real API fields — battery_pct,
 * condition_pct, last_check, status — but each category frames them the
 * way the physical asset is actually monitored: SCBA reads as an air-pack
 * pressure gauge, cylinders/foam/generator as fill & reserve rings,
 * passive line equipment as a condition meter plus an inspection horizon
 * countdown derived from last_check. Nothing is invented: when an item
 * has no cell, no battery metric is shown at all.
 */
export interface CategoryMonitoring {
  /** "//"-style headline over the readout block */
  headline: string;
  /** one-line framing under the headline */
  brief: string;
  /** meter label for battery_pct — null = category never reports a cell */
  cellLabel: string | null;
  /** powered readout style: pressure-style gauge vs cell meter */
  cellGauge: "gauge" | "meter";
  /** label for the condition_pct metric */
  integrityLabel: string;
  /** render condition as a tank/reserve ring instead of a meter */
  integrityRing: boolean;
  /** horizon derived from last_check — label + interval in days */
  countdown: { label: string; intervalDays: number };
  /** title for the battery history sparkline (powered items only) */
  traceLabel: string | null;
}

export const MONITORING: Record<EquipmentCategory, CategoryMonitoring> = {
  hose: {
    headline: "Discharge line // service test",
    brief: "Jacket integrity against the service-test horizon — passive line, no powered telemetry.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "jacket",
    integrityRing: false,
    countdown: { label: "service test", intervalDays: 90 },
    traceLabel: null,
  },
  nozzle: {
    headline: "Flow hardware // inspection",
    brief: "Bore and fog-teeth condition against the inspection horizon — passive appliance.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "bore",
    integrityRing: false,
    countdown: { label: "inspection", intervalDays: 180 },
    traceLabel: null,
  },
  scba: {
    headline: "Air supply // pack telemetry",
    brief: "Pack electronics cell on the pressure gauge; set integrity and daily-check horizon below.",
    cellLabel: "pack cell",
    cellGauge: "gauge",
    integrityLabel: "set",
    integrityRing: false,
    countdown: { label: "daily check", intervalDays: 30 },
    traceLabel: "pack cell drain // last {n} ticks",
  },
  ppe: {
    headline: "Turnout shell // inspection",
    brief: "Shell integrity against the routine-inspection horizon — passive garment.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "shell",
    integrityRing: false,
    countdown: { label: "inspection", intervalDays: 180 },
    traceLabel: null,
  },
  breaching: {
    headline: "Entry tools // inspection",
    brief: "Manual irons track edge condition; powered saws report cell drain.",
    cellLabel: "saw cell",
    cellGauge: "meter",
    integrityLabel: "edge",
    integrityRing: false,
    countdown: { label: "inspection", intervalDays: 180 },
    traceLabel: "saw cell drain // last {n} ticks",
  },
  ladder: {
    headline: "Ground ladder // annual test",
    brief: "Rail and rung integrity against the annual service-test horizon.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "rails",
    integrityRing: false,
    countdown: { label: "service test", intervalDays: 365 },
    traceLabel: null,
  },
  hydraulic: {
    headline: "Rescue tool // power pack",
    brief: "Power-pack cell on the pressure gauge; tool integrity and service horizon below.",
    cellLabel: "pack cell",
    cellGauge: "gauge",
    integrityLabel: "tool",
    integrityRing: false,
    countdown: { label: "service", intervalDays: 90 },
    traceLabel: "pack cell drain // last {n} ticks",
  },
  medical: {
    headline: "Patient care // sterility window",
    brief: "Kit completeness against the restock horizon; powered units report cell drain.",
    cellLabel: "aed cell",
    cellGauge: "meter",
    integrityLabel: "kit",
    integrityRing: false,
    countdown: { label: "restock", intervalDays: 90 },
    traceLabel: "aed cell drain // last {n} ticks",
  },
  rope: {
    headline: "Life-safety rope // rope log",
    brief: "Sheath condition against the rope-log horizon — passive line, entries at every inspection.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "sheath",
    integrityRing: false,
    countdown: { label: "rope log", intervalDays: 90 },
    traceLabel: null,
  },
  thermal: {
    headline: "Thermal imager // calibration",
    brief: "TIC cell drain with a calibration horizon derived from the last bench check.",
    cellLabel: "tic cell",
    cellGauge: "meter",
    integrityLabel: "imager",
    integrityRing: false,
    countdown: { label: "calibration", intervalDays: 180 },
    traceLabel: "tic cell drain // last {n} ticks",
  },
  fan: {
    headline: "Ventilation fan // service cycle",
    brief: "Blade and motor condition against the service horizon — no fitted cell.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "motor",
    integrityRing: false,
    countdown: { label: "service", intervalDays: 180 },
    traceLabel: null,
  },
  pump: {
    headline: "Portable pump // service cycle",
    brief: "Pump mechanics against the service horizon — no fitted cell.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "pump",
    integrityRing: false,
    countdown: { label: "service", intervalDays: 90 },
    traceLabel: null,
  },
  generator: {
    headline: "Power plant // reserve index",
    brief: "Reserve index derived from condition telemetry; runtime-ready while the reserve holds.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "reserve",
    integrityRing: true,
    countdown: { label: "service", intervalDays: 90 },
    traceLabel: null,
  },
  lighting: {
    headline: "Scene lighting // mast power",
    brief: "Tower cell drain with lamp integrity alongside the service horizon.",
    cellLabel: "tower cell",
    cellGauge: "meter",
    integrityLabel: "lamp",
    integrityRing: false,
    countdown: { label: "service", intervalDays: 90 },
    traceLabel: "tower cell drain // last {n} ticks",
  },
  foam: {
    headline: "Foam concentrate // batch level",
    brief: "Concentrate reserve index derived from condition telemetry; batch-check horizon below.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "concentrate",
    integrityRing: true,
    countdown: { label: "batch check", intervalDays: 180 },
    traceLabel: null,
  },
  hazmat: {
    headline: "Hazmat // detection & suits",
    brief: "Detectors report cell drain against a bump-test horizon; suits track integrity.",
    cellLabel: "det cell",
    cellGauge: "meter",
    integrityLabel: "suit/det",
    integrityRing: false,
    countdown: { label: "bump test", intervalDays: 180 },
    traceLabel: "det cell drain // last {n} ticks",
  },
  radio: {
    headline: "Comms // radio net",
    brief: "Transmit cell drain; unit integrity and comms-check horizon alongside.",
    cellLabel: "tx cell",
    cellGauge: "meter",
    integrityLabel: "unit",
    integrityRing: false,
    countdown: { label: "comms check", intervalDays: 90 },
    traceLabel: "tx cell drain // last {n} ticks",
  },
  cylinder: {
    headline: "Air cylinder // fill index",
    brief: "Fill index derived from condition telemetry against the hydro/visual horizon.",
    cellLabel: null,
    cellGauge: "meter",
    integrityLabel: "fill",
    integrityRing: true,
    countdown: { label: "hydro/visual", intervalDays: 365 },
    traceLabel: null,
  },
};

const DAY_MS = 86_400_000;

/** Days since the recorded last_check — 0 when the stamp is unparsable. */
export function checkAgeDays(lastCheck: string): number {
  const ts = Date.parse(lastCheck);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, (Date.now() - ts) / DAY_MS);
}

export interface CountdownState {
  /** days until the horizon lapses — negative when overdue */
  dueInDays: number;
  /** 0–100 share of the horizon remaining */
  reservePct: number;
  overdue: boolean;
}

/** last_check + the category horizon → due-in / overdue countdown. */
export function countdownState(item: Equipment): CountdownState {
  const { intervalDays } = MONITORING[item.category].countdown;
  const age = checkAgeDays(item.last_check);
  const remaining = intervalDays - age;
  return {
    dueInDays: Math.ceil(remaining),
    reservePct: Math.max(0, Math.min(100, (remaining / intervalDays) * 100)),
    overdue: remaining <= 0,
  };
}

/** Category pictogram — the 18-file SVG family in public/equipment/. */
export function CategoryIcon({
  category,
  size = 28,
  className,
}: {
  category: EquipmentCategory;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/equipment/${category}.svg`}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}

/**
 * Inspection/calibration horizon bar — the countdown every category
 * derives from last_check, labeled the way that asset is tracked.
 */
export function HorizonCountdown({ item }: { item: Equipment }) {
  const p = MONITORING[item.category];
  const cd = countdownState(item);
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <Meter
          label={
            cd.overdue
              ? `${p.countdown.label} overdue — last check ${Math.floor(checkAgeDays(item.last_check))}d ago`
              : `${p.countdown.label} horizon — ${p.countdown.intervalDays}d cycle`
          }
          value={cd.reservePct}
          segments={12}
          lowAt={10}
        />
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-display text-lg font-bold leading-none",
            cd.overdue ? "text-flame text-glow" : "text-bone",
          )}
        >
          {cd.overdue ? `+${Math.abs(cd.dueInDays)}d` : `d-${cd.dueInDays}`}
        </div>
        <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
          {cd.overdue ? "past due" : "remaining"}
        </div>
      </div>
    </div>
  );
}

/**
 * The detail-modal monitoring block — layout and widget mix follow the
 * category profile: pressure gauges for air/tool packs, reserve rings
 * for tanks and consumables, meters elsewhere, and never a battery
 * metric on passive items.
 */
export function MonitoringReadout({ item }: { item: Equipment }) {
  const p = MONITORING[item.category];
  const powered = item.battery_pct !== null && p.cellLabel !== null;

  return (
    <div className="space-y-4">
      <div className="grid items-center gap-5 sm:grid-cols-2">
        {powered ? (
          p.cellGauge === "gauge" ? (
            <RadialGauge
              value={item.battery_pct ?? 0}
              size={128}
              label={p.cellLabel ?? "cell"}
              sub={`${Math.round(item.battery_pct ?? 0)}%`}
              className="justify-self-center"
            />
          ) : (
            <Meter
              label={p.cellLabel ?? "cell"}
              value={item.battery_pct ?? 0}
              lowAt={LOW_BATTERY_AT}
            />
          )
        ) : (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
              Powered telemetry
            </div>
            <div className="mt-1 font-mono text-xs text-bone/60">
              — passive item, no cell fitted
            </div>
          </div>
        )}

        {p.integrityRing ? (
          <RadialGauge
            variant="ring"
            value={item.condition_pct}
            size={104}
            label={p.integrityLabel}
            className="justify-self-center"
          />
        ) : (
          <Meter
            label={p.integrityLabel}
            value={item.condition_pct}
            lowAt={LOW_CONDITION_AT}
          />
        )}
      </div>

      <HorizonCountdown item={item} />
    </div>
  );
}
