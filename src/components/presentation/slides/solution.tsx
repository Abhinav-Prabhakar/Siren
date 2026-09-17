import { SlideFrame } from "@/components/presentation/slide-frame";
import { Divider } from "@/components/ui/divider";
import { Led } from "@/components/ui/led";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { DataTable } from "@/components/ui/table";

const FLOW = [
  { n: "01", label: "Answer", detail: "Vapi picks up — every call, instantly" },
  { n: "02", label: "Triage", detail: "classify + locate the emergency" },
  {
    n: "03",
    label: "Propose",
    detail: "units, crew and kit — telemetry-checked",
  },
  { n: "04", label: "Approve", detail: "operator confirms in one click" },
  { n: "05", label: "Roll", detail: "dispatch, notify, log everything" },
];

const FEATURES = [
  { label: "Voice intake via Vapi", detail: "Every call answered, 24/7" },
  { label: "Multi-call grouping", detail: "Same fire, one incident" },
  {
    label: "Telemetry-aware picks",
    detail: "Fuel, water, SCBA checked before dispatch",
  },
  {
    label: "Human-in-the-loop",
    detail: "Approve / reject in the console",
  },
  {
    label: "Live console + agent chat",
    detail: "Full situational board",
  },
  {
    label: "Post-incident report",
    detail: "Everything logged for review",
  },
];

const PAIN_COLUMNS = [
  { key: "pain", label: "Pain", className: "text-ash" },
  { key: "answer", label: "Answer", className: "text-bone/90" },
];

const PAIN_ROWS = [
  { pain: "Radio chaos / missed calls", answer: "Every call answered + transcribed" },
  { pain: "Manual unit picking", answer: "Telemetry-aware proposals" },
  { pain: "Scattered reports", answer: "Grouped into one incident" },
  { pain: "No audit trail", answer: "Every action in the event log" },
];

export function SolutionSlide() {
  return (
    <SlideFrame
      index="02"
      section="SOLUTION"
      title="An agent on the wire, a human on the trigger"
      sub="proposed solution // siren"
    >
      <div className="grid h-full grid-cols-12 gap-8">
        <Panel
          title="CORE CONCEPT"
          led="on"
          className="col-span-5 flex h-full flex-col"
          bodyClassName="flex flex-1 flex-col p-6"
        >
          <p className="text-[16px] leading-relaxed text-bone/80">
            Siren sits on the emergency line. A Vapi voice agent answers every
            call instantly, extracts classification + address, groups related
            calls into a single incident, and proposes a dispatch — units,
            crew and kit — for one-click operator approval.
          </p>
          <p className="mt-4 border-l-2 border-flame/40 pl-4 text-[13px] uppercase leading-relaxed tracking-[0.08em] text-blaze/90">
            The agent never self-dispatches — except night duty.
          </p>

          <Divider label="PIPELINE" className="mt-auto pt-9" />
          <ol className="relative mt-6">
            <span
              aria-hidden
              className="absolute bottom-4 left-[7px] top-4 w-px bg-gradient-to-b from-flame/50 via-flame/25 to-flame/10"
            />
            {FLOW.map((s) => (
              <li
                key={s.n}
                className="relative flex items-center gap-5 py-3 pl-8"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-[15px] w-[15px] -translate-y-1/2 rotate-45 border border-flame/60 bg-ink shadow-[0_0_8px_rgb(255_46_46/0.35)]"
                />
                <span className="w-8 font-mono text-[13px] font-medium text-flame">
                  {s.n}
                </span>
                <span className="w-28 font-mono text-[13px] uppercase tracking-[0.25em] text-bone">
                  {s.label}
                </span>
                <span className="font-mono text-[12px] tracking-[0.05em] text-ash">
                  {s.detail}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="KEY FEATURES"
          className="col-span-4 flex h-full flex-col"
          bodyClassName="flex flex-1 flex-col p-6"
        >
          <ul className="flex flex-1 flex-col justify-between">
            {FEATURES.map((f, i) => (
              <li
                key={f.label}
                className="flex items-start gap-4 border-t border-flame/10 pt-5 first:border-t-0 first:pt-0"
              >
                <Led
                  tone={i % 3 === 2 ? "blaze" : "flame"}
                  className="mt-1.5 shrink-0"
                />
                <div>
                  <div className="font-mono text-[13px] uppercase tracking-[0.18em] text-bone">
                    {f.label}
                  </div>
                  <div className="mt-1 text-[13px] leading-snug text-ash">
                    {f.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="VALUE"
          chamfered
          className="col-span-3 h-full [&>div]:flex [&>div]:h-full [&>div]:flex-col"
          bodyClassName="flex flex-1 flex-col p-5"
        >
          <div className="flex flex-1 flex-col justify-between py-1">
            <Stat
              label="LATENCY"
              value="≤30s"
              sub="call → proposal (target)"
            />
            <Stat label="COVERAGE" value="24/7" sub="intake coverage" />
            <Stat label="INTAKE" value="0" sub="missed calls" />
            <Stat label="DISPATCH" value="1-click" sub="operator approval" />
          </div>
          <Divider label="PAIN → ANSWER" className="mt-6" />
          <DataTable
            dense
            columns={PAIN_COLUMNS}
            rows={PAIN_ROWS}
            className="mt-4"
          />
        </Panel>
      </div>
    </SlideFrame>
  );
}
