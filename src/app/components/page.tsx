import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Input,
  Meter,
  Panel,
  Stat,
  UnitCard,
  type Unit,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "SIREN — Design System",
};

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel
      title={title}
      right={<span>SEC-{index}</span>}
      bodyClassName="space-y-6"
    >
      {children}
    </Panel>
  );
}

const swatches: { name: string; token: string; hex: string }[] = [
  { name: "Ink", token: "bg-ink", hex: "#060607" },
  { name: "Coal", token: "bg-coal", hex: "#0D0D11" },
  { name: "Smoke", token: "bg-smoke", hex: "#15151B" },
  { name: "Ash", token: "bg-ash", hex: "#8B8B95" },
  { name: "Bone", token: "bg-bone", hex: "#ECE9E2" },
  { name: "Flame", token: "bg-flame", hex: "#FF2E2E" },
  { name: "Blaze", token: "bg-blaze", hex: "#FF6A3D" },
  { name: "Blood", token: "bg-blood", hex: "#7E0E14" },
  { name: "Wine", token: "bg-wine", hex: "#2A090C" },
];

const units: Unit[] = [
  {
    id: "ENG-01",
    name: "Pumper One",
    role: "Engine // Pumper",
    status: "Available",
    statusTone: "cold",
    location: "Bay 1 — STA-01",
    freeAt: "NOW",
    fuel: 92,
    water: 100,
  },
  {
    id: "LDR-02",
    name: "Ladder Two",
    role: "Aerial // 75ft",
    status: "En Route",
    statusTone: "hot",
    location: "RTE-9 · NB",
    freeAt: "00:18",
    fuel: 64,
    water: 80,
  },
  {
    id: "RSC-03",
    name: "Rescue Three",
    role: "Heavy Rescue",
    status: "On Scene",
    statusTone: "warm",
    location: "GRID C4",
    freeAt: "00:47",
    fuel: 38,
    water: 12,
  },
];

