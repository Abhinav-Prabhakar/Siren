"use client";

import { Badge } from "@/components/ui/badge";
import { Led } from "@/components/ui/led";
import { Meter } from "@/components/ui/meter";
import {
  fmtAgo,
  fmtClock,
  statusTone,
  type Personnel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  dutyLed,
  ROLE_LABELS,
  shiftEndLabel,
  vitalsAlert,
} from "./lib";

function DataCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
        {label}
      </div>
      <div className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-bone/85">
        {children}
      </div>
    </div>
  );
}

/** Rich roster card — the expanded CrewChip: vitals, assignment, shift window. */
export function PersonCard({
  person: p,
  onSelect,
}: {
  person: Personnel;
  onSelect: (id: string) => void;
}) {
  const flag = vitalsAlert(p);
  const lamp = dutyLed(p.status);
  const hrHot = p.heart_rate > 160;
  const hrWarm = p.heart_rate > 140;

  return (
    <button
      type="button"
      onClick={() => onSelect(p.id)}
      className="group relative w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame"
    >
      <div
        className={cn(
          "clip-chamfer bg-gradient-to-b p-px [--chamfer:14px] transition-colors",
          flag === "critical"
            ? "from-flame via-flame/60 to-blood shadow-[0_0_28px_-8px_rgb(255_46_46/0.7)]"
            : flag === "warning"
              ? "from-blaze/70 via-flame/30 to-blood/40"
              : "from-flame/40 via-flame/15 to-blood/30 group-hover:from-blaze/60 group-hover:via-flame/40",
        )}
      >
        <div className="clip-chamfer relative bg-coal/90 [--chamfer:13px]">
          {flag === "critical" && (
            <span
              aria-hidden
              className="bg-hazard-tight absolute inset-x-0 top-0 h-[3px] animate-pulse opacity-80"
            />
          )}
          <div className="p-4">
            {/* identity row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Led tone={lamp.tone} pulse={lamp.pulse} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
                    {p.name}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ash">
                    {p.rank} {"//"} {ROLE_LABELS[p.role]}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge tone={statusTone(p.status)}>
                  {p.status.replace("_", " ")}
                </Badge>
                {flag === "critical" && <Badge tone="hot">Vitals</Badge>}
                {flag === "warning" && <Badge tone="warm">Vitals</Badge>}
              </div>
            </div>

            {/* vitals row */}
            <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-4 border-t border-flame/10 pt-3">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
                  Heart rate
                  {hrHot && (
                    <span className="text-flame text-glow animate-pulse">▲</span>
                  )}
                </div>
                <div
                  className={cn(
                    "font-display text-3xl font-bold tabular-nums leading-none",
                    hrHot
                      ? "text-flame text-glow animate-pulse"
                      : hrWarm
                        ? "text-blaze"
                        : "text-bone",
                  )}
                >
                  {p.heart_rate}
                  <span className="ml-1 font-mono text-[9px] font-normal tracking-[0.2em] text-ash">
                    BPM
                  </span>
                </div>
              </div>
              <Meter label="SCBA" value={p.scba_pct} lowAt={25} segments={12} />
            </div>

            {/* assignment row */}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-flame/10 pt-3">
              <DataCell label="Unit">{p.vehicle_id ?? "—"}</DataCell>
              <DataCell label="Incident">{p.incident_id ?? "—"}</DataCell>
            </div>

            {/* shift footer */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-flame/10 pt-3 font-mono text-[9px] uppercase tracking-[0.2em]">
              <span className="text-ash">
                Shift {fmtClock(p.shift_start)}–{fmtClock(p.shift_end)}
              </span>
              <span className="text-bone/70">{shiftEndLabel(p)}</span>
              <span className="hidden text-ash/60 sm:inline">
                {fmtAgo(p.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
