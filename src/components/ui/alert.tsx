import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Led } from "./led";

export type AlertTone = "critical" | "warning" | "info" | "ok";

const toneClasses: Record<
  AlertTone,
  { frame: string; title: string; rail: string; led: "flame" | "blaze" | "bone" }
> = {
  critical: {
    frame: "border-flame/50 bg-wine/60",
    title: "text-flame",
    rail: "bg-flame",
    led: "flame",
  },
  warning: {
    frame: "border-blaze/40 bg-[#1d0f08]/80",
    title: "text-blaze",
    rail: "bg-blaze",
    led: "blaze",
  },
  info: {
    frame: "border-ash/30 bg-smoke/80",
    title: "text-bone",
    rail: "bg-ash",
    led: "bone",
  },
  ok: {
    frame: "border-bone/20 bg-smoke/60",
    title: "text-bone/90",
    rail: "bg-bone/60",
    led: "bone",
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Alert({ tone = "info", title, className, children }: AlertProps) {
  const t = toneClasses[tone];
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn("relative flex gap-3 border px-4 py-3", t.frame, className)}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", t.rail)} />
      <Led tone={t.led} pulse={tone === "critical"} className="mt-1 shrink-0" />
      <div className="min-w-0">
        {title !== undefined && (
          <div
            className={cn(
              "font-display text-[11px] font-bold uppercase tracking-[0.2em]",
              t.title,
            )}
          >
            {title}
          </div>
        )}
        <div className="mt-0.5 text-xs leading-relaxed text-bone/75">{children}</div>
      </div>
    </div>
  );
}
