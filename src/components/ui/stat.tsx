import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatProps {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}

export function Stat({ label, value, sub, className }: StatProps) {
  return (
    <div className={cn("border-l-2 border-flame pl-3", className)}>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-bone">{value}</div>
      {sub !== undefined && (
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
          {sub}
        </div>
      )}
    </div>
  );
}
