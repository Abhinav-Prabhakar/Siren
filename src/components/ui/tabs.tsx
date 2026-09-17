"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Led, type LedTone } from "./led";

export interface TabItem {
  id: string;
  label: string;
  led?: LedTone;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId?: string;
  defaultId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({
  tabs,
  activeId,
  defaultId,
  onChange,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultId ?? tabs[0]?.id);
  const active = activeId ?? internal;

  return (
    <div
      role="tablist"
      className={cn("flex items-stretch gap-1 border-b border-flame/20", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              setInternal(tab.id);
              onChange?.(tab.id);
            }}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] transition-colors",
              isActive
                ? "bg-flame/10 text-flame"
                : "text-ash hover:bg-flame/5 hover:text-bone",
            )}
          >
            {tab.led !== undefined && <Led tone={tab.led} size="sm" pulse={isActive} />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("text-[9px]", isActive ? "text-flame/70" : "text-ash/60")}>
                {tab.count}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-[2px] bg-flame transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
