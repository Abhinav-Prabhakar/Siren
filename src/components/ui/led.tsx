import { cn } from "@/lib/utils";

export type LedTone = "flame" | "blaze" | "bone" | "off";

const lampClasses: Record<LedTone, string> = {
  flame:
    "bg-flame shadow-[0_0_8px_1px_rgb(255_46_46/0.8),inset_0_1px_0_rgb(255_255_255/0.6)]",
  blaze:
    "bg-blaze shadow-[0_0_8px_1px_rgb(255_106_61/0.8),inset_0_1px_0_rgb(255_255_255/0.6)]",
  bone: "bg-bone/70 shadow-[0_0_6px_0px_rgb(236_233_226/0.4)]",
  off: "bg-ash/25 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]",
};

const sizeClasses = {
  sm: { bezel: "h-2 w-2", lamp: "h-1 w-1" },
  md: { bezel: "h-2.5 w-2.5", lamp: "h-1.5 w-1.5" },
  lg: { bezel: "h-3.5 w-3.5", lamp: "h-2.5 w-2.5" },
} as const;

export interface LedProps {
  tone?: LedTone;
  pulse?: boolean;
  size?: keyof typeof sizeClasses;
  className?: string;
}

/** Bezel-mounted status lamp — unlit tones still read as hardware. */
export function Led({ tone = "flame", pulse = false, size = "md", className }: LedProps) {
  const s = sizeClasses[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center bg-ink/80 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.08)]",
        s.bezel,
        className,
      )}
    >
      <span
        className={cn("block", s.lamp, lampClasses[tone], pulse && "animate-pulse")}
      />
    </span>
  );
}
