"use client";

import { useMemo } from "react";
import { needsAttention } from "@/components/equipment/shared";
import { Led } from "@/components/ui";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

export type ResourceTab = "vehicles" | "equipment" | "people";

const COMMITTED: ReadonlySet<string> = new Set([
  "dispatched",
  "en_route",
  "on_scene",
]);
const ON_DUTY: ReadonlySet<string> = new Set([
  "on_duty",
  "dispatched",
  "en_route",
  "on_scene",
]);

export const TAB_META: Record<
  ResourceTab,
  { label: string; deck: string }
> = {
  vehicles: { label: "Vehicles", deck: "Apparatus bay" },
  equipment: { label: "Equipment", deck: "Equipment & storage" },
  people: { label: "Personnel", deck: "Personnel roster" },
};

const ORDER: ResourceTab[] = ["vehicles", "equipment", "people"];

/**
 * Vertical deck-switcher rail for /resources. Self-polls the three list
 * endpoints at 4 s so every switcher shows a live count + one key stat:
 * vehicles → committed, equipment → flagged, people → on duty.
 */
export function TabRail({
  active,
  onSelect,
  orientation = "vertical",
}: {
  active: ResourceTab;
  onSelect: (tab: ResourceTab) => void;
  /** Below xl the rail flattens into a row above the deck. */
  orientation?: "vertical" | "horizontal";
}) {
  const vehicles = usePolling(api.vehicles, 4000);
  const equipment = usePolling(api.equipment, 4000);
  const personnel = usePolling(() => api.personnel(), 4000);

  const stats = useMemo<Record<ResourceTab, { count: number | null; stat: string }>>(() => {
    const vs = vehicles.data;
    const es = equipment.data;
    const ps = personnel.data;
    return {
      vehicles: {
        count: vs ? vs.length : null,
        stat: vs
          ? `${vs.filter((v) => COMMITTED.has(v.status)).length} committed`
          : "— committed",
      },
      equipment: {
        count: es ? es.length : null,
        stat: es ? `${es.filter(needsAttention).length} flagged` : "— flagged",
      },
      people: {
        count: ps ? ps.length : null,
        stat: ps
          ? `${ps.filter((p) => ON_DUTY.has(p.status)).length} on duty`
          : "— on duty",
      },
    };
  }, [vehicles.data, equipment.data, personnel.data]);

  const horizontal = orientation === "horizontal";

  return (
    <div className={cn(horizontal ? "flex items-stretch gap-3" : "space-y-3")}>
      {ORDER.map((id) => {
        const isActive = id === active;
        const s = stats[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isActive}
            className={cn(
              "clip-tag group relative border px-3.5 py-3 text-left transition-colors duration-200 [--chamfer:10px]",
              horizontal ? "min-w-0 flex-1" : "block w-full",
              isActive
                ? "border-flame/60 bg-wine/40 shadow-[0_0_18px_rgb(255_46_46/0.15)]"
                : "border-ash/15 bg-smoke/50 backdrop-blur-sm hover:border-flame/40 hover:bg-wine/20",
            )}
          >
            <span className="flex items-center gap-2.5">
              <Led
                tone={isActive ? "flame" : "off"}
                pulse={isActive}
                size="sm"
              />
              <span
                className={cn(
                  "truncate font-mono text-[10px] uppercase tracking-[0.25em] transition-colors",
                  isActive
                    ? "text-flame text-glow"
                    : "text-ash group-hover:text-bone",
                )}
              >
                {TAB_META[id].label}
              </span>
              <span
                className={cn(
                  "ml-auto font-display text-lg font-black tabular-nums leading-none",
                  isActive ? "text-flame" : "text-bone/80",
                )}
              >
                {s.count ?? "—"}
              </span>
            </span>
            <span
              className={cn(
                "mt-1.5 block truncate pl-[18px] font-mono text-[9px] uppercase tracking-[0.2em]",
                isActive ? "text-blaze/90" : "text-ash/70",
              )}
            >
              {s.stat}
            </span>
          </button>
        );
      })}

      {!horizontal && (
        <div className="border border-ash/15 bg-ink/60 px-3.5 py-2.5 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
          <span className="text-ash/60">deck // </span>
          <span className="text-flame">{TAB_META[active].deck}</span>
        </div>
      )}
    </div>
  );
}
