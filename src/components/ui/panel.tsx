import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Corners() {
  return (
    <>
      <span
        aria-hidden
        className="absolute -left-px -top-px h-3.5 w-3.5 border-l-2 border-t-2 border-flame"
      />
      <span
        aria-hidden
        className="absolute -right-px -top-px h-3.5 w-3.5 border-r-2 border-t-2 border-flame"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -left-px h-3.5 w-3.5 border-b-2 border-l-2 border-flame"
      />
      <span
        aria-hidden
        className="absolute -bottom-px -right-px h-3.5 w-3.5 border-b-2 border-r-2 border-flame"
      />
    </>
  );
}

export interface PanelProps {
  title?: string;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({
  title,
  right,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={cn(
        "relative border border-flame/15 bg-coal/80 backdrop-blur-sm",
        className,
      )}
    >
      <Corners />
      {title !== undefined && (
        <header className="flex items-center justify-between gap-4 border-b border-flame/15 px-4 py-2.5">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.35em] text-flame">
            <span className="mr-2 text-ash">{"//"}</span>
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
    </section>
  );
}
