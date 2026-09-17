import { SlideFrame } from "@/components/presentation/slide-frame";
import { Badge, Button, Panel } from "@/components/ui";

export function ClosingSlide() {
  return (
    <SlideFrame
      index="06"
      section="CLOSE"
      title="Siren // standing by"
      sub="every call answered — every unit accounted for — every second counted"
      bodyClassName="relative flex items-center justify-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-cover bg-center opacity-30"
        style={{ backgroundImage: "url(/station-bg.png)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-ink via-ink/60 to-transparent"
      />

      <div className="relative z-10 flex w-full max-w-[900px] flex-col items-center gap-8">
        <Panel
          chamfered
          title="THE ASK"
          led="on"
          className="w-full"
          bodyClassName="flex flex-col items-center gap-8 px-10 py-10 text-center"
        >
          <p className="font-display text-2xl font-bold uppercase leading-snug tracking-[0.06em] text-bone">
            Put an agent on your wire. Deploy Siren at your station and let the
            console prove it.
          </p>
          <div className="flex items-center gap-5">
            <Button led="pulse" href="/">
              Open the console
            </Button>
            <Button variant="outline" href="/components">
              Design system
            </Button>
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <Badge tone="hot">Hackathon 2026</Badge>
          <Badge tone="cold">STA-01</Badge>
          <Badge tone="warm">Voice + Agent + Telemetry</Badge>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ash">
          github.com/Abhinav-Prabhakar/Siren {"//"} built at the hackathon
        </p>
      </div>
    </SlideFrame>
  );
}
