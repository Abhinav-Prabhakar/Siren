import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  return (
    <label className="block" htmlFor={id}>
      {label !== undefined && (
        <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          {label}
        </span>
      )}
      <span className="relative flex items-center border border-ash/25 bg-ink transition focus-within:border-flame focus-within:shadow-[0_0_0_1px_var(--color-flame),0_0_18px_-4px_rgb(255_46_46/0.6)]">
        <select
          id={id}
          className={cn(
            "h-10 w-full cursor-pointer appearance-none bg-transparent px-3 font-mono text-xs tracking-wider text-bone outline-none",
            "[&>option]:bg-coal [&>option]:text-bone",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 font-mono text-xs text-flame"
        >
          {"//"}
        </span>
      </span>
    </label>
  );
}
