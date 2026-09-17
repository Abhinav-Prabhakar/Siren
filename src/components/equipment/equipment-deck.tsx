"use client";

import { useMemo, useState } from "react";
import { AttentionPanel } from "@/components/equipment/attention-panel";
import { EquipmentDetailModal } from "@/components/equipment/equipment-detail-modal";
import { InventoryTable } from "@/components/equipment/inventory-table";
import { ReadinessStrip } from "@/components/equipment/readiness-strip";
import {
  CategoryIcon,
  MONITORING,
} from "@/components/equipment/monitoring";
import {
  CATEGORIES,
  needsAttention,
  severityRank,
  type CategoryFilter,
} from "@/components/equipment/shared";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Led,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Switch,
  Tabs,
} from "@/components/ui";
import { api, type EquipmentStatus } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

const STATUS_OPTIONS: { value: "all" | EquipmentStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "Ready" },
  { value: "in_use", label: "In use" },
  { value: "maintenance", label: "Maintenance" },
  { value: "missing", label: "Missing" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[480px] w-full" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    </div>
  );
}

/**
 * Full equipment deck — extracted from the old /equipment page for the
 * consolidated /resources view. Page chrome (ConsoleNav, back link,
 * page background) is handled by the resources shell; everything else
 * is preserved: readiness strip, search/status/category filters,
 * inventory table, attention panel, detail modal.
 */
export function EquipmentDeck() {
  const { data, error, loading, refresh } = usePolling(api.equipment, 4000);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<"all" | EquipmentStatus>("all");
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [groupByVehicle, setGroupByVehicle] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const items = useMemo(() => data ?? [], [data]);

  const flaggedCount = useMemo(
    () => items.filter(needsAttention).length,
    [items],
  );
  const missingCount = useMemo(
    () => items.filter((i) => i.status === "missing").length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => status === "all" || i.status === status)
      .filter(
        (i) =>
          q === "" ||
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.serial.toLowerCase().includes(q),
      )
      .filter((i) => !onlyAttention || needsAttention(i))
      .sort(
        (a, b) =>
          severityRank(a) - severityRank(b) || a.name.localeCompare(b.name),
      );
  }, [items, category, status, query, onlyAttention]);

  const categoryTabs = useMemo(
    () => [
      { id: "all" as const, label: "All", count: items.length },
      ...CATEGORIES.map((cat) => {
        const inCat = items.filter((i) => i.category === cat);
        return {
          id: cat,
          label: cat,
          count: inCat.length,
          led: inCat.some(needsAttention) ? ("flame" as const) : undefined,
        };
      }),
    ],
    [items],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Equipment <span className="text-flame text-glow">&amp; storage</span>
          </>
        }
        sub="Inventory telemetry // STA-01"
        status={
          <span className="flex items-center gap-3">
            <Led tone={error ? "flame" : "blaze"} pulse size="sm" />
            <Badge
              tone={
                flaggedCount === 0 ? "cold" : missingCount > 0 ? "hot" : "warm"
              }
            >
              {flaggedCount === 0
                ? "Manifest clear"
                : `${flaggedCount} flagged`}
            </Badge>
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            led={error ? "pulse" : "off"}
            onClick={refresh}
          >
            Resync
          </Button>
        }
      />

      {error && items.length === 0 && (
        <Alert tone="critical" title="Backend unreachable">
          Equipment uplink failed — {error}. Check the FastAPI server at
          localhost:8000, then resync.
        </Alert>
      )}
      {error && items.length > 0 && (
        <Alert tone="warning" title="Uplink degraded">
          {error} — showing last synced manifest; telemetry may be stale.
        </Alert>
      )}

      {loading && items.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <>
          <ReadinessStrip items={items} />

          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Inventory // manifest"
              led="on"
              right={
                <span>
                  {filtered.length}/{items.length} shown
                </span>
              }
              bodyClassName="space-y-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Input
                  id="equip-search"
                  label="Search // id, name, serial"
                  glyph="⌖"
                  placeholder="HOS-01 · THERMAL · SN-4471…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Select
                  id="equip-status"
                  label="Status filter"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "all" | EquipmentStatus)
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <Checkbox
                  label="Needs attention only"
                  checked={onlyAttention}
                  onCheckedChange={setOnlyAttention}
                />
                <Switch
                  label="Group by vehicle"
                  checked={groupByVehicle}
                  onCheckedChange={setGroupByVehicle}
                />
              </div>

              <div className="overflow-x-auto">
                <Tabs
                  tabs={categoryTabs}
                  activeId={category}
                  onChange={(id) => setCategory(id as CategoryFilter)}
                  className="w-max min-w-full"
                />
              </div>

              {category !== "all" && (
                <div className="flex items-center gap-3 border border-flame/15 bg-coal/50 px-3 py-2">
                  <CategoryIcon
                    category={category}
                    size={30}
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-flame">
                      {"// "}
                      {MONITORING[category].headline}
                    </div>
                    <div className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-ash/90">
                      {MONITORING[category].brief}
                    </div>
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="border border-flame/15 bg-ink/60 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
                  No items match the active filters
                </p>
              ) : (
                <InventoryTable
                  items={filtered}
                  groupByVehicle={groupByVehicle}
                  onSelect={setSelected}
                />
              )}
            </Panel>

            <AttentionPanel items={items} onSelect={setSelected} />
          </div>
        </>
      )}

      <EquipmentDetailModal id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
