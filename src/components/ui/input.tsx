import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Glyph shown before the field. Pass null to hide. */
  glyph?: string | null;
}

export function Input({
  label,
  glyph = "›",
  className,
  id,
  ...props
}: InputProps) {
  return (
    <label className="block" htmlFor={id}>
      {label !== undefined && (
        <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          {label}
        </span>
      )}
      <span className="group relative flex items-center gap-2 overflow-hidden border border-ash/25 bg-ink px-3 transition focus-within:border-flame focus-within:bg-wine/40 focus-within:shadow-[0_0_0_1px_var(--color-flame),0_0_18px_-4px_rgb(255_46_46/0.6)]">
        {glyph !== null && (
          <span aria-hidden className="font-mono text-xs text-flame">
            {glyph}
          </span>
        )}
        <input
          id={id}
          className={cn(
            "h-10 w-full bg-transparent font-mono text-xs tracking-wider text-bone caret-flame outline-none placeholder:text-ash/50",
            className,
          )}
          {...props}
        />
        {/* armed lamp — lights when the field has focus */}
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 bg-ash/25 shadow-[inset_0_1px_1px_rgb(0_0_0/0.7)] transition group-focus-within:bg-flame group-focus-within:shadow-[0_0_8px_1px_rgb(255_46_46/0.8)]"
        />
        {/* arming bar — sweeps in under the field on focus */}
        <span
          aria-hidden
          className="bg-hazard-tight absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-focus-within:scale-x-100"
        />
      </span>
    </label>
  );
}
