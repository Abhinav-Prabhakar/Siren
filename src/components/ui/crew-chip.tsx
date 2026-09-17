import { cn } from "@/lib/utils";
import { Led } from "./led";

export interface CrewMember {
  name: string;
  role: string;
  status?: string;
  freeAt?: string;
  onDuty?: boolean;
}

/** Compact person chip for rosters and assignment lists. */
export function CrewChip({
  member,
  className,
}: {
  member: CrewMember;
  className?: string;
}) {
  const onDuty = member.onDuty ?? true;
  return (
    <span
      className={cn(
        "clip-tag inline-flex items-stretch bg-flame/25 [--chamfer:8px]",
        className,
      )}
    >
      <span className="clip-tag m-px inline-flex items-center gap-2.5 bg-coal px-3 py-2 [--chamfer:7px]">
        <Led tone={onDuty ? "flame" : "off"} size="sm" />
        <span className="leading-tight">
          <span className="block font-display text-[11px] font-bold uppercase tracking-[0.1em] text-bone">
            {member.name}
          </span>
          <span className="block font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
            {member.role}
          </span>
        </span>
        {(member.status !== undefined || member.freeAt !== undefined) && (
          <span className="ml-2 border-l border-flame/15 pl-2.5 text-right font-mono text-[9px] uppercase leading-tight tracking-[0.15em]">
            {member.status !== undefined && (
              <span className={cn("block", onDuty ? "text-flame" : "text-ash")}>
                {member.status}
              </span>
            )}
            {member.freeAt !== undefined && (
              <span className="block text-ash">{member.freeAt}</span>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