export default function ComponentsPage() {
  return (
    <div className="relative min-h-screen bg-ink">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-wine/40"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10 flex items-end justify-between border-b border-flame/20 pb-6">
          <div>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash transition-colors hover:text-flame"
            >
              {"‹ Back to console"}
            </Link>
            <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-[0.1em] text-bone text-glow">
              Design <span className="text-flame">System</span>
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
              SIREN UI // gamified dispatch interface kit
            </p>
          </div>
          <Badge tone="hot">v0.2 // WIP</Badge>
        </header>

        <div className="space-y-8">
          <Section index="01" title="Palette">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
              {swatches.map((s) => (
                <div key={s.name}>
                  <div
                    className={`h-12 border border-bone/10 ${s.token}`}
                  />
                  <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-bone/80">
                    {s.name}
                  </div>
                  <div className="font-mono text-[9px] text-ash">{s.hex}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section index="02" title="Typography">
            <div className="space-y-4">
              <div>
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  Display // Barlow Semi Condensed 800
                </div>
                <div className="font-display text-4xl font-black uppercase tracking-[0.08em] text-bone">
                  Dispatch <span className="text-flame text-glow">Siren</span>
                </div>
              </div>
              <div>
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  Body // Barlow 400
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-bone/80">
                  All units respond. Engine One and Ladder Two staged at grid
                  C4 — water tender en route, ETA four minutes. Incident
                  commander holds tactical command pending battalion arrival.
                </p>
              </div>
              <div>
                <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  Mono // IBM Plex Mono 400
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-ash">
                  INC-4471 // CLASS: STRUCTURE // WIND 14KT NW // PRIORITY P1
                </p>
              </div>
            </div>
          </Section>

          <Section index="03" title="Buttons">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg" led="pulse">
                  Dispatch Units
                </Button>
                <Button size="md" led="on">
                  Dispatch Units
                </Button>
                <Button size="sm">Dispatch Units</Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="outline" size="lg" led="on">
                  Hold Position
                </Button>
                <Button variant="outline" size="md">
                  Hold Position
                </Button>
                <Button variant="outline" size="sm" led="off">
                  Hold Position
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="ghost" size="lg">
                  Recall Crew
                </Button>
                <Button variant="ghost" size="md" led="on">
                  Recall Crew
                </Button>
                <Button variant="ghost" size="sm">
                  Recall Crew
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button led="off">Standby</Button>
                <Button led="on">Armed</Button>
                <Button led="pulse">Alarm</Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button disabled>Offline</Button>
                <Button variant="outline" disabled>
                  Offline
                </Button>
                <Button variant="ghost" disabled>
                  Offline
                </Button>
              </div>
              <div className="max-w-md">
                <Button block led="on">
                  Confirm All Units // Block
                </Button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                led: off // on // pulse — href renders a link — hover for sheen
                + charge bar, press for key-drop
              </p>
            </div>
          </Section>

          <Panel
            chamfered
            led="pulse"
            title="INC-4471 // Structure Fire"
            right={<span>P1 // GRID C4</span>}
            bodyClassName="space-y-5"
          >
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
                  Incident
                </div>
                <div className="font-display text-xl font-bold uppercase tracking-[0.06em] text-bone">
                  Warehouse — 2nd alarm
                </div>
                <div className="mt-1 flex gap-2">
                  <Badge tone="hot">En Route ×2</Badge>
                  <Badge tone="warm">Staging ×1</Badge>
                  <Badge tone="cold">Available ×9</Badge>
                </div>
              </div>
              <div className="flex gap-8">
                <Stat label="Committed" value="03" sub="units" />
                <Stat label="ETA" value="4:12" sub="first due" />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Meter label="Scene water supply" value={64} />
              <Meter label="Air reserves — crew A" value={18} />
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-flame/15 pt-5">
              <Button size="lg" led="pulse">
                Dispatch
              </Button>
              <Button variant="outline" size="lg" led="on">
                Hold
              </Button>
              <Button variant="ghost" size="lg" led="off">
                Recall
              </Button>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                Awaiting human approval // agent recommendation ready
              </span>
            </div>
          </Panel>

          <Section index="05" title="Badges">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="hot">On Scene</Badge>
              <Badge tone="hot">En Route</Badge>
              <Badge tone="warm">Staging</Badge>
              <Badge tone="cold">Available</Badge>
              <Badge tone="plain">Standby</Badge>
              <Badge tone="dead">Out of Service</Badge>
              <Badge tone="cold" noDot>
                No Dot
              </Badge>
            </div>
          </Section>

          <Section index="06" title="Meters">
            <div className="grid gap-6 sm:grid-cols-3">
              <Meter label="Fuel" value={92} />
              <Meter label="Water tank" value={64} />
              <Meter label="Battery — low alarm" value={18} />
            </div>
          </Section>

          <Section index="07" title="Stats">
            <div className="grid gap-6 sm:grid-cols-4">
              <Stat label="Units ready" value="12" sub="of 16 total" />
              <Stat label="Active calls" value="03" sub="P1 · P2 · P4" />
              <Stat label="Avg response" value="4:12" sub="last 24h" />
              <Stat label="Crew on duty" value="27" sub="shift B" />
            </div>
          </Section>

          <Section index="08" title="Inputs">
            <div className="grid gap-6 sm:grid-cols-2">
              <Input
                id="demo-callsign"
                label="Callsign"
                placeholder="ENG-01"
              />
              <Input
                id="demo-grid"
                label="Incident grid"
                glyph="⌖"
                placeholder="SECTOR / GRID REF"
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              Focus arms the field — lamp lights, hazard bar sweeps in
            </p>
          </Section>

          <Section index="09" title="Unit cards">
            <div className="grid gap-5 md:grid-cols-3">
              {units.map((u) => (
                <UnitCard key={u.id} unit={u} />
              ))}
            </div>
          </Section>

          <Section index="10" title="Panel variants">
            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Bracketed" led="on" right={<span>STD</span>}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Default panel — machined corner brackets + rivets
                </p>
              </Panel>
              <Panel
                chamfered
                title="Chamfered"
                led="off"
                right={<span>CHF</span>}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Chamfered frame — clipped edge, no brackets
                </p>
              </Panel>
            </div>
          </Section>

          <Section index="11" title="Textures">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="bg-grid h-20 border border-bone/10" />
              <div className="bg-scanlines h-20 border border-bone/10 bg-smoke" />
              <div className="bg-hazard h-20 border border-bone/10" />
              <div className="bg-hazard-tight h-20 border border-bone/10" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              bg-grid // bg-scanlines // bg-hazard // bg-hazard-tight —
              utilities from globals.css
            </p>
          </Section>
        </div>

        <footer className="mt-12 flex items-center justify-between border-t border-flame/20 pt-4 font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
          <span>SIREN DS // BUILD 0.2</span>
          <span>SHARP // RED // NO RADIUS</span>
        </footer>
      </div>
    </div>
  );
}
