import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center border border-ash/30 bg-smoke px-1.5 font-mono text-[10px] uppercase text-bone/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
