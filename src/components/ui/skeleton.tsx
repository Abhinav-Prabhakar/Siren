import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "clip-tag animate-pulse bg-smoke/80 [--chamfer:4px]",
        className,
      )}
    />
  );
}
