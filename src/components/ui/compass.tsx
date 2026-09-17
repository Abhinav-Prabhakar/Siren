import { cn } from "@/lib/utils";

const COMPASS_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** "NW" or "315" → needle degrees; undefined when unparseable. */
export function windDeg(dir: string | undefined): number | undefined {
  if (!dir) return undefined;
  const s = dir.trim().toUpperCase();
  if (s in COMPASS_DEG) return COMPASS_DEG[s];
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Wind compass — north-marked dial with a needle pointed at `deg`. */
export function Compass({
  deg,
  dim = false,
  className,
}: {
  deg?: number;
  dim?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-14 w-14 shrink-0", dim && "opacity-40", className)}
      role="img"
      aria-label="wind compass"
    >
      <circle
        cx="24" cy="24" r="20" fill="none"
        stroke="var(--color-smoke)" strokeWidth="2.5"
      />
      {[0, 90, 180, 270].map((a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        const x1 = 24 + 20 * Math.cos(rad);
        const y1 = 24 + 20 * Math.sin(rad);
        const x2 = 24 + 15 * Math.cos(rad);
        const y2 = 24 + 15 * Math.sin(rad);
        return (
          <line
            key={a}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={a === 0 ? "var(--color-flame)" : "var(--color-ash)"}
            strokeOpacity={a === 0 ? 0.9 : 0.4}
            strokeWidth="1.5"
          />
        );
      })}
      <text
        x="24" y="11.5" textAnchor="middle"
        fill="var(--color-ash)" fontSize="5.5" fontFamily="var(--font-mono)"
      >
        N
      </text>
      {deg !== undefined && (
        <g transform={`rotate(${deg} 24 24)`}>
          <line
            x1="24" y1="24" x2="24" y2="11"
            stroke="var(--color-flame)" strokeWidth="1.5"
          />
          <polygon points="24,7 21,12.5 27,12.5" fill="var(--color-flame)" />
        </g>
      )}
      <rect
        x="22" y="22" width="4" height="4"
        transform="rotate(45 24 24)"
        fill={deg === undefined ? "var(--color-ash)" : "var(--color-flame)"}
      />
    </svg>
  );
}
