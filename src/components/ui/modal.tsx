"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Led } from "./led";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Status lamp next to the title. */
  led?: "flame" | "blaze" | "bone" | "off";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Alarm-styled dialog — dispatch approvals live here. */
export function Modal({
  open,
  onClose,
  title,
  led = "flame",
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        aria-hidden
        className="bg-scanlines absolute inset-0 bg-ink/85 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "clip-chamfer relative w-full max-w-lg bg-flame/40 [--chamfer:20px]",
          className,
        )}
      >
        <div className="clip-chamfer m-px bg-coal [--chamfer:19px]">
          <div aria-hidden className="bg-hazard-tight h-1.5 w-full opacity-70" />
          {title !== undefined && (
            <header className="flex items-center gap-2.5 border-b border-flame/20 bg-wine/40 px-5 py-3">
              <Led tone={led} pulse={led === "flame"} />
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.25em] text-bone [text-shadow:0_1px_0_rgb(0_0_0/0.8)]">
                {title}
              </h2>
            </header>
          )}
          <div className="px-5 py-4">{children}</div>
          {footer !== undefined && (
            <footer className="flex items-center justify-end gap-3 border-t border-flame/15 px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
