"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Chamfered toggle switch. */
export function Switch({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;

  function toggle() {
    if (disabled) return;
    const next = !on;
    setInternal(next);
    onCheckedChange?.(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "group inline-flex cursor-pointer items-center gap-3 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "clip-tag relative h-6 w-11 transition-colors [--chamfer:5px]",
          on ? "bg-flame" : "bg-ash/25",
        )}
      >
        <span className="clip-tag absolute inset-px bg-ink [--chamfer:4px]" />
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-all duration-150",
            on ? "left-[calc(100%-1.25rem)] bg-flame" : "left-1 bg-ash/60",
          )}
        />
      </span>
      {label !== undefined && (
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/70 group-hover:text-bone">
          {label}
          <span className={cn("ml-2", on ? "text-flame" : "text-ash")}>
            {on ? "ON" : "OFF"}
          </span>
        </span>
      )}
    </button>
  );
}
