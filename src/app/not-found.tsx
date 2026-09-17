import { ConsoleNav } from "@/components/console-nav";
import { Button, Led } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <ConsoleNav />
      <main className="bg-grid relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="bg-scanlines pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col items-center gap-6 px-5 text-center">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-ash">
            <Led tone="flame" size="sm" pulse />
            Signal lost
          </span>
          <h1 className="text-glow font-display text-[9rem] font-black leading-none tracking-tight text-flame sm:text-[12rem]">
            404
          </h1>
          <div className="bg-hazard-tight h-1.5 w-40 opacity-70" />
          <p className="max-w-sm font-mono text-xs uppercase leading-relaxed tracking-[0.25em] text-bone/70">
            Route not found — this frequency is dead air
          </p>
          <Button href="/" variant="outline" size="md" className="mt-2">
            Return to control room
          </Button>
        </div>
      </main>
    </>
  );
}
