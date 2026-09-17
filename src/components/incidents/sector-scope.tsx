"use client";

import type { BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ScopeBlip {
  id: string;
  lat: number;
  lng: number;
  tone: BadgeTone;
  /** Tiny mono tag under the marker — id or callsign. */
  label?: string;
  /** Expanding ping ring — live/moving signals. */
  pulse?: boolean;
  /** Stroke-only diamond — dead/closed signals. */
  hollow?: boolean;
  selected?: boolean;
}

export interface ScopeMark {
  lat: number;
  lng: number;
  label?: string;
}

const TONE_HEX: Record<BadgeTone, string> = {
  hot: "#ff2e2e",
  warm: "#ff6a3d",
  cold: "#ece9e2",
  dead: "#8b8b95",
  plain: "#ff2e2e",
};

const CX = 100;
const CY = 100;
const R = 88;
const KM_PER_DEG_LAT = 111;

interface Pt {
  blip: ScopeBlip;
  x: number;
  y: number;
}

/** Rim-to-rim wedge path spanning [a1,a2] degrees (0 = north, clockwise). */
function wedge(cx: number, cy: number, r: number, a1: number, a2: number) {
  const p = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(cx + r * Math.sin(rad)).toFixed(1)} ${(cy - r * Math.cos(rad)).toFixed(1)}`;
  };
  return `M ${cx} ${cy} L ${p(a1)} A ${r} ${r} 0 0 1 ${p(a2)} Z`;
}

/**
 * Radar-style sector scope — range rings, crosshair, rotating sweep and
 * status-toned diamond blips projected from real lat/lng. `anchor` pins
 * `center` to scope middle (units converge on it); otherwise all points
 * are bounds-fit and `center` draws as a reference mark. Pure SVG, no map.
 */
export function SectorScope({
  blips,
  center,
  anchor = false,
  sweep = true,
  /** Faint vectors from every blip back to scope middle. */
  vectors = false,
  onSelect,
  className,
}: {
  blips: ScopeBlip[];
  center?: ScopeMark | null;
  anchor?: boolean;
  sweep?: boolean;
  vectors?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const pts: Pt[] = [];
  let rangeKm = 0;
  let cPt: { x: number; y: number } | null = null;

  const live = blips.filter(
    (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng),
  );

  if (anchor && center) {
    // anchored — center sits at scope middle, km-accurate radial plot
    const km = live.map((b) => {
      const kx =
        KM_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
      return {
        x: (b.lng - center.lng) * kx,
        y: (b.lat - center.lat) * KM_PER_DEG_LAT,
      };
    });
    rangeKm = Math.max(0.25, ...km.map((k) => Math.hypot(k.x, k.y)));
    const scale = (R - 8) / rangeKm;
    live.forEach((b, i) => {
      let x = CX + km[i].x * scale;
      let y = CY - km[i].y * scale;
      // over-range signals clamp onto the rim
      const d = Math.hypot(x - CX, y - CY);
      if (d > R - 4) {
        x = CX + ((x - CX) / d) * (R - 4);
        y = CY + ((y - CY) / d) * (R - 4);
      }
      pts.push({ blip: b, x, y });
    });
    cPt = { x: CX, y: CY };
  } else if (live.length > 0 || center) {
    // bounds-fit — every signal inside the rings, spacing preserved
    const toPx = (lat: number, lng: number) => ({
      x: lng * KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180),
      y: lat * KM_PER_DEG_LAT,
    });
    const xs = [...live.map((b) => toPx(b.lat, b.lng).x)];
    const ys = [...live.map((b) => toPx(b.lat, b.lng).y)];
    if (center) {
      const c = toPx(center.lat, center.lng);
      xs.push(c.x);
      ys.push(c.y);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 0.25);
    const scale = ((R - 10) * 2) / span;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    rangeKm = span / 2;
    live.forEach((b) => {
      const p = toPx(b.lat, b.lng);
      pts.push({
        blip: b,
        x: CX + (p.x - midX) * scale,
        y: CY - (p.y - midY) * scale,
      });
    });
    if (center) {
      const c = toPx(center.lat, center.lng);
      cPt = { x: CX + (c.x - midX) * scale, y: CY - (c.y - midY) * scale };
    }
  }

  const ringLabel =
    rangeKm >= 1
      ? `R≈${rangeKm.toFixed(1)}km`
      : `R≈${Math.round(rangeKm * 1000)}m`;

  return (
    <div className={cn("bg-grid relative overflow-hidden", className)}>
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="sector scope"
      >
        {/* range rings + crosshair */}
        {[R / 3, (2 * R) / 3, R].map((r) => (
          <circle
            key={r}
            cx={CX} cy={CY} r={r} fill="none"
            stroke="var(--color-flame)" strokeOpacity={r === R ? 0.28 : 0.12}
            strokeWidth="0.8"
            strokeDasharray={r === R ? undefined : "2 4"}
          />
        ))}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="var(--color-flame)" strokeOpacity="0.14" strokeWidth="0.7" />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="var(--color-flame)" strokeOpacity="0.14" strokeWidth="0.7" />
        {/* rim ticks every 30° */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={CX + (R - 4) * Math.sin(a)}
              y1={CY - (R - 4) * Math.cos(a)}
              x2={CX + R * Math.sin(a)}
              y2={CY - R * Math.cos(a)}
              stroke="var(--color-ash)"
              strokeOpacity={i % 3 === 0 ? 0.7 : 0.3}
              strokeWidth="1"
            />
          );
        })}
        <text
          x={CX} y={CY - R - 3} textAnchor="middle"
          fill="var(--color-ash)" fillOpacity="0.7"
          fontSize="7" fontFamily="var(--font-mono)"
        >
          N
        </text>

        {/* rotating sweep — fading trail wedges + hot leading edge */}
        {sweep && (
          <g
            className="animate-sweep"
            style={{ transformBox: "view-box", transformOrigin: "100px 100px" }}
          >
            {[0, 14, 28, 42, 56].map((lag, i) => (
              <path
                key={lag}
                d={wedge(CX, CY, R - 3, lag, lag + 14)}
                fill="var(--color-flame)"
                opacity={0.16 - i * 0.032}
              />
            ))}
            <line
              x1={CX} y1={CY} x2={CX} y2={CY - (R - 3)}
              stroke="var(--color-flame)" strokeOpacity="0.5" strokeWidth="1"
            />
          </g>
        )}

        {/* vectors — blip back to scope middle */}
        {vectors &&
          pts.map((p) => (
            <line
              key={`v-${p.blip.id}`}
              x1={p.x} y1={p.y} x2={CX} y2={CY}
              stroke={TONE_HEX[p.blip.tone]}
              strokeOpacity="0.3" strokeWidth="0.7"
              strokeDasharray="2 3"
            />
          ))}

        {/* center mark — station cross / incident origin */}
        {cPt && (
          <g>
            <rect
              x={cPt.x - 3.5} y={cPt.y - 3.5} width="7" height="7"
              transform={`rotate(45 ${cPt.x} ${cPt.y})`}
              fill="var(--color-ink)"
              stroke="var(--color-bone)" strokeOpacity="0.8" strokeWidth="1"
            />
            {center?.label && (
              <text
                x={cPt.x} y={cPt.y + 13} textAnchor="middle"
                fill="var(--color-bone)" fillOpacity="0.6"
                fontSize="6.5" fontFamily="var(--font-mono)"
              >
                {center.label}
              </text>
            )}
          </g>
        )}

        {/* blips */}
        {pts.map((p) => {
          const hex = TONE_HEX[p.blip.tone];
          const s = p.blip.selected ? 5 : p.blip.tone === "hot" ? 4.2 : 3.4;
          return (
            <g
              key={p.blip.id}
              onClick={onSelect ? () => onSelect(p.blip.id) : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <title>{p.blip.id}</title>
              {p.blip.pulse && (
                <circle
                  cx={p.x} cy={p.y} r={s + 2}
                  fill="none" stroke={hex} strokeWidth="1"
                  className="animate-ping"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              )}
              <rect
                x={p.x - s} y={p.y - s} width={s * 2} height={s * 2}
                transform={`rotate(45 ${p.x} ${p.y})`}
                fill={p.blip.hollow ? "var(--color-ink)" : hex}
                fillOpacity={p.blip.hollow ? 1 : 0.9}
                stroke={hex} strokeWidth="1"
                strokeOpacity={p.blip.hollow ? 0.6 : 1}
              />
              {p.blip.selected && (
                <g stroke="var(--color-flame)" strokeWidth="1.2" fill="none">
                  {[
                    [-1, -1], [1, -1], [-1, 1], [1, 1],
                  ].map(([sx, sy]) => (
                    <path
                      key={`${sx}${sy}`}
                      d={`M ${p.x + sx * (s + 6)} ${p.y + sy * (s + 2)} V ${p.y + sy * (s + 6)} H ${p.x + sx * (s + 2)}`}
                    />
                  ))}
                </g>
              )}
              {p.blip.label !== undefined && (
                <text
                  x={p.x} y={p.y + s + 9} textAnchor="middle"
                  fill={p.blip.selected ? "#ff2e2e" : "#8b8b95"}
                  fontSize="6.5" fontFamily="var(--font-mono)"
                >
                  {p.blip.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* HUD furniture — readouts + corner brackets */}
      <span aria-hidden className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-flame/50" />
      <span aria-hidden className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-flame/50" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-flame/50" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-flame/50" />
      <span className="absolute bottom-2.5 right-3 font-mono text-[8px] uppercase tracking-[0.25em] text-ash/80">
        {live.length > 0 ? ringLabel : "no signal"}
      </span>
    </div>
  );
}
