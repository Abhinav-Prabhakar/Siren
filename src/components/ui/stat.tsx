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
    <div className={cn("relative pl-3.5", className)}>
      <span
        aria-hidden
        className="absolute left-0 top-1.5 h-[calc(100%-10px)] w-[2px] bg-gradient-to-b from-flame to-blood"
      />
      {/* machined cap on the accent rail */}
      <span
        aria-hidden
        className="absolute -left-[2px] top-0 h-1.5 w-1.5 rotate-45 bg-flame shadow-[0_0_6px_rgb(255_46_46/0.6)]"
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
