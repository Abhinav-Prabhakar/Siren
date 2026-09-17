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
        <span className={low ? "text-flame text-glow" : "text-bone/80"}>
          {Math.round(clamped)}%
        </span>
      </div>
      {/* recessed track — segments sit in a machined groove */}
      <div className="flex gap-[3px] border border-ash/20 bg-ink p-[3px] shadow-[inset_0_2px_6px_rgb(0_0_0/0.6)]">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 flex-1 -skew-x-12",
              i < filled
                ? "bg-gradient-to-t from-blood via-flame to-blaze shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-1px_0_rgb(0_0_0/0.5)]"
                : "bg-smoke shadow-[inset_0_1px_2px_rgb(0_0_0/0.7)]",
              low && i === filled - 1 && "animate-pulse",
            )}
          />
        ))}
      </div>
    </div>
  );
}
