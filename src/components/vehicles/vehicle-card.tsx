import { Badge, Meter } from "@/components/ui";
import { fmtAgo, statusTone, type Vehicle } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Where the unit is pointed — adapts to dispatch state. */
function assignment(v: Vehicle): { label: string; value: string } {
  if (v.status === "out_of_service") return { label: "Assignment", value: "Unit dark" };
  if (v.incident_id) return { label: "Incident", value: v.incident_id };
  return {
    label: "Post",
    value: v.status === "available" ? `${v.station_id} bay` : "In transit",
  };
}

/** The one number an operator needs for this status. */
function liveMetric(v: Vehicle): { label: string; value: string } {
  switch (v.status) {
    case "en_route":
    case "dispatched":
    case "returning":
      return { label: "Speed", value: `${Math.round(v.speed_kmh)} km/h` };
    case "on_scene":
      return { label: "Pump", value: `${v.pump_pressure_bar.toFixed(1)} bar` };
    case "refuel":
      return { label: "Tank", value: `${Math.round(v.fuel_pct)}%` };
    case "available":
      return { label: "Fuel ready", value: `${Math.round(v.fuel_pct)}%` };
    default:
      return { label: "Battery", value: `${v.battery_v.toFixed(1)} v` };
  }
}

export function VehicleCard({
  vehicle,
  onSelect,
}: {
  vehicle: Vehicle;
  onSelect: (id: string) => void;
}) {
  const tone = statusTone(vehicle.status);
  const dead = vehicle.status === "out_of_service";
  const a = assignment(vehicle);
  const m = liveMetric(vehicle);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(vehicle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(vehicle.id);
        }
      }}
      className={cn(
        "clip-chamfer group cursor-pointer bg-flame/30 transition-colors [--chamfer:18px] hover:bg-flame/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame",
        dead && "bg-ash/15 hover:bg-ash/25",
      )}
    >
      <div
        className={cn(
          "clip-chamfer m-px bg-coal [--chamfer:17px]",
          dead && "saturate-50",
        )}
      >
        {/* nameplate */}
        <div className="relative flex items-center justify-between border-b border-flame/15 bg-gradient-to-b from-wine/60 to-coal px-4 py-2">
          <span
            aria-hidden
            className="bg-hazard-tight absolute inset-y-0 left-0 w-[3px] opacity-25"
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
            {vehicle.callsign}
          </span>
          <Badge tone={tone}>{vehicle.status.replace(/_/g, " ")}</Badge>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
              {vehicle.name}
            </h4>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              {vehicle.type} {"//"} {vehicle.station_id}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                {a.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 truncate font-mono text-[11px]",
                  vehicle.incident_id ? "text-flame" : "text-bone/80",
                )}
              >
                {a.value}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                {m.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 font-mono text-[11px]",
                  dead ? "text-ash" : "text-bone/80",
                )}
              >
                {dead ? "—" : m.value}
              </div>
            </div>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash/60">
            pos {vehicle.lat.toFixed(4)} / {vehicle.lng.toFixed(4)}
          </div>

          <Meter label="Fuel" value={vehicle.fuel_pct} />
          <Meter label="Water" value={vehicle.water_pct} />
        </div>

        <div className="flex items-center justify-between border-t border-flame/15 px-4 py-2.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-ash/60">
            upd {fmtAgo(vehicle.updated_at)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash transition-colors group-hover:text-flame">
            Inspect {"//"}
          </span>
        </div>
      </div>
    </div>
  );
}
