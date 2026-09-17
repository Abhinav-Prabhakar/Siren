"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Led } from "@/components/ui/led";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Control room" },
  { href: "/resources", label: "Resources" },
  { href: "/incidents", label: "Incidents" },
  { href: "/presentation", label: "Deck" },
  { href: "/components", label: "Design sys" },
];

/** Persistent control-room top bar — sharp, red-on-black, zero radius. */
export function ConsoleNav() {
  const pathname = usePathname();
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .overview()
        .then((o) => {
          if (!alive) return;
          setStationCode(o.station.code);
          setApiUp(true);
        })
        .catch(() => {
          if (alive) setApiUp(false);
        });
    void check();
    const id = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-flame/20 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-2.5">
        <Link href="/" className="group flex items-center gap-3">
          <span
            aria-hidden
            className="clip-tag block h-6 w-6 bg-flame [--chamfer:6px] group-hover:shadow-[0_0_14px_rgb(255_46_46/0.7)]"
          />
          <span className="leading-tight">
            <span className="block font-display text-sm font-black uppercase tracking-[0.3em] text-bone">
              Siren
            </span>
            <span className="block font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
              {stationCode ?? "…"} {"//"} Control room
            </span>
          </span>
        </Link>

        <nav className="hidden items-stretch gap-1 md:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-2 border border-transparent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] transition-colors",
                  active
                    ? "border-flame/40 bg-wine/50 text-flame [text-shadow:0_0_8px_rgb(255_46_46/0.5)]"
                    : "text-ash hover:border-flame/20 hover:text-bone",
                )}
              >
                <Led
                  tone={active ? "flame" : "off"}
                  size="sm"
                  pulse={active}
                />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          <span
            className="flex items-center gap-2"
            title={apiUp === false ? "API link down" : "API link live"}
          >
            <Led
              tone={apiUp === false ? "off" : "blaze"}
              size="sm"
              pulse={apiUp !== false}
            />
            {apiUp === false && <span className="text-flame">down</span>}
          </span>
        </div>
      </div>
    </header>
  );
}
