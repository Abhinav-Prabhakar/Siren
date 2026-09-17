"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
}: CheckboxProps) {
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
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "clip-tag flex h-4.5 w-4.5 items-center justify-center transition-colors [--chamfer:4px]",
          on ? "bg-flame" : "bg-ash/30 group-hover:bg-flame/60",
        )}
      >
        <span
          className={cn(
            "clip-tag flex h-[calc(100%-2px)] w-[calc(100%-2px)] items-center justify-center transition-colors [--chamfer:3px]",
            on ? "bg-wine" : "bg-ink",
          )}
        >
          <svg
            viewBox="0 0 10 10"
            className={cn(
              "h-2.5 w-2.5 stroke-flame transition-opacity",
              on ? "opacity-100" : "opacity-0",
            )}
            fill="none"
            strokeWidth="2"
            strokeLinecap="square"
          >
            <polyline points="1.5,5.5 4,8 8.5,2" />
          </svg>
        </span>
      </span>
      {label !== undefined && (
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/70 group-hover:text-bone">
          {label}
        </span>
      )}
    </button>
  );
}
