"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { SLIDE_H, SLIDE_W } from "@/components/presentation/slide-frame";
import { SLIDES } from "@/components/presentation/slides";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

const HUD_H = 64;
const LAST = SLIDES.length - 1;

const clampIdx = (n: number) => Math.min(Math.max(n, 0), LAST);

function hashIndex(): number | null {
  const m = /^#\/(\d+)$/.exec(window.location.hash);
  if (!m) return null;
  return clampIdx(Number(m[1]) - 1);
}

/* location.hash is the deck's source of truth — back/forward just work.
   pushState doesn't fire hashchange, so go() notifies subscribers itself. */
const hashListeners = new Set<() => void>();

function subscribeHash(cb: () => void) {
  hashListeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    hashListeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}

const readHashIndex = () => hashIndex() ?? 0;
const serverHashIndex = () => 0;

let vpCache = { w: SLIDE_W, h: SLIDE_H + HUD_H };

function subscribeViewport(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function readViewport() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== vpCache.w || h !== vpCache.h) vpCache = { w, h };
  return vpCache;
}

const serverViewport = () => vpCache;

function Clock() {
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums text-bone/80">{now}</span>;
}

const isFormTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable);

/** Letterboxed 1920×1080 stage with a console-style HUD and slide overview. */
export function Deck() {
  const index = useSyncExternalStore(
    subscribeHash,
    readHashIndex,
    serverHashIndex,
  );
  const vp = useSyncExternalStore(subscribeViewport, readViewport, serverViewport);
  const [overview, setOverview] = useState(false);

  const scale = Math.min(vp.w / SLIDE_W, (vp.h - HUD_H) / SLIDE_H);
  const slide = SLIDES[index];
  const Active = slide.Component;

  const go = useCallback((n: number) => {
    const k = clampIdx(n);
    history.pushState(null, "", "#/" + (k + 1));
    hashListeners.forEach((l) => l());
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isFormTarget(e.target)) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          go(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          go(index - 1);
          break;
        case "Home":
          e.preventDefault();
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(LAST);
          break;
        case "o":
        case "O":
        case "Escape":
          setOverview((v) => !v);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        default:
          if (e.key >= "1" && e.key <= String(SLIDES.length))
            go(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, toggleFullscreen]);

  /* overview thumbnails — 3-up grid inside a max-w-[1500px] gutter */
  const thumbW = (Math.min(vp.w - 48, 1500) - 48) / 3;
  const thumbScale = thumbW / SLIDE_W;

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="bg-scanlines pointer-events-none absolute inset-0 opacity-20"
      />
      <style>{`
        .deck-slide-in { animation: deck-slide-in 220ms ease-out both; }
        @keyframes deck-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .deck-slide-in { animation: none; }
        }
      `}</style>

      {/* stage — letterboxed into the space above the HUD */}
      <div className="absolute inset-x-0 bottom-16 top-0 flex items-center justify-center">
        <div
          className="relative"
          style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: SLIDE_W,
              height: SLIDE_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              key={index}
              className="deck-slide-in"
              style={{ width: SLIDE_W, height: SLIDE_H }}
            >
              <Active />
            </div>
          </div>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={overview}
            onClick={() => go(index - 1)}
            className="absolute inset-y-0 left-0 w-1/5 cursor-pointer"
          />
          <button
            type="button"
            aria-label="Next slide"
            disabled={overview}
            onClick={() => go(index + 1)}
            className="absolute inset-y-0 right-0 w-1/5 cursor-pointer"
          />
        </div>
      </div>

      {/* HUD */}
      <footer className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-between gap-6 border-t border-flame/20 bg-ink/90 px-6 backdrop-blur">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="clip-tag block h-6 w-6 shrink-0 bg-flame [--chamfer:6px]"
          />
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.35em] text-bone">
            Siren <span className="text-flame">{"//"}</span> Pitch
          </span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.25em] text-ash md:block">
            {slide.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, k) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Slide ${k + 1}`}
              onClick={() => go(k)}
              className={cn(
                "h-2.5 w-9 -skew-x-12 transition-colors",
                k <= index
                  ? "bg-gradient-to-t from-blood via-flame to-blaze"
                  : "bg-smoke hover:bg-ash/25",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <span
            aria-live="polite"
            className="font-mono text-sm tabular-nums text-bone"
          >
            {String(index + 1).padStart(2, "0")}
            <span className="text-ash">
              /{String(SLIDES.length).padStart(2, "0")}
            </span>
          </span>
          <span className="hidden font-mono text-[11px] text-ash lg:block">
            <Clock />
          </span>
          <span className="hidden items-center gap-1 xl:flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <Kbd>O</Kbd>
            <Kbd>F</Kbd>
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous slide"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next slide"
              disabled={index === LAST}
              onClick={() => go(index + 1)}
            >
              Next
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle fullscreen"
              onClick={toggleFullscreen}
            >
              Full
            </Button>
          </span>
        </div>
      </footer>

      {/* overview */}
      {overview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur-md">
          <div className="mx-auto max-w-[1500px] px-6 py-10">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-flame/20 pb-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.4em] text-bone">
                Overview <span className="text-flame">{"//"}</span> All slides
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                Click to jump — ESC closes
              </span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {SLIDES.map((s, k) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${k + 1}: ${s.label}`}
                  onClick={() => {
                    go(k);
                    setOverview(false);
                  }}
                  className="group text-left"
                >
                  <div
                    className={cn(
                      "relative aspect-video w-full overflow-hidden border transition-colors",
                      k === index
                        ? "border-flame shadow-[0_0_28px_rgb(255_46_46/0.35)]"
                        : "border-flame/15 group-hover:border-flame/45",
                    )}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0"
                      style={{
                        width: SLIDE_W,
                        height: SLIDE_H,
                        transform: `scale(${thumbScale})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <s.Component />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.25em]">
                    <span className={k === index ? "text-flame" : "text-ash"}>
                      {String(k + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        k === index
                          ? "text-bone"
                          : "text-ash group-hover:text-bone",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
