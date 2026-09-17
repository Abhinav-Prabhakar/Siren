import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Led } from "./led";

export type PanelLed = "off" | "on" | "pulse";

const ledMap: Record<PanelLed, { tone: "flame" | "off"; pulse: boolean }> = {
  off: { tone: "off", pulse: false },
  on: { tone: "flame", pulse: false },
  pulse: { tone: "flame", pulse: true },
};

export interface PanelProps {
  title?: string;
  right?: ReactNode;
  /** Status dot on the title bar. */
  led?: PanelLed;
  /** Render with chamfered corners + clipped frame instead of a straight border. */
  chamfered?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({
  title,
  right,
  led,
  chamfered = false,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const inner = (
    <>
      {title !== undefined && (
        <header className="flex items-center justify-between gap-4 border-b border-flame/15 px-4 py-2.5">
          <h3 className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-flame">
            {led !== undefined && (
              <Led tone={ledMap[led].tone} pulse={ledMap[led].pulse} />
            )}
            {title}
          </h3>
          {right !== undefined && (
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              {right}
            </div>
          )}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </>
  );

  if (chamfered) {
    return (
      <section
        className={cn("clip-chamfer bg-flame/25 p-px [--chamfer:14px]", className)}
      >
        <div className="clip-chamfer bg-coal [--chamfer:13px]">{inner}</div>
      </section>
    );
  }

  return (
    <section className={cn("border border-flame/15 bg-coal", className)}>
      {inner}
    </section>
  );
}
