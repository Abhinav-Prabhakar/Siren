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
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_0_rgb(0_0_0/0.6)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
