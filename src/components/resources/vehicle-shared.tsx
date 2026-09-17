import {
  Ambulance,
  Biohazard,
  Fuel,
  LifeBuoy,
  Radio,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Vehicle, VehicleStatus, VehicleType } from "@/lib/api";

export const STATUS_SHORT: Record<VehicleStatus, string> = {
  available: "avail",
  dispatched: "disp",
  en_route: "en rte",
  on_scene: "scene",
  returning: "ret",
  refuel: "refuel",
  out_of_service: "oos",
};

export const TYPE_ICON: Record<VehicleType, LucideIcon> = {
  pumper: Truck,
  tender: Fuel,
  ladder: Truck,
  rescue: LifeBuoy,
  ambulance: Ambulance,
  hazmat: Biohazard,
  command: Radio,
  special: Truck,
};

/** Where the unit sits, in one word. */
export function placeOf(v: Vehicle): string {
  if (v.incident_id !== null) return v.incident_id;
  if (v.status === "available") return `${v.station_id} bay`;
  if (v.status === "out_of_service") return "dark";
  return "in transit";
}

/** Home = parked in the bay; rolling = out on the road. */
export function isHome(v: Vehicle): boolean {
  return (
    v.status === "available" ||
    v.status === "refuel" ||
    v.status === "out_of_service"
  );
}

export const ROLLING: readonly VehicleStatus[] = [
  "dispatched",
  "en_route",
  "on_scene",
];

export const RETURNING: readonly VehicleStatus[] = ["returning"];
