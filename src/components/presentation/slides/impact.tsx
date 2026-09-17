import { SlideFrame } from "@/components/presentation/slide-frame";
import { BarChart, Divider, Led, Panel, Stat } from "@/components/ui";

const whoBenefits: Array<[string, string]> = [
  ["Callers", "Always answered, help rolls sooner"],
  ["Operators", "Decision support, less radio load"],
  ["Departments", "Audit trail, better coverage data"],
  ["Municipalities", "More coverage per dollar"],
];

const modelRows = [
  "Per-station SaaS subscription",
  "Usage tier per handled call",
  "Integration + onboarding services",
];

export function ImpactSlide() {
  return (
    <SlideFrame
      index="05"
      section="IMPACT"
      title="Every second off dispatch is a life on the board"
      sub="beneficiaries // quantified impact // commercial"
      bodyClassName="flex flex-col gap-8"
    >
      <div className="grid grid-cols-4 gap-8 border-y border-flame/15 py-5">
        <Stat label="TURNOUT" value="~40%" sub="faster turnout (projected)" />
        <Stat label="INTAKE" value="0" sub="missed calls" />
        <Stat label="COVERAGE" value="24/7" sub="intake coverage" />
        <Stat label="STAFFING" value="1" sub="operator per multi-station view" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-8">
        <Panel
          title="SECONDS SAVED"
          led="on"
          className="col-span-5"
          bodyClassName="flex h-full flex-col"
        >
          <BarChart
            data={[
              { label: "MANUAL", value: 225, muted: true },
              { label: "SIREN", value: 60 },
            ]}
            height={220}
            className="my-auto"
          />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            call → wheels-rolling {"//"} target
          </p>
        </Panel>

        <Panel
          title="WHO BENEFITS"
          className="col-span-4"
          bodyClassName="flex h-full flex-col justify-center"
        >
          <ul className="space-y-4">
            {whoBenefits.map(([name, desc]) => (
              <li key={name} className="flex items-start gap-3">
                <span className="w-32 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-flame">
                  {name}
                </span>
                <span className="text-[13px] leading-snug text-bone/75">
                  {desc}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="MODEL"
          chamfered
          className="col-span-3"
          bodyClassName="flex h-full flex-col gap-4"
        >
          <ul className="space-y-3">
            {modelRows.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Led tone="blaze" size="sm" className="mt-1 shrink-0" />
                <span className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.15em] text-bone/75">
                  {t}
                </span>
              </li>
            ))}
          </ul>
          <Divider label="COST" className="mt-auto" />
          <p className="text-[12px] leading-relaxed text-bone/70">
            Single-box deploy — Next + FastAPI + SQLite — near-zero marginal
            cost per station.
          </p>
        </Panel>
      </div>
    </SlideFrame>
  );
}
