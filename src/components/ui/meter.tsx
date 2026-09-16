import { cn } from "@/lib/utils";

export interface MeterProps {
  label: string;
  /** 0–100 */
  value: number;
  segments?: number;
  /** Values at or below this threshold render in the alarm state. */
  lowAt?: number;
  className?: string;
}

export function Meter({
  label,
  value,
  segments = 14,
  lowAt = 25,
  className,
}: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * segments);
  const low = clamped <= lowAt;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.25em]">
        <span className="text-ash">{label}</span>
        <span className={low ? "text-flame" : "text-bone/80"}>
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="flex gap-[3px]">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 -skew-x-12",
              i < filled
                ? "bg-gradient-to-t from-blood to-flame"
                : "bg-bone/5",
              low && i === filled - 1 && "animate-pulse",
            )}
          />
        ))}
      </div>
    </div>
  );
}
