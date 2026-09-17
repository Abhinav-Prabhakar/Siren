"use client";

import { Phone, PhoneCall } from "lucide-react";
import { fmtDuration, type Call } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Deterministic voice-print — hashes the call id into bar heights so
 * every call carries a unique audio signature on the wire.
 */
function voicePrint(seed: string, n = 40): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: n }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13) ^ (i * 97), 16777619);
    return 0.15 + ((h >>> 9) % 1000) / 1250;
  });
}

/** Live-call equalizer — staggered scaleY bars via the eq keyframes. */
function EqBars() {
  return (
    <span
      aria-label="live call"
      className="flex h-4 items-end gap-[2px]"
    >
      {[0.9, 0.55, 1, 0.7, 0.45].map((f, i) => (
        <span
          key={i}
          className="animate-eq w-[3px] origin-bottom bg-flame"
          style={{
            height: `${f * 100}%`,
            animationDelay: `${i * 130}ms`,
            animationDuration: `${0.7 + f * 0.6}s`,
          }}
        />
      ))}
    </span>
  );
}

function VoicePrint({ seed }: { seed: string }) {
  return (
    <span aria-hidden className="flex h-4 items-end gap-[2px]">
      {voicePrint(seed).map((v, i) => (
        <span
          key={i}
          className="flex-1 bg-flame/45"
          style={{ height: `${v * 100}%` }}
        />
      ))}
    </span>
  );
}

/**
 * Inbound wire — hairline call rows instead of cards. Caller glyph,
 * voice-print waveform, EQ bars while the line is live.
 */
export function CallWire({
  calls,
  extracted,
}: {
  calls: Call[];
  /** `extracted` arrives as a JSON column — decode to chips. */
  extracted: (value: unknown) => string[];
}) {
  return (
    <div>
      {calls.map((c) => {
        const live = Boolean(c.live);
        return (
          <div
            key={c.id}
            className={cn(
              "border-b border-flame/10 px-4 py-3 last:border-b-0",
              live && "bg-wine/20",
            )}
          >
            <div className="flex items-center gap-3">
              {live ? (
                <PhoneCall
                  aria-hidden
                  strokeWidth={2}
                  className="h-4 w-4 shrink-0 animate-pulse text-flame"
                />
              ) : (
                <Phone
                  aria-hidden
                  strokeWidth={2}
                  className="h-4 w-4 shrink-0 text-ash/60"
                />
              )}
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate font-display text-[11px] font-bold uppercase tracking-[0.1em] text-bone">
                  {c.caller_name?.trim() || "Unknown caller"}
                </span>
                <span className="shrink-0 font-mono text-[9px] tracking-[0.15em] text-ash/70">
                  {c.caller_number || "—"}
                </span>
              </div>
              {live ? (
                <EqBars />
              ) : (
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-ash">
                  {c.duration_s != null ? fmtDuration(c.duration_s) : "—"}
                </span>
              )}
            </div>

            <p className="mt-2 line-clamp-2 border-l-2 border-flame/30 pl-2.5 text-[10px] leading-relaxed text-bone/60">
              {c.transcript || c.summary || "Transcript pending…"}
            </p>

            {live && (
              <div className="mt-2">
                <VoicePrint seed={c.id} />
              </div>
            )}

            {extracted(c.extracted).length > 0 && (
              <div className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.15em] text-flame/70">
                {extracted(c.extracted).join(" · ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
