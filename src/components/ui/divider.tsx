import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Divider({
  label,
  className,
}: {
  label?: ReactNode;
  className?: string;
}) {
  if (label === undefined) {
    return (
      <hr
        aria-hidden
        className={cn("border-t border-flame/15", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("flex items-center gap-3", className)}
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-flame/30 to-flame/40" />
      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        {"// "}
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-flame/30 to-flame/40" />
    </div>
  );
}
