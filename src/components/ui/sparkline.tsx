import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Area fill under the line. */
  fill?: boolean;
  /** Glowing marker on the latest point. */
  marker?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 140,
  height = 36,
  fill = true,
  marker = true,
  className,
}: SparklineProps) {
  const id = useId();
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("block overflow-visible", className)}
      role="img"
      aria-label="trend"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-flame)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-flame)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <polygon
          points={`${pad},${height - pad} ${line} ${width - pad},${height - pad}`}
          fill={`url(#${id}-fill)`}
        />
      )}
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-flame)"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      {marker && (
        <rect
          x={last[0] - 2}
          y={last[1] - 2}
          width="4"
          height="4"
          transform={`rotate(45 ${last[0]} ${last[1]})`}
          fill="var(--color-flame)"
        />
      )}
    </svg>
  );
}
