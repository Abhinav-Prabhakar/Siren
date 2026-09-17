import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Led } from "@/components/ui/led";

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

export interface SlideFrameProps {
  /** "01" … "06" */
  index: string;
  /** section tag, e.g. "SOLUTION" */
  section: string;
  /** big display headline — omit with bleed for full-bleed slides */
  title?: ReactNode;
  /** mono kicker line under the headline */
  sub?: ReactNode;
  /** total slide count for the footer counter */
  total?: number;
  /** paint the whole stage — no header/title/footer chrome (cover slide) */
  bleed?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/**
 * One 1920×1080 slide stage. The deck scales this fixed canvas to the
 * viewport — inside the frame everything is authored in stage pixels.
 */
export function SlideFrame({
  index,
  section,
  title,
  sub,
  total = 6,
  bleed = false,
  className,
  bodyClassName,
  children,
}: SlideFrameProps) {
  if (bleed) {
    return (
      <section
        className={cn(
          "relative shrink-0 overflow-hidden bg-ink text-bone",
          className,
        )}
        style={{ width: SLIDE_W, height: SLIDE_H }}
      >
        {children}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden bg-ink text-bone",
        className,
      )}
      style={{ width: SLIDE_W, height: SLIDE_H }}
    >
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="bg-scanlines pointer-events-none absolute inset-0 opacity-30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-flame/25"
      />

      <header className="relative flex items-center justify-between border-b border-flame/15 px-16 py-6">
        <div className="flex items-center gap-4">
          <Led tone="flame" pulse />
          <span className="font-mono text-[13px] uppercase tracking-[0.4em] text-ash">
            Slide {index} <span className="text-flame">{"//"}</span> {section}
          </span>
        </div>
        <span className="font-mono text-[12px] uppercase tracking-[0.35em] text-ash/70">
          Siren {"//"} pitch-deck
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col px-16 pt-9">
        {title !== undefined && (
          <h1 className="font-display text-[64px] font-black uppercase leading-[0.95] tracking-[0.04em] text-bone text-glow">
            {title}
          </h1>
        )}
        {sub !== undefined && (
          <p className="mt-3 font-mono text-[15px] uppercase tracking-[0.25em] text-ash">
            {sub}
          </p>
        )}
        <div className={cn("mt-8 min-h-0 flex-1", bodyClassName)}>
          {children}
        </div>
      </div>

      <footer className="relative flex items-center justify-between border-t border-flame/15 px-16 py-5">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-ash">
          <span
            aria-hidden
            className="clip-tag inline-block h-3 w-3 bg-flame [--chamfer:3px]"
          />
          STA-01 {"//"} Siren
        </div>
        <div aria-hidden className="bg-hazard-tight h-[6px] w-44 opacity-40" />
        <span className="font-mono text-[11px] tracking-[0.3em] text-ash">
          {index} / {String(total).padStart(2, "0")}
        </span>
      </footer>
    </section>
  );
}
