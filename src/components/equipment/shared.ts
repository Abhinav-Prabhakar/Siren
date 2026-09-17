import { fmtAgo, type Equipment, type EquipmentCategory } from "@/lib/api";

/** Battery at or below this reads as a charge flag. */
export const LOW_BATTERY_AT = 25;
/** Condition at or below this reads as worn in the detail view. */
export const LOW_CONDITION_AT = 40;

/** All 18 equipment categories from the schema, in manifest order. */
export const CATEGORIES: EquipmentCategory[] = [
  "hose",
  "nozzle",
  "scba",
  "ppe",
  "breaching",
  "ladder",
  "hydraulic",
  "medical",
  "rope",
  "thermal",
  "fan",
  "pump",
  "generator",
  "lighting",
  "foam",
  "hazmat",
  "radio",
  "cylinder",
];

export type CategoryFilter = "all" | EquipmentCategory;

/** maintenance | missing | low battery — the operator flag set. */
export function needsAttention(item: Equipment): boolean {
  return attentionReasons(item).length > 0;
}

export function attentionReasons(item: Equipment): string[] {
  const reasons: string[] = [];
  if (item.status === "missing") {
    reasons.push(`missing — last scan ${fmtAgo(item.updated_at)}`);
  }
  if (item.status === "maintenance") {
    reasons.push("held in maintenance queue");
  }
  if (item.battery_pct !== null && item.battery_pct <= LOW_BATTERY_AT) {
    reasons.push(`battery ${Math.round(item.battery_pct)}% — recharge`);
  }
  return reasons;
}

/** Sort rank — problems surface first, then committed, then ready. */
export function severityRank(item: Equipment): number {
  if (item.status === "missing") return 0;
  if (item.status === "maintenance") return 1;
  if (item.battery_pct !== null && item.battery_pct <= LOW_BATTERY_AT) return 2;
  if (item.status === "in_use") return 3;
  return 4;
}

/** "in_use" → "in use" for display. */
export function fmtStatus(status: string): string {
  return status.replace(/_/g, " ");
}

/** ISO → "MM-DD HH:MM" for log/timeline stamps. */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "--/-- --:--";
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}
