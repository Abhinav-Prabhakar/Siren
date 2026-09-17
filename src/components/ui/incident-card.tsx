import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./badge";
import { Button } from "./button";
import { Led } from "./led";

export interface Incident {
  id: string;
  priority: "P1" | "P2" | "P3" | "P4";
  classification: string;
  address: string;
  reportedAgo: string;
  status?: string;
  statusTone?: BadgeTone;
  /** e.g. "3 calls" — grouped inbound reports */
  calls?: string;
  units?: string[];
}

const priorityTone: Record<Incident["priority"], BadgeTone> = {
  P1: "hot",
  P2: "warm",
  P3: "cold",
  P4: "dead",
};

export function IncidentCard({
  incident,
  actions,
  onApprove,
  className,
}: {
  incident: Incident;
  /** Slot for extra actions; an Approve button is rendered by default. */
  actions?: ReactNode;
  /** Wires the Approve dispatch button. Disabled when absent. */
  onApprove?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("clip-chamfer bg-flame/25 [--chamfer:16px]", className)}>
      <div className="clip-chamfer m-px bg-coal [--chamfer:15px]">
        <div className="flex items-center justify-between gap-3 border-b border-flame/15 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Led tone="flame" pulse={incident.priority === "P1"} size="sm" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
              {incident.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {incident.status !== undefined && (
              <Badge tone={incident.statusTone ?? "warm"}>{incident.status}</Badge>
            )}
            <Badge tone={priorityTone[incident.priority]}>{incident.priority}</Badge>
          </div>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-bone">
              {incident.classification}
            </h4>
            <p className="mt-0.5 font-mono text-[11px] tracking-wider text-bone/70">
              {incident.address}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
            <span>Reported {incident.reportedAgo}</span>
            {incident.calls !== undefined && <span>{incident.calls}</span>}
          </div>
          {incident.units !== undefined && incident.units.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {incident.units.map((u) => (
                <span
                  key={u}
                  className="clip-tag bg-smoke px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/70 [--chamfer:4px]"
                >
                  {u}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-flame/15 px-4 py-2.5">
          {actions}
          <Button
            variant="solid"
            size="sm"
            led="pulse"
            disabled={onApprove === undefined}
            onClick={onApprove}
          >
            Approve dispatch
          </Button>
        </div>
      </div>
    </div>
  );
}
