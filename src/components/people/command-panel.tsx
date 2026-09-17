"use client";

import { Badge } from "@/components/ui/badge";
import { Led } from "@/components/ui/led";
import { Panel } from "@/components/ui/panel";
import { fmtClock, statusTone, type Personnel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { dutyLed, freeAtLabel, ROLE_LABELS } from "./lib";

/** Rank depth in the chain — incident command on top, then chief. */
function commandRank(p: Personnel): number {
  return p.role === "incident_commander" ? 0 : 1;
}

/**
 * Chain-of-command strip — chiefs and incident commanders pulled out of
 * the general roster so the operator always knows who owns the scene.
 */
export function CommandPanel({
  people,
  onSelect,
}: {
  people: Personnel[];
  onSelect: (id: string) => void;
}) {
  const command = people
    .filter((p) => p.role === "chief" || p.role === "incident_commander")
    .sort((a, b) => commandRank(a) - commandRank(b) || a.name.localeCompare(b.name));

  return (
    <Panel
      title="Chain of command"
      led="pulse"
      right={`${command.length} officers`}
      bodyClassName="p-0"
    >
      {command.length === 0 ? (
        <div className="px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          No command staff on roster
        </div>
      ) : (
        <ol>
          {command.map((p, i) => {
            const lamp = dutyLed(p.status);
            const committed = p.incident_id !== null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="group flex w-full cursor-pointer items-center gap-3 border-b border-flame/10 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-flame/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flame"
                >
                  {/* depth marker — the chain link */}
                  <span className="flex w-6 shrink-0 flex-col items-center self-stretch">
                    <span
                      className={cn(
                        "font-mono text-[9px] tracking-widest",
                        i === 0 ? "text-flame" : "text-ash/60",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-gradient-to-b from-flame/40 to-transparent"
                    />
                  </span>
                  <Led tone={lamp.tone} pulse={lamp.pulse} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.12em] text-bone">
                      {p.name}
                    </span>
                    <span className="block font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
                      {p.rank} {"//"} {ROLE_LABELS[p.role]}
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-[9px] uppercase tracking-[0.15em] text-ash sm:block">
                    <span className={cn("block", committed && "text-blaze")}>
                      {committed ? p.incident_id : freeAtLabel(p)}
                    </span>
                    <span className="block text-ash/60">
                      {fmtClock(p.shift_start)}–{fmtClock(p.shift_end)}
                    </span>
                  </span>
                  <Badge tone={statusTone(p.status)}>
                    {p.status.replace("_", " ")}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
