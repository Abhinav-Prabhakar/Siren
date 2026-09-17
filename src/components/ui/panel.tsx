import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PanelLed = "off" | "on" | "pulse";

const ledLampClasses: Record<PanelLed, string> = {
  off: "bg-ash/25 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]",
  on: "bg-flame shadow-[0_0_8px_1px_rgb(255_46_46/0.8),inset_0_1px_0_rgb(255_255_255/0.6)]",
  pulse:
    "bg-blaze shadow-[0_0_10px_2px_rgb(255_106_61/0.9),inset_0_1px_0_rgb(255_255_255/0.6)] animate-pulse",
};

function LedLamp({ led }: { led: PanelLed }) {
  return (
    <span
      aria-hidden
      className="flex h-2.5 w-2.5 shrink-0 items-center justify-center bg-ink/80 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.08)]"
    >
      <span className={cn("h-1.5 w-1.5", ledLampClasses[led])} />
    </span>
  );
}

function Corners() {
  const brackets = [
    "-left-px -top-px border-l-2 border-t-2",
    "-right-px -top-px border-r-2 border-t-2",
    "-bottom-px -left-px border-b-2 border-l-2",
    "-bottom-px -right-px border-b-2 border-r-2",
  ];
  const rivets = [
    "-left-[3px] -top-[3px]",
    "-right-[3px] -top-[3px]",
    "-bottom-[3px] -left-[3px]",
    "-bottom-[3px] -right-[3px]",
  ];
  return (
    <>
      {brackets.map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn("absolute h-3.5 w-3.5 border-flame", pos)}
        />
      ))}
      {/* machined rivets straddling each corner point */}
      {rivets.map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn(
            "absolute h-[5px] w-[5px] rotate-45 bg-gradient-to-br from-blaze to-blood shadow-[inset_0_0_1px_rgb(0_0_0/0.7),0_0_6px_rgb(255_46_46/0.35)]",
            pos,
          )}
        />
      ))}
    </>
  );
}

export interface PanelProps {
  title?: string;
  right?: ReactNode;
  /** Status lamp on the title bar. */
  led?: PanelLed;
  /** Render with chamfered corners + clipped frame instead of brackets. */
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
        <header className="relative flex items-center justify-between gap-4 overflow-hidden border-b border-flame/15 bg-gradient-to-b from-smoke/70 to-coal/60 px-4 py-2.5">
          {/* hazard rail on the nameplate edge */}
          <span
            aria-hidden
            className="bg-hazard-tight absolute inset-y-0 left-0 w-[3px] opacity-30"
          />
          <h3 className="flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.35em] text-flame [text-shadow:0_1px_0_rgb(0_0_0/0.8)]">
            {led !== undefined && <LedLamp led={led} />}
            <span className="text-ash">{"//"}</span>
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
        className={cn(
          "clip-chamfer bg-gradient-to-b from-flame/40 via-flame/15 to-blood/30 p-px [--chamfer:18px]",
          className,
        )}
      >
        <div className="clip-chamfer bg-coal/90 backdrop-blur-sm [--chamfer:17px]">
          {inner}
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative border border-flame/15 bg-coal/80 backdrop-blur-sm",
        className,
      )}
    >
      <Corners />
      {inner}
    </section>
  );
}
