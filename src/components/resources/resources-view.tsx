"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ConsoleNav } from "@/components/console-nav";
import { FleetReadiness } from "@/components/console/fleet-readiness";
import { OpsFeed } from "@/components/console/ops-feed";
import { EquipmentDeck } from "@/components/equipment/equipment-deck";
import { PersonnelDeck } from "@/components/people/personnel-deck";
import {
  attentionReasons,
  needsAttention,
} from "@/components/equipment/shared";
import { vitalsAlert } from "@/components/people/lib";
import { Button, Led, Panel, Skeleton } from "@/components/ui";
import { FleetDeck } from "@/components/vehicles/fleet-deck";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { TAB_META, TabRail, type ResourceTab } from "./tab-rail";

interface ResourceAlert {
  id: string;
  tab: ResourceTab;
  label: string;
  detail: string;
}

/**
 * Flagged kit (maintenance | missing | battery <= 25%) + vitals-critical
 * crew (HR > 160 | SCBA < 25%) — every row jumps to the owning deck.
 * Both feeds self-poll at 4 s.
 */
function ResourceAlerts({
  onSelect,
}: {
  onSelect: (tab: ResourceTab) => void;
}) {
  const equipment = usePolling(api.equipment, 4000);
  const personnel = usePolling(() => api.personnel(), 4000);

  const alerts = useMemo<ResourceAlert[]>(() => {
    const rows: ResourceAlert[] = [];
    for (const item of equipment.data ?? []) {
      if (!needsAttention(item)) continue;
      rows.push({
        id: `eq-${item.id}`,
        tab: "equipment",
        label: `${item.id} — ${item.name}`,
        detail: attentionReasons(item)[0] ?? "flagged",
      });
    }
    for (const p of personnel.data ?? []) {
      if (vitalsAlert(p) !== "critical") continue;
      rows.push({
        id: `pp-${p.id}`,
        tab: "people",
        label: `${p.id} — ${p.name}`,
        detail: `HR ${p.heart_rate} · SCBA ${Math.round(p.scba_pct)}%`,
      });
    }
    return rows;
  }, [equipment.data, personnel.data]);

  const bothDown =
    equipment.data === null &&
    personnel.data === null &&
    (equipment.error !== null || personnel.error !== null);
  const loading =
    equipment.data === null &&
    personnel.data === null &&
    (equipment.loading || personnel.loading);

  return (
    <Panel
      title="Resource alerts"
      led={alerts.length > 0 ? "pulse" : "off"}
      right={`${alerts.length} flagged`}
      bodyClassName="max-h-[320px] space-y-2 overflow-y-auto"
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : bothDown ? (
        <div className="flex items-center gap-3 border border-ash/15 bg-smoke/40 px-4 py-4">
          <Led tone="off" size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            Alert feed down — backend :8000 unreachable
          </span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-3 border border-ash/15 bg-smoke/40 px-4 py-4">
          <Led tone="bone" size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            Manifest clear — no flagged resources
          </span>
        </div>
      ) : (
        alerts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.tab)}
            className="group flex w-full items-center gap-3 border border-flame/20 bg-smoke/40 px-3 py-2 text-left transition-colors hover:border-flame/50 hover:bg-wine/30"
          >
            <Led tone="blaze" pulse size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.15em] text-bone/85 group-hover:text-bone">
                {a.label}
              </span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash/80">
                {a.detail} {"//"} {TAB_META[a.tab].label}
              </span>
            </span>
            <span
              aria-hidden
              className="font-mono text-[10px] text-ash transition-colors group-hover:text-flame"
            >
              {"›"}
            </span>
          </button>
        ))
      )}
    </Panel>
  );
}

/**
 * Consolidated /resources view — one route hosting the apparatus,
 * equipment, and personnel decks behind a right-hand vertical rail.
 * Deep-linkable via ?tab=; tab switches sync the URL with replaceState.
 */
export function ResourcesView({ initialTab }: { initialTab: ResourceTab }) {
  const [active, setActive] = useState<ResourceTab>(initialTab);

  const setTab = useCallback((tab: ResourceTab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/resources?tab=${tab}`);
  }, []);

  const switcherButtons = (
    <>
      {(["vehicles", "equipment", "people"] as const).map((t) => (
        <Button
          key={t}
          variant="outline"
          size="sm"
          led={active === t ? "pulse" : "off"}
          onClick={() => setTab(t)}
        >
          {TAB_META[t].label}
        </Button>
      ))}
    </>
  );

  return (
    <div className="relative min-h-screen bg-ink">
      {/* station render graded into the ink/flame system — fixed so it
          stays put while the decks scroll */}
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
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-ink/80 via-ink/35 to-ink/90"
      />
      <div
        aria-hidden
        className="bg-scanlines pointer-events-none fixed inset-0 opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 shadow-[inset_0_0_180px_60px_rgb(6_6_7/0.9)]"
      />

      <ConsoleNav />

      <main className="relative z-10 mx-auto w-full max-w-[1600px] space-y-6 px-5 py-6">
        <div className="grid items-start gap-6 xl:grid-cols-12">
          {/* left — fleet readiness + tab switchers + real alert queue */}
          <aside className="space-y-6 xl:col-span-3">
            <FleetReadiness actions={switcherButtons} />
            <ResourceAlerts onSelect={setTab} />
          </aside>

          {/* center — active deck (horizontal rail above it below xl) */}
          <section className="min-w-0 space-y-6 xl:col-span-7">
            <div className="xl:hidden">
              <TabRail active={active} onSelect={setTab} orientation="horizontal" />
            </div>
            {active === "vehicles" && <FleetDeck />}
            {active === "equipment" && <EquipmentDeck />}
            {active === "people" && <PersonnelDeck />}
          </section>

          {/* right — vertical tab rail */}
          <aside className="hidden xl:col-span-2 xl:block">
            <div className="sticky top-[72px]">
              <TabRail active={active} onSelect={setTab} />
            </div>
          </aside>
        </div>

        {/* bottom — station event wire */}
        <OpsFeed className="max-h-[240px] overflow-y-auto" />
      </main>
    </div>
  );
}
