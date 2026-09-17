"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import { FleetMap } from "@/components/map/fleet-map";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { AlertsStrip } from "./alerts-strip";
import { ReadinessBar } from "./readiness-bar";
import { ResourceSidebar, type ResourceTab } from "./sidebar";

/**
 * Consolidated /resources view — the main page.
 *
 * Left: station readiness proportions, the live offline fleet map and
 * the cross-domain flag queue. Right: a fixed icon-tabbed
 * rail (Fleet / Kit / Crew) that holds the full manifests — every row
 * opens its detail modal in place. All three feeds poll once here at
 * 4 s and are passed down. Deep-linkable via ?tab=.
 */
export function ResourcesView({ initialTab }: { initialTab: ResourceTab }) {
  const [active, setActive] = useState<ResourceTab>(initialTab);
  const [boardSelected, setBoardSelected] = useState<string | null>(null);

  const setTab = useCallback((tab: ResourceTab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/resources?tab=${tab}`);
  }, []);

  const vehicles = usePolling(api.vehicles, 4000);
  const equipment = usePolling(api.equipment, 4000);
  const personnel = usePolling(() => api.personnel(), 4000);
  const incidents = usePolling(() => api.incidents("active"), 4000);
  const overview = usePolling(api.overview, 8000);

  return (
    <div className="relative min-h-screen bg-ink">
      {/* station render graded into the ink/flame system */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <Image
          src="/station-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-ink/85 via-ink/50 to-ink/90"
      />

      <ConsoleNav />

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-1 space-y-5">
          <ReadinessBar
            vehicles={vehicles}
            equipment={equipment}
            personnel={personnel}
          />
          <FleetMap
            vehicles={vehicles.data ?? []}
            incidents={incidents.data ?? []}
            station={
              overview.data === null
                ? null
                : { lat: overview.data.station.lat, lng: overview.data.station.lng }
            }
            selectedId={boardSelected}
            onSelect={setBoardSelected}
          />
          <AlertsStrip
            vehicles={vehicles}
            equipment={equipment}
            personnel={personnel}
            onSelect={setTab}
          />
        </main>

        <aside className="w-full shrink-0 self-start lg:sticky lg:top-[72px] lg:w-[380px]">
          <ResourceSidebar
            active={active}
            onSelect={setTab}
            vehicles={vehicles}
            equipment={equipment}
            personnel={personnel}
            className="max-h-[70dvh] lg:h-[calc(100dvh-92px)] lg:max-h-none"
          />
        </aside>
      </div>

      {boardSelected && (
        <VehicleDetailModal
          id={boardSelected}
          onClose={() => setBoardSelected(null)}
        />
      )}
    </div>
  );
}
