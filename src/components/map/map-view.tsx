"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { ConsoleNav } from "@/components/console-nav";
import { FleetMap } from "@/components/map/fleet-map";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";

/** Full-height live map — same feed as /resources, bigger canvas. */
export function MapView() {
  const vehicles = usePolling(api.vehicles, 4000);
  const incidents = usePolling(() => api.incidents("active"), 4000);
  const overview = usePolling(api.overview, 8000);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ConsoleNav />
      <main className="min-h-0 flex-1">
        <FleetMap
          vehicles={vehicles.data ?? []}
          incidents={incidents.data ?? []}
          station={
            overview.data === null
              ? null
              : {
                  lat: overview.data.station.lat,
                  lng: overview.data.station.lng,
                }
          }
          selectedId={selected}
          onSelect={setSelected}
          className="h-full border-0"
        />
      </main>
      {selected && (
        <VehicleDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
