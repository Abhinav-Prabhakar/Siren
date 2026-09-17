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

/** Chunky industrial toggle — reads as a physical console switch. */
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
          "clip-tag relative h-6 w-12 transition-colors [--chamfer:5px]",
          on ? "bg-flame" : "bg-ash/30",
        )}
      >
        <span
          className={cn(
            "clip-tag absolute inset-px transition-colors [--chamfer:4px]",
            on ? "bg-wine" : "bg-ink",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-all duration-150",
            "bg-gradient-to-b shadow-[0_1px_2px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.3)]",
            on
              ? "left-[calc(100%-1.25rem)] from-blaze via-flame to-blood shadow-[0_0_10px_rgb(255_46_46/0.6)]"
              : "left-1 from-ash/70 via-ash/50 to-ink",
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
