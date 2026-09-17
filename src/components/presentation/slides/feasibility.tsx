import { SlideFrame } from "@/components/presentation/slide-frame";
import {
  Alert,
  Badge,
  DataTable,
  Divider,
  Led,
  Meter,
  Panel,
} from "@/components/ui";

const techNotes = [
  "Stateless REST + SQLite — zero-infra, swaps to Postgres",
  "4s polling → SSE/WebSocket upgrade path",
  "Webhook-secret auth + approval gate",
  "Local-first — console survives WAN drops",
];

const opsNotes = [
  "Drops into existing control-room workflow",
  "Operator keeps final authority — adoption, not replacement",
  "Night-duty autonomous mode when staffing is thin",
  "Minimal training — console mirrors the physical board",
];

const riskRows = [
  {
    risk: "Hallucinated address / classification",
    mitigation: "Human approval gate + read-back confirmation",
  },
  {
    risk: "Vapi or carrier outage",
    mitigation: "Calls queue, console flags link-down, manual intake path",
  },
  {
    risk: "Single-box failure",
    mitigation: "SQLite snapshot export + cold standby",
  },
  {
    risk: "Dispatch latency",
    mitigation: "Webhook colocated with DB, sub-second writes",
  },
];

function NoteList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5">
          <Led tone="flame" size="sm" className="mt-1 shrink-0" />
          <span className="font-mono text-[12px] uppercase leading-relaxed tracking-[0.12em] text-bone/75">
            {t}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FeasibilitySlide() {
  return (
    <SlideFrame
      index="04"
      section="FEASIBILITY"
      title="Feasible today, viable at scale"
      sub="technical + operational reality check"
      bodyClassName="flex flex-col gap-6"
    >
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-8">
        <Panel
          title="TECHNICAL"
          led="on"
          className="col-span-4"
          bodyClassName="flex h-full flex-col gap-5"
        >
          <Meter label="API latency budget" value={92} />
          <Meter label="Dispatch accuracy w/ human gate" value={88} />
          <Meter label="Uptime target" value={99} />
          <Divider />
          <NoteList items={techNotes} />
        </Panel>

        <Panel
          title="OPERATIONAL"
          className="col-span-4"
          bodyClassName="flex h-full flex-col gap-5"
        >
          <NoteList items={opsNotes} />
          <div className="mt-auto flex flex-wrap gap-2.5 pt-2">
            <Badge tone="warm">No retraining</Badge>
            <Badge tone="cold">Side-by-side deploy</Badge>
          </div>
        </Panel>

        <Panel
          title="RISK REGISTER"
          led="pulse"
          className="col-span-4"
          bodyClassName="p-2"
        >
          <DataTable
            dense
            columns={[
              { key: "risk", label: "Risk" },
              { key: "mitigation", label: "Mitigation" },
            ]}
            rows={riskRows}
          />
        </Panel>
      </div>

      <Alert tone="warning" title="KNOWN BOTTLENECK">
        Model accuracy on noisy, panicked calls. Mitigated by read-back
        confirmation prompts and the human approval gate — the agent proposes, a
        person dispatches.
      </Alert>
    </SlideFrame>
  );
}
