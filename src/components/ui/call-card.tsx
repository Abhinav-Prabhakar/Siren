import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Led } from "./led";

export interface IncomingCall {
  caller: string;
  number: string;
  duration: string;
  transcript: string;
  /** Extracted fields the agent surfaced, e.g. location or classification. */
  extracted?: string[];
  live?: boolean;
}

/** Inbound Vapi call card — caller info, live transcript, extracted intel. */
export function CallCard({
  call,
  actions,
  className,
}: {
  call: IncomingCall;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("clip-chamfer bg-ash/25 [--chamfer:16px]", className)}>
      <div className="clip-chamfer m-px bg-coal [--chamfer:15px]">
        <div className="flex items-center justify-between gap-3 border-b border-flame/15 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Led tone={call.live ? "blaze" : "off"} pulse={call.live} size="sm" />
            <div>
              <span className="block font-display text-[11px] font-bold uppercase tracking-[0.1em] text-bone">
                {call.caller}
              </span>
              <span className="block font-mono text-[9px] tracking-[0.2em] text-ash">
                {call.number}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-widest text-ash">
              {call.duration}
            </span>
            {call.live && <Badge tone="hot">Live</Badge>}
          </div>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          <p className="border-l-2 border-flame/40 pl-3 text-xs leading-relaxed text-bone/75">
            {call.transcript}
          </p>
          {call.extracted !== undefined && call.extracted.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {call.extracted.map((chip) => (
                <span
                  key={chip}
                  className="clip-tag bg-wine/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-flame [--chamfer:4px]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex items-center justify-end gap-3 border-t border-flame/15 px-4 py-2.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
