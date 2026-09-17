"use client";

import { useMemo, useState } from "react";
import {
  BatteryLow,
  Package,
  Search,
  TriangleAlert,
  Truck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { CategoryIcon } from "@/components/equipment/monitoring";
import {
  LOW_BATTERY_AT,
  severityRank,
} from "@/components/equipment/shared";
import { EquipmentDetailModal } from "@/components/equipment/equipment-detail-modal";
import { Led, Skeleton } from "@/components/ui";
import { type Equipment } from "@/lib/api";
import type { Feed } from "./sidebar";
import { MiniBar, Row } from "./rows";

/** One status glyph — problems get icons, healthy stays quiet. */
function statusGlyph(item: Equipment): { Icon: LucideIcon; className: string } | null {
  if (item.status === "missing") {
    return { Icon: TriangleAlert, className: "text-flame animate-pulse" };
  }
  if (item.status === "maintenance") {
    return { Icon: Wrench, className: "text-blaze" };
  }
  if (item.status === "in_use") {
    return { Icon: Truck, className: "text-blaze/80" };
  }
  if (item.battery_pct !== null && item.battery_pct <= LOW_BATTERY_AT) {
    return { Icon: BatteryLow, className: "text-blaze" };
  }
  return null;
}

function EquipmentRow({
  item,
  onSelect,
}: {
  item: Equipment;
  onSelect: (id: string) => void;
}) {
  const glyph = statusGlyph(item);
  const powered = item.battery_pct !== null;
  return (
    <Row onClick={() => onSelect(item.id)}>
      <CategoryIcon category={item.category} size={26} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-[13px] font-bold uppercase tracking-[0.08em] text-bone">
            {item.name}
          </span>
          {glyph !== null && (
            <glyph.Icon className={`h-3.5 w-3.5 shrink-0 ${glyph.className}`} />
          )}
        </div>
        <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ash">
          {item.id}
          {" · "}
          {item.vehicle_id ?? "stores"}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <MiniBar value={item.condition_pct} lowAt={40} />
          {powered && (
            <span
              className={`flex shrink-0 items-center gap-1 font-mono text-[9px] tabular-nums ${
                (item.battery_pct ?? 0) <= LOW_BATTERY_AT
                  ? "text-blaze"
                  : "text-ash/70"
              }`}
            >
              <BatteryLow className="h-3 w-3" />
              {Math.round(item.battery_pct ?? 0)}%
            </span>
          )}
        </div>
      </div>
    </Row>
  );
}

export function EquipmentList({ feed }: { feed: Feed<Equipment> }) {
  const { data, error, loading } = feed;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter(
        (i) =>
          q === "" ||
          i.id.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.serial.toLowerCase().includes(q),
      )
      .sort((a, b) => severityRank(a) - severityRank(b) || a.name.localeCompare(b.name));
  }, [data, query]);

  if (data === null && loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Manifest feed down"}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* search — the manifest is long, reach it by id/name/serial */}
      <div className="sticky top-0 z-10 border-b border-flame/15 bg-coal px-4 py-2">
        <div className="flex items-center gap-2 border border-ash/20 bg-ink px-2.5 focus-within:border-flame">
          <Search className="h-3.5 w-3.5 shrink-0 text-ash/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="id · name · serial"
            className="h-8 w-full bg-transparent font-mono text-[10px] uppercase tracking-[0.15em] text-bone outline-none placeholder:text-ash/40"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 cursor-pointer text-ash/60 hover:text-flame"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6">
          <Package className="h-4 w-4 text-ash/50" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            No items match
          </span>
        </div>
      ) : (
        items.map((i) => (
          <EquipmentRow key={i.id} item={i} onSelect={setSelected} />
        ))
      )}

      {selected && (
        <EquipmentDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
