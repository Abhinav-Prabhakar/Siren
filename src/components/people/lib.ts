import type { LedTone } from "@/components/ui/led";
import {
  fmtClock,
  type Personnel,
  type PersonnelRole,
  type PersonnelStatus,
} from "@/lib/api";

export const ROLE_LABELS: Record<PersonnelRole, string> = {
  firefighter: "Firefighter",
  driver: "Driver / Operator",
  chief: "Chief",
  incident_commander: "Incident Cmdr",
  paramedic: "Paramedic",
};

export const ROLE_SHORT: Record<PersonnelRole, string> = {
  firefighter: "FF",
  driver: "DRV",
  chief: "CHF",
  incident_commander: "IC",
  paramedic: "MED",
};

export const STATUS_LABELS: Record<PersonnelStatus, string> = {
  on_duty: "On duty",
  dispatched: "Dispatched",
  en_route: "En route",
  on_scene: "On scene",
  resting: "Resting",
  off_duty: "Off duty",
};

/** Operational priority — lower sorts first on the roster. */
export const STATUS_ORDER: Record<PersonnelStatus, number> = {
  on_scene: 0,
  en_route: 1,
  dispatched: 2,
  on_duty: 3,
  resting: 4,
  off_duty: 5,
};

export const ALL_STATUSES: PersonnelStatus[] = [
  "on_duty",
  "dispatched",
  "en_route",
  "on_scene",
  "resting",
  "off_duty",
];

export const ALL_ROLES: PersonnelRole[] = [
  "firefighter",
  "driver",
  "chief",
  "incident_commander",
  "paramedic",
];

/** Duty-lamp tone for a status. */
export function dutyLed(status: PersonnelStatus): { tone: LedTone; pulse: boolean } {
  switch (status) {
    case "on_scene":
      return { tone: "flame", pulse: true };
    case "dispatched":
      return { tone: "blaze", pulse: false };
    case "en_route":
      return { tone: "blaze", pulse: true };
    case "on_duty":
      return { tone: "bone", pulse: false };
    default:
      return { tone: "off", pulse: false };
  }
}

export type VitalsFlag = "critical" | "warning" | null;

/**
 * Vitals triage: HR >160 or SCBA <25% is a critical alarm; approaching
 * thresholds (HR >140 / SCBA <40%) reads as a warning.
 */
export function vitalsAlert(p: Personnel): VitalsFlag {
  if (p.heart_rate > 160 || p.scba_pct < 25) return "critical";
  if (p.heart_rate > 140 || p.scba_pct < 40) return "warning";
  return null;
}

/**
 * Shift-window readout — strictly real fields: personnel carry no
 * free_at, so we show the rostered shift end (or off-watch state).
 */
export function shiftEndLabel(p: Personnel): string {
  if (p.status === "off_duty") return "Off watch";
  return `Shift end ${fmtClock(p.shift_end)}`;
}
