"use client";

import { useEffect, useRef, useState } from "react";
import type * as ML from "maplibre-gl";
import type { BadgeTone } from "@/components/ui";
import {
  statusTone,
  type Incident,
  type Vehicle,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TONE_DOT: Record<BadgeTone, string> = {
  hot: "bg-flame shadow-[0_0_12px_2px_rgb(255_46_46/0.8)] animate-pulse",
  warm: "bg-blaze shadow-[0_0_8px_1px_rgb(255_106_61/0.7)]",
  cold: "bg-bone/70 shadow-[0_0_6px_rgb(236_233_226/0.4)]",
  dead: "bg-ash/30",
  plain: "bg-flame/70",
};

const TONE_TAG: Record<BadgeTone, string> = {
  hot: "border-flame/60 bg-wine/80 text-flame",
  warm: "border-blaze/40 bg-coal/90 text-blaze",
  cold: "border-bone/25 bg-coal/90 text-bone/80",
  dead: "border-ash/20 bg-coal/90 text-ash/60",
  plain: "border-flame/30 bg-coal/90 text-bone/80",
};

const TONE_HEX: Record<BadgeTone, string> = {
  hot: "#ff2e2e",
  warm: "#ff6a3d",
  cold: "#ece9e2",
  dead: "#8b8b95",
  plain: "#ff2e2e",
};

/** Fully offline style — local raster tiles only, no remote calls. */
const OFFLINE_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["/map/hyderabad/{z}/{x}/{y}.png"],
      tileSize: 256,
      // tiles are cached on disk for z11–14 only — outside that range
      // MapLibre over/under-zooms the nearest level instead of 404ing
      minzoom: 11,
      maxzoom: 14,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "bg",
      type: "background" as const,
      paint: { "background-color": "#060607" },
    },
    { id: "osm", type: "raster" as const, source: "osm" },
  ],
};

function vehicleEl(v: Vehicle, selected: boolean): HTMLElement {
  const tone = statusTone(v.status);
  const el = document.createElement("button");
  el.type = "button";
  el.className =
    "flex cursor-pointer flex-col items-center gap-1 focus-visible:outline-none";
  el.innerHTML = `
    <span class="block h-3 w-3 rotate-45 border border-ink/60 ${TONE_DOT[tone]} ${
      selected
        ? "shadow-[0_0_0_2px_var(--color-ink),0_0_0_3px_var(--color-flame)]"
        : ""
    }"></span>
    <span class="clip-tag border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] [--chamfer:4px] ${TONE_TAG[tone]}">${
      v.callsign
    }</span>`;
  return el;
}

function incidentEl(i: Incident): HTMLElement {
  const el = document.createElement("div");
  el.className = "flex flex-col items-center gap-1";
  el.innerHTML = `
    <span class="block h-3.5 w-3.5 rotate-45 border border-ink/60 bg-flame shadow-[0_0_14px_3px_rgb(255_46_46/0.7)]"></span>
    <span class="clip-tag border border-flame/70 bg-wine/90 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-flame [--chamfer:4px]">${i.id}</span>`;
  return el;
}

function stationEl(code: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "flex items-center gap-1.5";
  el.innerHTML = `
    <span class="block h-2.5 w-2.5 border border-bone/60 bg-coal"></span>
    <span class="font-mono text-[8px] uppercase tracking-[0.25em] text-bone/70">${code}</span>`;
  return el;
}

/**
 * Real map of the response area — offline Hyderabad tiles under
 * MapLibre, units that aren't available shown as status-toned markers
 * with route lines to their incidents (or back to station when
 * returning). maplibre-gl is imported dynamically — it is browser-only.
 */
