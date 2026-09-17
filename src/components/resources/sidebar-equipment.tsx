"use client";

import { useMemo, useState } from "react";
import {
  BatteryLow,
  Package,
  Search,
  TriangleAlert,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { CategoryIcon, countdownState, MONITORING } from "@/components/equipment/monitoring";
import {
  fmtStatus,
  LOW_BATTERY_AT,
  needsAttention,
} from "@/components/equipment/shared";
import { EquipmentDetailModal } from "@/components/equipment/equipment-detail-modal";
import { Led, Skeleton, type BadgeTone } from "@/components/ui";
import { fmtAgo, statusTone, type Equipment } from "@/lib/api";
import type { Feed } from "./sidebar";
import {
  DockCell,
  GroupLabel,
  IconChip,
  InspectorDock,
  Row,
  RowMeta,
  TONE_TEXT,
} from "./rows";

const STATUS_SHORT: Record<Equipment["status"], string> = {
  ready: "rdy",
  in_use: "in use",
  maintenance: "maint",
  missing: "miss",
};

/** Right-edge glyph — problems get icons, healthy stays quiet. */
function statusGlyph(item: Equipment): { Icon: LucideIcon; className: string } | null {
  if (item.status === "missing") {
    return { Icon: TriangleAlert, className: "text-flame animate-pulse" };
  }
  if (item.status === "maintenance") {
    return { Icon: Wrench, className: "text-blaze" };
  }
  if (item.battery_pct !== null && item.battery_pct <= LOW_BATTERY_AT) {
    return { Icon: BatteryLow, className: "text-blaze" };
  }
  return null;
}

function chipTone(item: Equipment): BadgeTone {
  if (needsAttention(item)) return "hot";
  return statusTone(item.status);
}

function EquipmentRow({
  item,
  onSelect,
  onHover,
}: {
  item: Equipment;
  onSelect: (id: string) => void;
  onHover: (i: Equipment | null) => void;
}) {
  const glyph = statusGlyph(item);
  const cd = countdownState(item);
  return (
    <Row
      onClick={() => onSelect(item.id)}
      onHover={(h) => onHover(h ? item : null)}
    >
      <IconChip tone={chipTone(item)}>
        <CategoryIcon category={item.category} size={20} />
      </IconChip>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.08em] text-bone">
          {item.name}
        </span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
          {item.id} · {item.vehicle_id ?? "stores"}
        </span>
      </span>
      <RowMeta
        top={
          glyph === null ? (
            STATUS_SHORT[item.status]
          ) : (
            <glyph.Icon className={`h-3.5 w-3.5 ${glyph.className}`} />
          )
        }
        topClassName={glyph === null ? TONE_TEXT[statusTone(item.status)] : undefined}
        bottom={
          cd.overdue ? (
            <span className="text-flame">+{Math.abs(cd.dueInDays)}d</span>
          ) : (
            `d-${cd.dueInDays}`
          )
        }
      />
    </Row>
  );
}

function EquipmentInspector({
  item,
  all,
}: {
  item: Equipment | null;
  all: Equipment[] | null;
}) {
  const mon = item === null ? null : MONITORING[item.category];
  const cd = item === null ? null : countdownState(item);
  return (
    <InspectorDock
      title={item === null ? null : `${item.id} — ${item.name}`}
      icon={
        item === null ? (
          <Package className="h-3.5 w-3.5 text-flame" />
        ) : (
          <CategoryIcon category={item.category} size={16} />
        )
      }
      idle={
        all !== null && (
          <>
            <span>
              <span className="text-bone/70">
                {all.filter(needsAttention).length}
              </span>{" "}
              flagged
            </span>
            <span>
              <span className="text-bone/70">
                {all.filter((i) => i.status === "in_use").length}
              </span>{" "}
              in use
            </span>
            <span>
              <span className="text-bone/70">
                {all.filter((i) => i.status === "ready").length}
              </span>{" "}
              ready
            </span>
          </>
        )
      }
    >
      {item !== null && mon !== null && cd !== null && (
        <>
          <DockCell label="Task">
            {fmtStatus(item.status)} · {item.vehicle_id ?? "stores"}
          </DockCell>
          <DockCell label="Serial">{item.serial}</DockCell>
          <DockCell label={mon.countdown.label}>
            {cd.overdue
              ? `+${Math.abs(cd.dueInDays)}d overdue`
              : `d-${cd.dueInDays} · chk ${fmtAgo(item.last_check)}`}
          </DockCell>
          <DockCell label="Battery">
            {item.battery_pct === null
              ? "passive"
              : `${Math.round(item.battery_pct)}%`}
          </DockCell>
          <DockCell label="Condition">{Math.round(item.condition_pct)}%</DockCell>
          <DockCell label="Updated">{fmtAgo(item.updated_at)}</DockCell>
        </>
      )}
    </InspectorDock>
  );
}

export function EquipmentList({ feed }: { feed: Feed<Equipment> }) {
  const { data, error, loading } = feed;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Equipment | null>(null);

  const searching = query.trim() !== "";
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (i) =>
        q === "" ||
        i.id.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.serial.toLowerCase().includes(q),
    );
  }, [data, query]);

  const groups = useMemo(() => {
    if (searching) return null;
    const flagged = items.filter(needsAttention);
    const inUse = items.filter(
      (i) => i.status === "in_use" && !needsAttention(i),
    );
    const ready = items.filter(
      (i) => i.status === "ready" && !needsAttention(i),
    );
    const byName = (a: Equipment, b: Equipment) => a.name.localeCompare(b.name);
    return [
      { label: "Flagged", items: flagged.sort(byName) },
      { label: "In use", items: inUse.sort(byName) },
      { label: "Ready", items: ready.sort(byName) },
    ].filter((g) => g.items.length > 0);
  }, [items, searching]);

  let body;
  if (data === null && loading) {
    body = (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (data === null) {
    body = (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Manifest feed down"}
        </span>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="flex items-center gap-3 px-4 py-6">
        <Package className="h-4 w-4 text-ash/50" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          No items match
        </span>
      </div>
    );
  } else if (groups === null) {
    body = [...items]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => (
        <EquipmentRow
          key={i.id}
          item={i}
          onSelect={setSelected}
          onHover={setInspected}
        />
      ));
  } else {
    body = groups.map((g) => (
      <div key={g.label}>
        <GroupLabel label={g.label} count={g.items.length} />
        {g.items.map((i) => (
          <EquipmentRow
            key={i.id}
            item={i}
            onSelect={setSelected}
            onHover={setInspected}
          />
        ))}
      </div>
    ));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* search — the manifest is long, reach it by id/name/serial */}
      <div className="shrink-0 border-b border-flame/15 px-4 py-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">{body}</div>
      <EquipmentInspector item={inspected} all={data} />
      {selected && (
        <EquipmentDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
