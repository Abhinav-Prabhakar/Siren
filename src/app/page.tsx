import Image from "next/image";
import { Badge, Button } from "@/components/ui";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <Image
        src="/station-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* grade the render into the ink/flame system */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/35 to-ink/90"
      />
      <div
        aria-hidden
        className="bg-scanlines pointer-events-none absolute inset-0 opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgb(6_6_7/0.9)]"
      />

      <header className="relative z-10 flex items-center justify-between border-b border-flame/20 bg-ink/45 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="clip-tag block h-6 w-6 bg-flame [--chamfer:6px]"
          />
          <div>
            <div className="font-display text-sm font-black uppercase tracking-[0.3em] text-bone">
              Siren
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
              Autonomous fire dispatch
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ash md:inline">
            STA-01 // Night watch
          </span>
          <Button href="/components" variant="outline" size="sm">
            Design system
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <Badge tone="hot">System online // agent armed</Badge>
        <h1 className="text-glow font-display text-7xl font-black uppercase tracking-[0.06em] text-bone md:text-9xl">
          Siren
        </h1>
        <p className="max-w-xl font-mono text-[11px] uppercase leading-relaxed tracking-[0.3em] text-bone/70">
          AI dispatch for apparatus, crew and equipment — human approved,
          agent coordinated
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-5">
          <Button href="/components" size="lg">
            Enter console
          </Button>
          <Button href="/components" variant="outline" size="lg">
            View design system
          </Button>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-between border-t border-flame/20 bg-ink/55 px-6 py-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ash backdrop-blur-sm">
        <span>Units: 12 ready // 03 committed</span>
        <span className="hidden md:inline">Vapi link: ready</span>
        <span>INC queue: 02 active</span>
      </footer>
    </div>
  );
}