export function FleetMap({
  vehicles,
  incidents,
  station,
  selectedId,
  onSelect,
  className,
}: {
  vehicles: Vehicle[];
  incidents: Incident[];
  station: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mlRef = useRef<typeof ML | null>(null);
  const mapRef = useRef<ML.Map | null>(null);
  const markersRef = useRef<Map<string, ML.Marker>>(new Map());
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // every unit gets a marker; only non-available units draw route lines
  const deployed = vehicles.filter((v) => v.status !== "available");

  // markers/lines only rebuild when positions or statuses actually move
  const sig = JSON.stringify([
    vehicles.map((v) => [
      v.id,
      v.callsign,
      v.lat,
      v.lng,
      v.status,
      v.incident_id,
    ]),
    incidents.map((i) => [i.id, i.lat, i.lng, i.status]),
    station?.lat,
    station?.lng,
    selectedId,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const markers = markersRef.current;
    let disposed = false;
    let map: ML.Map | null = null;

    void (async () => {
      const ml = await import("maplibre-gl");
      if (disposed) return;
      mlRef.current = ml;
      map = new ml.Map({
        container,
        style: OFFLINE_STYLE,
        center: [78.4867, 17.385],
        zoom: 12.5,
        minZoom: 11,
        maxZoom: 15,
        // keep the camera inside the cached-tile coverage around Abids
        maxBounds: [
          [78.42, 17.32],
          [78.55, 17.45],
        ],
        attributionControl: { compact: true },
      });
      map.addControl(
        new ml.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      map.on("load", () => {
        map!.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map!.addLayer({
          id: "routes-moving",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "moving"], true],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.5,
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
          },
        });
        map!.addLayer({
          id: "routes-still",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "moving"], false],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.5,
            "line-opacity": 0.4,
          },
        });
        mapRef.current = map;
        setReady(true);
      });
    })();

    return () => {
      disposed = true;
      setReady(false);
      markers.forEach((m) => m.remove());
      markers.clear();
      mapRef.current = null;
      mlRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (ml === null || map === null || !ready) return;

    const wanted = new Map<
      string,
      {
        el: HTMLElement;
        lngLat: [number, number];
        offset?: [number, number];
        onClick?: () => void;
      }
    >();
    const bounds = new ml.LngLatBounds();

    for (const i of incidents.filter((x) => x.status === "active")) {
      wanted.set(`inc-${i.id}`, { el: incidentEl(i), lngLat: [i.lng, i.lat] });
      bounds.extend([i.lng, i.lat]);
    }

    // units sharing a coordinate (the whole bay) fan out in a ring
    // so every marker stays visible and clickable
    const stacks = new Map<string, Vehicle[]>();
    for (const v of vehicles) {
      const k = `${v.lat.toFixed(5)},${v.lng.toFixed(5)}`;
      stacks.set(k, [...(stacks.get(k) ?? []), v]);
    }
    for (const v of vehicles) {
      const stack = stacks.get(`${v.lat.toFixed(5)},${v.lng.toFixed(5)}`) ?? [];
      let offset: [number, number] | undefined;
      if (stack.length > 1) {
        const idx = stack.findIndex((x) => x.id === v.id);
        const angle = (idx / stack.length) * Math.PI * 2;
        offset = [Math.round(Math.cos(angle) * 16), Math.round(Math.sin(angle) * 12)];
      }
      wanted.set(`veh-${v.id}`, {
        el: vehicleEl(v, v.id === selectedId),
        lngLat: [v.lng, v.lat],
        offset,
        onClick: () => onSelect(v.id),
      });
      bounds.extend([v.lng, v.lat]);
    }
    if (station !== null) {
      wanted.set("station", {
        el: stationEl("SC-01"),
        lngLat: [station.lng, station.lat],
      });
      bounds.extend([station.lng, station.lat]);
    }

    for (const [key, m] of markersRef.current) {
      if (!wanted.has(key)) {
        m.remove();
        markersRef.current.delete(key);
      }
    }
    for (const [key, t] of wanted) {
      markersRef.current.get(key)?.remove();
      const m = new ml.Marker({
        element: t.el,
        anchor: "top",
        offset: [t.offset?.[0] ?? 0, 7 + (t.offset?.[1] ?? 0)],
      })
        .setLngLat(t.lngLat)
        .addTo(map);
      if (t.onClick) t.el.addEventListener("click", t.onClick);
      markersRef.current.set(key, m);
    }

    // route lines — committed units to their incident, returning to base
    const features: GeoJSON.Feature[] = [];
    for (const v of deployed) {
      const dest =
        v.incident_id !== null
          ? incidents.find((i) => i.id === v.incident_id)
          : undefined;
      const target =
        dest !== undefined
          ? ([dest.lng, dest.lat] as [number, number])
          : v.status === "returning" && station !== null
            ? ([station.lng, station.lat] as [number, number])
            : null;
      if (target === null) continue;
      features.push({
        type: "Feature",
        properties: {
          moving: v.status !== "on_scene",
          color: TONE_HEX[statusTone(v.status)],
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [v.lng, v.lat],
            target,
          ],
        },
      });
    }
    const src = map.getSource("routes") as ML.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features });

    if (!fittedRef.current && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 13.5, duration: 0 });
      fittedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);

  return (
    <div
      className={cn(
        "fleet-map relative h-[440px] overflow-hidden border border-flame/15 bg-ink",
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {vehicles.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink/40 font-mono text-[10px] uppercase tracking-[0.3em] text-ash/70">
          no position telemetry
        </div>
      )}
    </div>
  );
}
