import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <label className="block" htmlFor={id}>
      {label !== undefined && (
        <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          {label}
        </span>
      )}
      <span className="flex border border-ash/25 bg-ink px-3 py-2 transition focus-within:border-flame">
        <textarea
          id={id}
          className={cn(
            "min-h-24 w-full resize-y bg-transparent font-mono text-xs leading-relaxed tracking-wider text-bone caret-flame outline-none placeholder:text-ash/50",
            className,
          )}
          {...props}
        />
      </span>
    </label>
  );
}
