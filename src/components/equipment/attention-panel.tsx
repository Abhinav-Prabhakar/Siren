"use client";

import { Alert, Panel } from "@/components/ui";
import type { Equipment } from "@/lib/api";
import { attentionReasons, needsAttention, severityRank } from "./shared";

/**
 * Problem-first rail — missing/maintenance/low-battery items surfaced
 * as actionable alerts. Click any flag to open the item detail.
 */
export function AttentionPanel({
  items,
  onSelect,
}: {
  items: Equipment[];
  onSelect: (id: string) => void;
}) {
  const flagged = items
    .filter(needsAttention)
    .sort((a, b) => severityRank(a) - severityRank(b) || a.id.localeCompare(b.id));

  return (
    <Panel
      title="Attention // flags"
      led={flagged.length > 0 ? "pulse" : "off"}
      right={<span>{flagged.length} flagged</span>}
      bodyClassName="space-y-3"
    >
      {flagged.length === 0 ? (
        <Alert tone="ok" title="Manifest clear">
          No missing, maintenance, or low-battery flags — all tracked
          items accounted for.
        </Alert>
      ) : (
        <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
          {flagged.map((item) => {
            const critical = item.status === "missing";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="block w-full cursor-pointer text-left transition hover:brightness-125"
              >
                <Alert
                  tone={critical ? "critical" : "warning"}
                  title={`${item.id} // ${item.status === "missing" ? "missing" : item.status === "maintenance" ? "maintenance" : "low battery"}`}
                >
                  <span className="block font-semibold text-bone/90">
                    {item.name}
                  </span>
                  {attentionReasons(item).map((r) => (
                    <span key={r} className="block">
                      {r}
                    </span>
                  ))}
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                    {item.vehicle_id ?? "station stores"} — open detail ›
                  </span>
                </Alert>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
