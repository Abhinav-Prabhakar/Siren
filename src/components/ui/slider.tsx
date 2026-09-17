import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  /** Show the current value on the right. */
  showValue?: boolean;
  value?: number;
}

export function Slider({
  label,
  showValue = false,
  value,
  className,
  id,
  ...props
}: SliderProps) {
  return (
    <label className="block" htmlFor={id}>
      {(label !== undefined || showValue) && (
        <span className="mb-1.5 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em]">
          <span className="text-ash">{label}</span>
          {showValue && <span className="text-bone/80">{value}</span>}
        </span>
      )}
      <input
        id={id}
        type="range"
        value={value}
        className={cn("siren-range", className)}
        {...props}
      />
    </label>
  );
}
