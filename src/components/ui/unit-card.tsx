import { Badge, type BadgeTone } from "./badge";
import { Button } from "./button";
import { Meter } from "./meter";
import { cn } from "@/lib/utils";

export interface Unit {
  id: string;
  name: string;
  role: string;
  status: string;
  statusTone: BadgeTone;
  location: string;
  freeAt: string;
  fuel: number;
  water: number;
}

const unitDotClasses: Record<BadgeTone, string> = {
  hot: "bg-flame animate-pulse",
  warm: "bg-blaze",
  cold: "bg-bone/50",
  dead: "bg-ash/30",
  plain: "bg-flame/60",
};

export function UnitCard({
  unit,
  onAssign,
  className,
}: {
  unit: Unit;
  /** Wires the Assign button. Disabled when absent. */
  onAssign?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "clip-chamfer bg-flame/25 transition-colors [--chamfer:18px] hover:bg-flame/40",
        className,
      )}
    >
      <div className="clip-chamfer m-px bg-coal [--chamfer:17px]">
        <div className="flex items-center justify-between border-b border-flame/15 px-4 py-2">
          <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5", unitDotClasses[unit.statusTone])}
            />
            {unit.id}
          </span>
          <Badge tone={unit.statusTone}>{unit.status}</Badge>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
              {unit.name}
            </h4>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              {unit.role}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                Location
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-bone/80">
                {unit.location}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                Free at
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-bone/80">
                {unit.freeAt}
              </div>
            </div>
          </div>
          <Meter label="Fuel" value={unit.fuel} />
          <Meter label="Water" value={unit.water} />
        </div>
        <div className="flex items-center justify-end border-t border-flame/15 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            led="on"
            disabled={onAssign === undefined}
            onClick={onAssign}
          >
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
