import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  /** Muted bars read as background context. */
  muted?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Gridlines count. */
  grid?: number;
  className?: string;
}

export function BarChart({
  data,
  height = 140,
  grid = 3,
  className,
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        {/* hairline grid */}
        {Array.from({ length: grid }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-x-0 border-t border-bone/8"
            style={{ top: `${((i + 1) / (grid + 1)) * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-2">
          {data.map((d) => (
            <div
              key={d.label}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
            >
              <span className="mb-1 font-mono text-[9px] text-ash opacity-0 transition-opacity group-hover:opacity-100">
                {d.value}
              </span>
              <div
                className={cn(
                  "w-full transition-all duration-300",
                  d.muted
                    ? "bg-ash/25 group-hover:bg-ash/40"
                    : "bg-flame group-hover:bg-blaze",
                )}
                style={{ height: `${(d.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-ash/20" />
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d) => (
          <div
            key={d.label}
            className="min-w-0 flex-1 truncate text-center font-mono text-[9px] uppercase tracking-[0.15em] text-ash"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
