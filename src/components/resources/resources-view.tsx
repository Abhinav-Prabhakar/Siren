"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import { NewDispatchModal } from "@/components/console/new-dispatch-modal";
import { FleetMap } from "@/components/map/fleet-map";
import { VehicleDetailModal } from "@/components/vehicles/vehicle-detail-modal";
import { Alert, Badge, Button, Led, Switch } from "@/components/ui";
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
  const settings = usePolling(api.settings, 4000);

  /* operator controls — relocated from the control room */
  const [newDispatchOpen, setNewDispatchOpen] = useState(false);
  const [nightBusy, setNightBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(id);
  }, [notice]);

  const nightMode = settings.data?.night_mode ?? false;
  const backendDown =
    overview.error !== null && overview.data === null;

  async function toggleNight(enabled: boolean) {
    if (nightBusy) return;
    setNightBusy(true);
    try {
      await api.setNightMode(enabled);
      setNotice({
        error: false,
        text: enabled
          ? "night watch armed // agent proposals auto-approve while armed"
          : "night watch off // operator approval restored",
      });
      settings.refresh();
    } catch (e) {
      setNotice({
        error: true,
        text: `night watch switch failed — ${
          e instanceof Error ? e.message : "backend unreachable"
        }`,
      });
    } finally {
      setNightBusy(false);
    }
  }

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
          {notice && (
            <Alert tone={notice.error ? "critical" : "ok"}>{notice.text}</Alert>
          )}

          {/* ops bar — station identity left, operator actions right */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em]">
              <Led
                tone={backendDown ? "off" : "blaze"}
                size="sm"
                pulse={!backendDown}
              />
              <span className="text-bone/80">
                {overview.data ? overview.data.station.name : "uplink pending"}
              </span>
              {overview.data && (
                <span className="hidden text-ash sm:inline">
                  {"//"} {overview.data.station.address}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {nightMode && <Badge tone="hot">AUTO-DISPATCH ARMED</Badge>}
              <Switch
                label="Night watch"
                checked={nightMode}
                disabled={settings.data === null || nightBusy}
                onCheckedChange={(v) => void toggleNight(v)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewDispatchOpen(true)}
              >
                New dispatch
              </Button>
            </div>
          </div>

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
            incidents={incidents.data ?? []}
            station={
              overview.data === null
                ? null
                : {
                    lat: overview.data.station.lat,
                    lng: overview.data.station.lng,
                  }
            }
            className="max-h-[70dvh] lg:h-[calc(100dvh-92px)] lg:max-h-none"
          />
        </aside>
      </div>

      {boardSelected && (
        <VehicleDetailModal
          id={boardSelected}
          incidents={incidents.data ?? []}
          station={
            overview.data === null
              ? null
              : {
                  lat: overview.data.station.lat,
                  lng: overview.data.station.lng,
                }
          }
          onClose={() => setBoardSelected(null)}
        />
      )}

      <NewDispatchModal
        open={newDispatchOpen}
        onClose={() => setNewDispatchOpen(false)}
        onCreated={(d) => {
          setNewDispatchOpen(false);
          setNotice({
            error: false,
            text: `${d.id} deployed // operator dispatch auto-approved — units committed`,
          });
          vehicles.refresh();
          incidents.refresh();
        }}
      />
    </div>
  );
}
