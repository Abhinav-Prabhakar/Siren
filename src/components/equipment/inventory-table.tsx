"use client";

import type { KeyboardEvent } from "react";
import { Badge, Meter } from "@/components/ui";
import { fmtAgo, statusTone, type Equipment } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CategoryIcon,
  countdownState,
  MONITORING,
} from "./monitoring";
import { fmtStatus, LOW_CONDITION_AT } from "./shared";

const HEADERS = [
  "ID",
  "Item",
  "Category",
  "Status",
  "Assignment",
  "Battery",
  "Condition",
  "Last check",
];

function CellMeter({ label, value, lowAt }: { label: string; value: number; lowAt?: number }) {
  return (
    <div className="w-24">
      <Meter label={label} value={value} segments={8} lowAt={lowAt} />
    </div>
  );
}

function ItemRow({
  item,
  onSelect,
}: {
  item: Equipment;
  onSelect: (id: string) => void;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(item.id);
    }
  }

  const mon = MONITORING[item.category];
  const cd = countdownState(item);

  return (
    <tr
      tabIndex={0}
      onClick={() => onSelect(item.id)}
      onKeyDown={onKeyDown}
      className="cursor-pointer border-b border-flame/10 transition-colors last:border-b-0 hover:bg-flame/5 focus-visible:bg-flame/10 focus-visible:outline-none"
      title={`Inspect ${item.id}`}
    >
      <td className="px-3 py-1.5 font-mono text-xs text-flame">{item.id}</td>
      <td className="px-3 py-1.5 text-xs font-semibold text-bone/90">
        <span className="flex items-center gap-2.5">
          <CategoryIcon
            category={item.category}
            size={28}
            className="shrink-0"
          />
          <span>
            {item.name}
            <span className="block font-mono text-[9px] font-normal uppercase tracking-[0.2em] text-ash/70">
              SN {item.serial}
            </span>
          </span>
        </span>
      </td>
      <td className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
        {item.category}
      </td>
      <td className="px-3 py-1.5">
        <Badge tone={statusTone(item.status)}>{fmtStatus(item.status)}</Badge>
      </td>
      <td className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/70">
        {item.vehicle_id ?? <span className="text-ash">stores</span>}
      </td>
      <td className="px-3 py-1.5">
        {item.battery_pct === null || mon.cellLabel === null ? (
          <span className="font-mono text-xs text-ash">—</span>
        ) : (
          <CellMeter label={mon.cellLabel} value={item.battery_pct} />
        )}
      </td>
      <td className="px-3 py-1.5">
        <CellMeter
          label={mon.integrityLabel}
          value={item.condition_pct}
          lowAt={LOW_CONDITION_AT}
        />
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-[10px] tracking-wider text-ash">
        {fmtAgo(item.last_check)}
        <span
          className={cn(
            "block text-[9px] uppercase tracking-[0.2em]",
            cd.overdue ? "text-flame" : "text-ash/60",
          )}
          title={`${mon.countdown.label} horizon — ${mon.countdown.intervalDays}d cycle`}
        >
          {cd.overdue
            ? `${mon.countdown.label} +${Math.abs(cd.dueInDays)}d`
            : `${mon.countdown.label} d-${cd.dueInDays}`}
        </span>
      </td>
    </tr>
  );
}

/**
 * Dense manifest table — same visual language as DataTable, with
 * full-row click/keyboard activation and optional vehicle grouping.
 */
export function InventoryTable({
  items,
  groupByVehicle,
  onSelect,
}: {
  items: Equipment[];
  groupByVehicle: boolean;
  onSelect: (id: string) => void;
}) {
  const groups: { key: string; label: string; items: Equipment[] }[] =
    groupByVehicle
      ? Array.from(
          items.reduce((acc, item) => {
            const key = item.vehicle_id ?? "__stores__";
            const list = acc.get(key) ?? [];
            list.push(item);
            acc.set(key, list);
            return acc;
          }, new Map<string, Equipment[]>()),
        )
          .sort(([a], [b]) => {
            if (a === "__stores__") return 1;
            if (b === "__stores__") return -1;
            return a.localeCompare(b);
          })
          .map(([key, list]) => ({
            key,
            label: key === "__stores__" ? "STATION STORES" : key,
            items: list,
          }))
      : [{ key: "__all__", label: "", items }];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-flame/25">
            {HEADERS.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-3 pb-2 font-mono text-[9px] font-normal uppercase tracking-[0.25em] text-ash",
                  i === HEADERS.length - 1 && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            {groupByVehicle && (
              <tr className="border-b border-flame/20 bg-wine/30">
                <td
                  colSpan={HEADERS.length}
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-flame/90"
                >
                  {"// "}
                  {group.label}
                  <span className="ml-3 text-ash">{group.items.length} items</span>
                </td>
              </tr>
            )}
            {group.items.map((item) => (
              <ItemRow key={item.id} item={item} onSelect={onSelect} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
