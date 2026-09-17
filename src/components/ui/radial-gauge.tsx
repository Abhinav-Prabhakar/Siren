import { cn } from "@/lib/utils";

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export interface RadialGaugeProps {
  /** 0–100 */
  value: number;
  size?: number;
  /** gauge = 270° sweep with needle; ring = closed circle */
  variant?: "gauge" | "ring";
  label?: string;
  sub?: string;
  className?: string;
}

const SWEEP = 270;

export function RadialGauge({
  value,
  size = 150,
  variant = "gauge",
  label,
  sub,
  className,
}: RadialGaugeProps) {
  const v = Math.max(0, Math.min(100, value));
  const low = v <= 25;

  if (variant === "ring") {
    const r = 52;
    const c = 2 * Math.PI * r;
    return (
      <div
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 120 120" width={size} height={size} className="block">
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="var(--color-smoke)" strokeWidth="8"
          />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="var(--color-flame)" strokeWidth="8"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-bone">
            {Math.round(v)}
            <span className="text-[10px] text-ash">%</span>
          </span>
          {label !== undefined && (
            <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash">
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }

  const cx = 60;
  const cy = 62;
  const r = 44;
  const valueDeg = (v / 100) * SWEEP;
  const needle = polar(cx, cy, r - 12, valueDeg);

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg viewBox="0 0 120 96" width={size} height={(size * 96) / 120} className="block">
        {/* tick marks every 10% */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = (i / 10) * SWEEP;
          const p1 = polar(cx, cy, r + 5, a);
          const p2 = polar(cx, cy, r + 9, a);
          return (
            <line
              key={i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={i / 10 <= v / 100 ? "var(--color-flame)" : "var(--color-ash)"}
              strokeOpacity={i / 10 <= v / 100 ? 1 : 0.35}
              strokeWidth="1.5"
            />
          );
        })}
        <path
          d={arc(cx, cy, r, 0, SWEEP)}
          fill="none" stroke="var(--color-smoke)" strokeWidth="7"
        />
        <path
          d={arc(cx, cy, r, 0, Math.max(valueDeg, 0.5))}
          fill="none"
          stroke="var(--color-flame)"
          strokeWidth="7"
        />
        {/* needle */}
        <line
          x1={cx} y1={cy} x2={needle.x} y2={needle.y}
          stroke="var(--color-bone)" strokeWidth="1.5"
        />
        <rect
          x={cx - 3} y={cy - 3} width="6" height="6"
          transform={`rotate(45 ${cx} ${cy})`}
          fill="var(--color-flame)"
        />
      </svg>
      {(label !== undefined || sub !== undefined) && (
        <div className="-mt-3 text-center">
          {label !== undefined && (
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
              {label}
            </div>
          )}
          {sub !== undefined && (
            <div
              className={cn(
                "font-display text-lg font-bold",
                low ? "text-flame" : "text-bone",
              )}
            >
              {sub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
