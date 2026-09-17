import { cn } from "@/lib/utils";

export type LedTone = "flame" | "blaze" | "bone" | "off";

const lampClasses: Record<LedTone, string> = {
  flame: "bg-flame",
  blaze: "bg-blaze",
  bone: "bg-bone/70",
  off: "bg-ash/30",
};

const sizeClasses = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-2 w-2",
} as const;

export interface LedProps {
  tone?: LedTone;
  pulse?: boolean;
  size?: keyof typeof sizeClasses;
  className?: string;
}

/** Square status dot — lit tones carry a faint glow. */
export function Led({
  tone = "flame",
  pulse = false,
  size = "md",
  className,
}: LedProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0",
        sizeClasses[size],
        lampClasses[tone],
        tone === "flame" && "shadow-[0_0_6px_rgb(255_46_46/0.7)]",
        tone === "blaze" && "shadow-[0_0_6px_rgb(255_106_61/0.7)]",
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}
