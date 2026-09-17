"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Led } from "@/components/ui/led";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/* /presentation and /components stay reachable — they're hidden routes,
   not nav destinations. */
const LINKS = [
  { href: "/", label: "SIREN-1" },
  { href: "/resources", label: "Resources" },
  { href: "/incidents", label: "Incidents" },
];

/** Persistent control-room top bar — sharp, red-on-black, zero radius. */
export function ConsoleNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  // digit keys arm nav links — 1/2/3 jump to the three destinations
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < LINKS.length) router.push(LINKS[idx].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .overview()
        .then(() => {
          if (alive) setApiUp(true);
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
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="clip-tag block h-4 w-4 bg-flame [--chamfer:4px]"
          />
          <span className="font-display text-sm font-black uppercase tracking-[0.3em] text-bone">
            Siren
          </span>
        </Link>

        <nav className="hidden items-stretch gap-1 md:flex">
          {LINKS.map((l, i) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                title={`${l.label} — press ${i + 1}`}
                className={cn(
                  "border border-transparent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] transition-colors",
                  active
                    ? "border-flame/40 bg-wine/50 text-flame"
                    : "text-ash hover:border-flame/20 hover:text-bone",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          <span
            className="flex items-center gap-2"
            title={apiUp === false ? "API link down" : "API link live"}
          >
            <Led tone={apiUp === false ? "off" : "blaze"} size="sm" />
            {apiUp === false && <span className="text-flame">down</span>}
          </span>
        </div>
      </div>
    </header>
  );
}
