import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Alert,
  Badge,
  BarChart,
  Button,
  CallCard,
  Checkbox,
  CrewChip,
  DataTable,
  Divider,
  IncidentCard,
  Input,
  Kbd,
  Led,
  LogFeed,
  Meter,
  PageHeader,
  Panel,
  RadialGauge,
  Select,
  Skeleton,
  Slider,
  Sparkline,
  Stat,
  Switch,
  Tabs,
  Textarea,
  Timeline,
  UnitCard,
  WeatherStrip,
  type Unit,
} from "@/components/ui";
import { ModalDemo } from "./demos";

export const metadata: Metadata = {
  title: "Design System",
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
        <PageHeader
          back={{ href: "/", label: "Back to console" }}
          title={
            <>
              Design <span className="text-flame text-glow">System</span>
            </>
          }
          sub="SIREN UI // gamified dispatch interface kit"
          status={<Badge tone="hot">v0.3 // WIP</Badge>}
          actions={
            <Button href="/" variant="outline" size="sm">
              Console
            </Button>
          }
        />

        <div className="mt-10 space-y-8">
          <Section index="01" title="Palette">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
              {swatches.map((s) => (
                <div key={s.name}>
                  <div className={`h-12 border border-bone/10 ${s.token}`} />
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

          <Section index="04" title="Status — badges + lamps">
            <div className="space-y-5">
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
              <Divider label="Led sizes" />
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  <Led tone="flame" size="sm" /> sm
                </span>
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  <Led tone="flame" /> md
                </span>
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  <Led tone="blaze" size="lg" pulse /> lg pulse
                </span>
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  <Led tone="bone" /> bone
                </span>
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  <Led tone="off" /> off
                </span>
              </div>
            </div>
          </Section>

          <Section index="05" title="Alerts">
            <div className="space-y-3">
              <Alert tone="critical" title="Mayday // RSC-03">
                Firefighter down — second floor, quadrant B. RIT team
                recommended for immediate deployment.
              </Alert>
              <Alert tone="warning" title="Low air // crew alpha">
                SCBA telemetry below 20% — rotate crew within two minutes.
              </Alert>
              <Alert tone="info" title="Water supply established">
                TND-04 connected to hydrant at GRID C4 — sustained flow
                available.
              </Alert>
            </div>
          </Section>

          <Section index="06" title="Meters + gauges">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <Meter label="Fuel" value={92} />
                <Meter label="Water tank" value={64} />
                <Meter label="Battery — low alarm" value={18} />
              </div>
              <div className="flex flex-wrap items-start gap-8">
                <RadialGauge value={72} label="Pump load" sub="72%" />
                <RadialGauge value={18} label="Foam reserve" sub="LOW" />
                <RadialGauge
                  variant="ring"
                  value={86}
                  label="O2"
                  size={110}
                />
              </div>
            </div>
          </Section>

          <Section index="07" title="Stats + sparkline">
            <div className="grid gap-6 sm:grid-cols-4">
              <Stat label="Units ready" value="12" sub="of 16 total" />
              <Stat label="Active calls" value="03" sub="P1 · P2 · P4" />
              <Stat label="Avg response" value="4:12" sub="last 24h" />
              <Stat label="Crew on duty" value="27" sub="shift B" />
            </div>
            <Divider label="Calls per hour // 24h" />
            <div className="flex items-center gap-6">
              <Sparkline
                data={[4, 6, 3, 8, 12, 9, 14, 11, 18, 22, 17, 26, 19, 24]}
                width={260}
                height={48}
              />
              <Sparkline
                data={[20, 18, 22, 15, 17, 12, 14, 10, 12, 8, 9, 6]}
                width={260}
                height={48}
                marker={false}
              />
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                Inbound // dispatched
              </span>
            </div>
          </Section>

          <Section index="08" title="Charts">
            <BarChart
              height={160}
              data={[
                { label: "Mon", value: 12 },
                { label: "Tue", value: 19 },
                { label: "Wed", value: 9 },
                { label: "Thu", value: 24 },
                { label: "Fri", value: 31 },
                { label: "Sat", value: 27 },
                { label: "Sun", value: 16, muted: true },
              ]}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              Incidents per day — hover bars for values
            </p>
          </Section>

          <Section index="09" title="Inputs">
            <div className="grid gap-6 sm:grid-cols-2">
              <Input id="demo-callsign" label="Callsign" placeholder="ENG-01" />
              <Input
                id="demo-grid"
                label="Incident grid"
                glyph="⌖"
                placeholder="SECTOR / GRID REF"
              />
              <Select id="demo-unit" label="Unit type">
                <option>Pumper / Engine</option>
                <option>Ladder truck</option>
                <option>Water tender</option>
                <option>Rescue vehicle</option>
                <option>Ambulance</option>
                <option>Hazmat unit</option>
              </Select>
              <Textarea
                id="demo-notes"
                label="Dispatch notes"
                placeholder="Access via rear alley — hydrant on SE corner…"
              />
            </div>
            <Divider label="Toggle controls" />
            <div className="grid gap-6 sm:grid-cols-3">
              <Switch label="Night duty auto" defaultChecked />
              <Switch label="Manual override" />
              <Switch label="Radio uplink" defaultChecked disabled />
              <Checkbox label="EMS notified" defaultChecked />
              <Checkbox label="Police notified" />
              <Checkbox label="Utility company" />
            </div>
            <div className="max-w-md">
              <Slider
                id="demo-priority"
                label="Priority weighting"
                showValue
                value={70}
                readOnly
              />
            </div>
          </Section>

          <Section index="10" title="Tabs + modal">
            <Tabs
              tabs={[
                { id: "queue", label: "Queue", led: "flame", count: 3 },
                { id: "units", label: "Units", count: 16 },
                { id: "crew", label: "Crew", count: 27 },
                { id: "log", label: "Log" },
              ]}
            />
            <div className="flex items-center gap-6 pt-2">
              <ModalDemo />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                Esc // backdrop click closes
              </span>
            </div>
          </Section>

          <Section index="11" title="Data table">
            <DataTable
              columns={[
                { key: "unit", label: "Unit" },
                { key: "type", label: "Type" },
                { key: "status", label: "Status" },
                { key: "task", label: "Current task" },
                { key: "free", label: "Free at", align: "right" },
              ]}
              rows={[
                {
                  unit: <span className="font-mono text-flame">ENG-01</span>,
                  type: "Pumper",
                  status: <Badge tone="cold">Available</Badge>,
                  task: "—",
                  free: <span className="font-mono">NOW</span>,
                },
                {
                  unit: <span className="font-mono text-flame">LDR-02</span>,
                  type: "Aerial 75ft",
                  status: <Badge tone="hot">En Route</Badge>,
                  task: "INC-4471 structure",
                  free: <span className="font-mono">00:18</span>,
                },
                {
                  unit: <span className="font-mono text-flame">TND-04</span>,
                  type: "Water tender",
                  status: <Badge tone="warm">Staging</Badge>,
                  task: "INC-4471 supply",
                  free: <span className="font-mono">00:32</span>,
                },
                {
                  unit: <span className="font-mono text-flame">AMB-02</span>,
                  type: "Ambulance",
                  status: <Badge tone="hot">On Scene</Badge>,
                  task: "INC-4458 medical",
                  free: <span className="font-mono">00:41</span>,
                },
                {
                  unit: <span className="font-mono text-flame">HZM-01</span>,
                  type: "Hazmat",
                  status: <Badge tone="dead">O.O.S.</Badge>,
                  task: "Maintenance",
                  free: <span className="font-mono">08:00</span>,
                },
              ]}
            />
          </Section>

          <Section index="12" title="Timeline + radio log">
            <div className="grid gap-8 lg:grid-cols-2">
              <Timeline
                items={[
                  {
                    time: "21:04",
                    title: "Call received",
                    detail: "Smoke visible — 1400 blk Meridian",
                    tone: "flame",
                  },
                  {
                    time: "21:05",
                    title: "Grouped 3 calls",
                    detail: "INC-4471 classified structure fire P1",
                    tone: "flame",
                  },
                  {
                    time: "21:06",
                    title: "Dispatch approved",
                    detail: "ENG-01, LDR-02, TND-04 committed by operator",
                    tone: "bone",
                  },
                  {
                    time: "21:11",
                    title: "First due on scene",
                    detail: "ENG-01 established command",
                    tone: "ash",
                  },
                ]}
              />
              <div>
                <LogFeed
                  lines={[
                    {
                      time: "21:06:12",
                      tag: "AGENT",
                      text: "Recommend ENG-01 LDR-02 TND-04 — conf 0.87",
                      tone: "flame",
                    },
                    {
                      time: "21:06:48",
                      tag: "OPS",
                      text: "Approved. Roll it.",
                    },
                    {
                      time: "21:07:02",
                      tag: "ENG-01",
                      text: "Responding, 4 aboard",
                    },
                    {
                      time: "21:07:19",
                      tag: "AGENT",
                      text: "EMS contact confirmed by caller — PD notified",
                      tone: "ash",
                    },
                    {
                      time: "21:08:55",
                      tag: "WX",
                      text: "Scene wind 14kt NW — approach upwind",
                      tone: "ash",
                    },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section index="13" title="Unit cards">
            <div className="grid gap-5 md:grid-cols-3">
              {units.map((u) => (
                <UnitCard key={u.id} unit={u} />
              ))}
            </div>
          </Section>

          <Section index="14" title="Crew chips">
            <div className="flex flex-wrap gap-3">
              <CrewChip
                member={{
                  name: "R. Alvarez",
                  role: "Firefighter",
                  status: "On scene",
                  freeAt: "00:47",
                }}
              />
              <CrewChip
                member={{
                  name: "D. Chen",
                  role: "Driver // ENG-01",
                  status: "En route",
                  freeAt: "00:18",
                }}
              />
              <CrewChip
                member={{
                  name: "M. Okafor",
                  role: "Battalion chief",
                  status: "Command",
                  freeAt: "TBD",
                }}
              />
              <CrewChip
                member={{
                  name: "S. Reyes",
                  role: "Firefighter",
                  status: "Standby",
                  freeAt: "NOW",
                  onDuty: false,
                }}
              />
            </div>
          </Section>

          <Section index="15" title="Incident + call cards">
            <div className="grid gap-5 lg:grid-cols-2">
              <IncidentCard
                incident={{
                  id: "INC-4471",
                  priority: "P1",
                  classification: "Structure fire — warehouse",
                  address: "1400 blk Meridian Ave // GRID C4",
                  reportedAgo: "4 min ago",
                  status: "Awaiting approval",
                  statusTone: "warm",
                  calls: "3 calls grouped",
                  units: ["ENG-01", "LDR-02", "TND-04"],
                }}
              />
              <div className="space-y-5">
                <CallCard
                  call={{
                    caller: "J. Moreno",
                    number: "+1 (555) 014-2287",
                    duration: "01:34",
                    transcript:
                      "…flames through the roof on the east side, nobody inside that I can see — the alarm company's already called twice…",
                    extracted: ["Structure", "GRID C4", "No entrapment", "EMS on site"],
                    live: true,
                  }}
                />
                <WeatherStrip
                  wind="14 kt"
                  windDir="NW"
                  temp="61°F"
                  humidity="38%"
                  precip="0%"
                />
              </div>
            </div>
          </Section>

          <Section index="16" title="Panel variants">
            <div className="grid gap-5 md:grid-cols-2">
              <Panel title="Bracketed" led="on" right={<span>STD</span>}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Default panel — machined corner brackets + rivets
                </p>
              </Panel>
              <Panel chamfered title="Chamfered" led="off" right={<span>CHF</span>}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Chamfered frame — clipped edge, no brackets
                </p>
              </Panel>
            </div>
          </Section>

          <Section index="17" title="Misc">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-6">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  <Kbd>D</Kbd> dispatch
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  <Kbd>H</Kbd> hold
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  <Kbd>Esc</Kbd> close
                </span>
              </div>
              <Divider label="Skeletons" />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          </Section>

          <Section index="18" title="Textures">
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
          <span>SIREN DS // BUILD 0.3</span>
          <span>SHARP // RED // NO RADIUS</span>
        </footer>
      </div>
    </div>
  );
}
