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
    <div className={cn("relative pl-3", className)}>
      <span
        aria-hidden
        className="absolute left-0 top-1 h-[calc(100%-8px)] w-[2px] bg-gradient-to-b from-flame to-blood"
      />
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-bone text-glow">
        {value}
      </div>
      {sub !== undefined && (
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
          {sub}
        </div>
      )}
    </div>
  );
}
