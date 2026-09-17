import {
  Activity,
  Ambulance,
  Bell,
  Biohazard,
  CarFront,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  Container,
  Cross,
  Eye,
  Flame,
  Fuel,
  Hourglass,
  LifeBuoy,
  Package,
  PhoneOutgoing,
  Radio,
  Shield,
  ShieldCheck,
  Siren,
  Truck,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTone, LedTone } from "@/components/ui";

/*
 * Semantic → glyph tables for the incidents console. Lookup records (not
 * factory functions) so render code can do `TABLE[key] ?? Fallback` —
 * react-hooks/static-components rejects call results bound as JSX tags.
 */

/** Incident lifecycle → glyph. */
export const STATUS_ICONS: Record<string, LucideIcon> = {
  active: Activity,
  contained: ShieldCheck,
  monitoring: Eye,
  resolved: CheckCircle2,
};
export const STATUS_ICON_FALLBACK = CircleDot;

/** Dispatch lifecycle → glyph. */
export const DISPATCH_ICONS: Record<string, LucideIcon> = {
  pending: Hourglass,
  approved: CheckCircle2,
  rejected: XCircle,
  completed: CheckCheck,
};
export const DISPATCH_ICON_FALLBACK = CircleDot;

/** Apparatus type → glyph (pumper/ladder default to Truck). */
export const VEHICLE_ICONS: Record<string, LucideIcon> = {
  ambulance: Ambulance,
  hazmat: Biohazard,
  command: Radio,
  tender: Container,
  rescue: Wrench,
  special: Package,
};
export const VEHICLE_ICON_FALLBACK = Truck;

/** External agency service → glyph. */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  ems: Ambulance,
  medical: Ambulance,
  police: Shield,
  sheriff: Shield,
  utility: Zap,
  power: Zap,
  gas: Flame,
};
export const SERVICE_ICON_FALLBACK = PhoneOutgoing;

/**
 * `classification` is free text from the backend, so we keyword-match
 * against the dispatch vocabulary rather than trusting exact strings.
 * Returns a key into CLASSIFICATION_ICONS — never the component itself.
 */
const CLASSIFICATION_RULES: [RegExp, keyof typeof CLASSIFICATION_ICONS][] = [
  [/hazmat|chemical|toxic|spill|biohazard/, "hazmat"],
  [/gas|fuel|propane/, "gas"],
  [/fire|structure|wildland|smoke|burn|flame|blaze/, "fire"],
  [/mva|mvc|vehicle|collision|crash|traffic|accident|rollover/, "mva"],
  [/medical|ems|cardiac|trauma|injur|patient|overdose/, "medical"],
  [/alarm|bell|sprinkler|detector/, "alarm"],
  [/rescue|extrication|trapped|swift\s*water|high\s*angle/, "rescue"],
  [/electrical|power|utility|wire|transformer|arc/, "electrical"],
];

export function classificationKey(
  classification: string,
): keyof typeof CLASSIFICATION_ICONS {
  const s = classification.toLowerCase();
  for (const [re, key] of CLASSIFICATION_RULES) {
    if (re.test(s)) return key;
  }
  return "default";
}

export const CLASSIFICATION_ICONS = {
  hazmat: Biohazard,
  gas: Fuel,
  fire: Flame,
  mva: CarFront,
  medical: Cross,
  alarm: Bell,
  rescue: LifeBuoy,
  electrical: Zap,
  default: Siren,
} satisfies Record<string, LucideIcon>;

/** BadgeTone → matching text color utility. */
export function toneTextClass(tone: BadgeTone): string {
  switch (tone) {
    case "hot":
      return "text-flame";
    case "warm":
      return "text-blaze";
    case "cold":
      return "text-bone/80";
    case "dead":
      return "text-ash";
    default:
      return "text-flame/80";
  }
}

/** BadgeTone → matching lamp tone for `Led`. */
export function toneToLed(tone: BadgeTone): LedTone {
  switch (tone) {
    case "hot":
      return "flame";
    case "warm":
      return "blaze";
    case "cold":
      return "bone";
    case "dead":
      return "off";
    default:
      return "flame";
  }
}
