import { BarChart, Divider, Panel, Stat } from "@/components/ui";
import type { Equipment } from "@/lib/api";
import { CATEGORIES } from "./shared";

/**
 * Top-of-deck readiness summary — status counts plus per-category
 * ready share so thin spots in the manifest read at a glance.
 */
export function ReadinessStrip({ items }: { items: Equipment[] }) {
  const count = (status: string) =>
    items.filter((i) => i.status === status).length;

  const ready = count("ready");
  const inUse = count("in_use");
  const maintenance = count("maintenance");
  const missing = count("missing");

  const byCategory = CATEGORIES.flatMap((cat) => {
    const inCat = items.filter((i) => i.category === cat);
    if (inCat.length === 0) return [];
    const readyInCat = inCat.filter((i) => i.status === "ready").length;
    return [
      {
        label: cat,
        value: Math.round((readyInCat / inCat.length) * 100),
        muted: readyInCat === 0,
      },
    ];
  });

  return (
    <Panel
      title="Readiness // station manifest"
      led={missing > 0 ? "pulse" : "on"}
      right={
        <span>
          {items.length} tracked // {ready} ready
        </span>
      }
      bodyClassName="space-y-6"
    >
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Tracked" value={items.length} sub="total items" />
        <Stat
          label="Ready"
          value={ready}
          sub={`${items.length ? Math.round((ready / items.length) * 100) : 0}% of manifest`}
        />
        <Stat label="In use" value={inUse} sub="committed to units" />
        <Stat
          label="Maintenance"
          value={
            <span className={maintenance > 0 ? "text-blaze" : undefined}>
              {maintenance}
            </span>
          }
          sub="bench queue"
        />
        <Stat
          label="Missing"
          value={
            <span className={missing > 0 ? "text-flame" : undefined}>
              {missing}
            </span>
          }
          sub="unaccounted"
        />
      </div>
      <Divider label="Ready share by category // %" />
      <BarChart data={byCategory} height={110} grid={3} />
    </Panel>
  );
}
