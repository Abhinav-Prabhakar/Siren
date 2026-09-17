import { SlideFrame } from "@/components/presentation/slide-frame";
import { ArchGraph } from "@/components/presentation/arch-graph";
import { Panel } from "@/components/ui/panel";
import { Led, type LedTone } from "@/components/ui/led";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";

const STACK: { key: string; value: string; tone: LedTone }[] = [
  { key: "frontend", value: "Next.js 16 · React 19 · Tailwind 4", tone: "flame" },
  { key: "backend", value: "FastAPI · uvicorn :8000", tone: "flame" },
  { key: "database", value: "SQLite — siren.db", tone: "flame" },
  { key: "voice", value: "Vapi assistant · server events", tone: "blaze" },
  { key: "agent", value: "rule-based + function-calls", tone: "blaze" },
  { key: "ui", value: "custom design system · zero radius", tone: "bone" },
];

const FLOW: TimelineItem[] = [
  {
    time: "01",
    title: "call lands on the wire",
    detail: "vapi streams audio + live transcript",
    tone: "flame",
  },
  {
    time: "02",
    title: "agent extracts classification + address",
    detail: "triage LLM → structured incident",
    tone: "bone",
  },
  {
    time: "03",
    title: "incident upserted, related calls grouped",
    detail: "sqlite — incidents · calls · events",
    tone: "bone",
  },
  {
    time: "04",
    title: "dispatch proposed — units / crew / kit",
    detail: "rules + function calls rank resources",
    tone: "flame",
  },
  {
    time: "05",
    title: "operator approves",
    detail: "POST /api/dispatches/:id/approve",
    tone: "flame",
  },
  {
    time: "06",
    title: "units committed — telemetry drifts",
    detail: "asyncio sim ticks fuel · water · vitals",
    tone: "ash",
  },
];

export function ArchitectureSlide() {
  return (
    <SlideFrame
      index="03"
      section="ARCHITECTURE"
      title="Call to wheels in one loop"
      sub="end-to-end system // data flows left to right"
      bodyClassName="grid grid-cols-[62%_1fr] gap-6"
    >
      <Panel
        title="SYSTEM GRAPH"
        led="on"
        right="// live topology"
        className="min-h-0"
        bodyClassName="p-3"
      >
        <ArchGraph />
      </Panel>

      <div className="flex min-h-0 flex-col gap-6">
        <Panel title="STACK" led="off" right="// manifest">
          <ul>
            {STACK.map((row) => (
              <li
                key={row.key}
                className="flex items-center gap-3 border-b border-flame/10 py-3 last:border-b-0"
              >
                <Led tone={row.tone} size="sm" />
                <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                  {row.key}
                </span>
                <span className="font-mono text-[13px] tracking-wide text-bone/85">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="DATA FLOW"
          led="pulse"
          right="// lifecycle"
          className="flex-1"
          bodyClassName="p-4 pt-5"
        >
          <Timeline items={FLOW} className="space-y-5" />
        </Panel>
      </div>
    </SlideFrame>
  );
}
