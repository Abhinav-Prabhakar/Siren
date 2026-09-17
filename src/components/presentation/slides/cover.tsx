import Image from "next/image";
import { SlideFrame } from "@/components/presentation/slide-frame";
import { Badge } from "@/components/ui/badge";
import { Led } from "@/components/ui/led";
import { Panel } from "@/components/ui/panel";

export function CoverSlide() {
  return (
    <SlideFrame index="01" section="COVER" bleed>
      <Image
        src="/station-bg.png"
        alt=""
        fill
        priority
        sizes="1920px"
        className="object-cover object-right opacity-70"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[440px] bg-gradient-to-t from-ink via-ink/50 to-transparent"
      />
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div
        aria-hidden
        className="bg-scanlines absolute inset-0 opacity-30"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-flame/25"
      />

      {/* left column — wordmark + tagline */}
      <div className="absolute inset-y-0 left-0 flex w-[1120px] flex-col justify-center px-24 pb-16">
        <div className="flex items-center gap-4">
          <Led tone="flame" pulse size="lg" />
          <span className="font-mono text-[14px] uppercase tracking-[0.45em] text-ash">
            STA-01 <span className="text-flame">{"//"}</span> Autonomous
            dispatch
          </span>
        </div>

        <h1 className="text-glow mt-6 font-display text-[160px] font-black uppercase leading-[0.85] tracking-[0.02em] text-bone">
          Sire<span className="text-flame">n</span>
        </h1>
        <div
          aria-hidden
          className="mt-7 h-[5px] w-80 bg-gradient-to-r from-flame via-blaze to-transparent"
        />

        <p className="mt-8 max-w-[720px] text-[22px] leading-snug text-bone/80">
          An agent that answers the call, triages the chaos, and rolls the
          trucks.
        </p>

        <div className="mt-9 flex items-center gap-3">
          <Badge tone="hot">Hackathon</Badge>
          <Badge tone="warm">Voice + Agent + Telemetry</Badge>
          <Badge tone="cold">Human in the loop</Badge>
        </div>
      </div>

      {/* problem statement, lower-left over the art */}
      <Panel
        title="PROBLEM"
        led="pulse"
        chamfered
        className="absolute bottom-28 left-24 w-[660px]"
        bodyClassName="p-5"
      >
        <p className="text-[17px] leading-relaxed text-bone/80">
          Emergency call-takers are drowning. Calls queue on a shared radio
          channel, dispatch is manual and sequential, and details scatter
          across multiple callers reporting the same fire. Every second
          between ring and wheels-rolling costs property — and lives.
        </p>
      </Panel>

      {/* footer strip — bleed skips the frame chrome */}
      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-flame/15 bg-ink/60 px-16 py-5">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-ash">
          <span
            aria-hidden
            className="clip-tag inline-block h-3 w-3 bg-flame [--chamfer:3px]"
          />
          Siren {"//"} pitch-deck
        </div>
        <div
          aria-hidden
          className="bg-hazard-tight h-[6px] w-44 opacity-40"
        />
        <span className="font-mono text-[11px] tracking-[0.3em] text-ash">
          01 / 06
        </span>
      </footer>
    </SlideFrame>
  );
}
