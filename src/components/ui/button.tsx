import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonLed = "off" | "on" | "pulse";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-5 text-[10px]",
  md: "h-11 px-7 text-xs",
  lg: "h-14 px-10 text-sm",
};

/* outer frame — the 1px "cut metal" border that shows around the plate */
const frameClasses: Record<ButtonVariant, string> = {
  solid: "bg-gradient-to-b from-blaze via-flame to-blood",
  outline:
    "bg-gradient-to-b from-ash/40 via-flame/50 to-blood/70 group-hover:from-blaze group-hover:via-flame group-hover:to-blood",
  ghost: "bg-ash/15 group-hover:bg-flame/60",
};

/* inner plate — beveled raised key; active state drives it "down" */
const plateClasses: Record<ButtonVariant, string> = {
  solid:
    "bg-gradient-to-b from-[#ff5f4e] via-flame to-[#a8121b] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_8px_12px_-8px_rgb(255_170_140/0.55),inset_0_-10px_14px_-6px_rgb(0_0_0/0.55)] group-hover:from-[#ff7a5f] group-hover:via-[#ff3d3d] group-hover:to-[#c0121c] group-active:shadow-[inset_0_3px_12px_rgb(0_0_0/0.65)] group-active:brightness-90",
  outline:
    "bg-gradient-to-b from-smoke via-coal to-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-8px_12px_-6px_rgb(0_0_0/0.65)] group-hover:from-wine group-hover:via-[#1d0a0d] group-hover:to-ink group-active:shadow-[inset_0_3px_12px_rgb(0_0_0/0.7)] group-active:brightness-90",
  ghost:
    "bg-transparent group-hover:bg-gradient-to-b group-hover:from-wine/70 group-hover:to-ink/80 group-hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]",
};

const labelClasses: Record<ButtonVariant, string> = {
  solid:
    "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.55),0_-1px_0_rgb(90_0_0/0.6)]",
  outline:
    "text-flame group-hover:text-blaze [text-shadow:0_0_14px_rgb(255_46_46/0.4)]",
  ghost: "text-bone/60 group-hover:text-bone",
};

/* machined grip ridges on the left flank */
const serrationClasses: Record<ButtonVariant, string> = {
  solid:
    "bg-[repeating-linear-gradient(to_bottom,rgb(0_0_0/0.5)_0_1.5px,transparent_1.5px_4px)] opacity-70",
  outline:
    "bg-[repeating-linear-gradient(to_bottom,rgb(255_46_46/0.45)_0_1.5px,transparent_1.5px_4px)] opacity-60 group-hover:opacity-100",
  ghost:
    "bg-[repeating-linear-gradient(to_bottom,rgb(255_46_46/0.5)_0_1.5px,transparent_1.5px_4px)] opacity-0 group-hover:opacity-70",
};

/* hazard-tick rail on the right flank */
const hazardRailClasses: Record<ButtonVariant, string> = {
  solid:
    "bg-[repeating-linear-gradient(-45deg,rgb(6_6_7/0.8)_0_3px,rgb(255_106_61/0.95)_3px_6px)] opacity-80 group-hover:opacity-100",
  outline: "bg-hazard-tight opacity-40 group-hover:opacity-80",
  ghost: "bg-hazard-tight opacity-0 group-hover:opacity-40",
};

const screwClasses: Record<ButtonVariant, string> = {
  solid: "opacity-90",
  outline: "opacity-70 group-hover:opacity-100",
  ghost: "opacity-0 group-hover:opacity-50",
};

const lampClasses: Record<ButtonLed, string> = {
  off: "bg-ash/25 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]",
  on: "bg-flame shadow-[0_0_8px_1px_rgb(255_46_46/0.8),inset_0_1px_0_rgb(255_255_255/0.6)]",
  pulse:
    "bg-blaze shadow-[0_0_10px_2px_rgb(255_106_61/0.9),inset_0_1px_0_rgb(255_255_255/0.6)] animate-pulse",
};

/* diamond head + slot — reads as a machined screw, not a flat dot */
function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute flex h-[5px] w-[5px] rotate-45 items-center justify-center bg-gradient-to-br from-bone/60 via-ash/40 to-ink shadow-[inset_0_0_1px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.1)] transition-opacity",
        className,
      )}
    >
      <span className="h-px w-[3px] bg-ink/80" />
    </span>
  );
}

/* bezel + lamp — unlit lamp still reads as hardware */
function Lamp({ led }: { led: ButtonLed }) {
  return (
    <span
      aria-hidden
      className="flex h-2.5 w-2.5 items-center justify-center bg-ink/80 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.08)]"
    >
      <span className={cn("h-1.5 w-1.5", lampClasses[led])} />
    </span>
  );
}

function Decor({ variant }: { variant: ButtonVariant }) {
  return (
    <>
      {/* left grip serrations */}
      <span
        aria-hidden
        className={cn(
          "absolute left-[5px] top-1/2 h-3/5 w-[3px] -translate-y-1/2 transition-opacity",
          serrationClasses[variant],
        )}
      />
      {/* right hazard rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2.5 right-[3px] w-[3px] transition-opacity",
          hazardRailClasses[variant],
        )}
      />
      {/* screws on the two non-chamfered corners */}
      <Screw className={cn("left-1 top-1", screwClasses[variant])} />
      <Screw className={cn("bottom-1 right-1", screwClasses[variant])} />
      {/* sheen sweep on hover */}
      <span
        aria-hidden
        className="clip-chamfer pointer-events-none absolute inset-px [--chamfer:13px] overflow-hidden"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-[160%] -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-[460%]" />
      </span>
      {/* charge bar — widens on hover, recedes on press */}
      <span
        aria-hidden
        className="absolute bottom-[3px] left-1/2 h-[2px] w-6 -translate-x-1/2 bg-current opacity-80 transition-all duration-300 group-hover:w-[calc(100%-44px)] group-active:w-[calc(100%-60px)]"
      />
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Status lamp on the button face. Omit for no lamp. */
  led?: ButtonLed;
  /** Stretch to fill the container. */
  block?: boolean;
  /** Renders as a link when set. */
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "solid",
  size = "md",
  led,
  block = false,
  className,
  children,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(
    "group relative inline-flex cursor-pointer select-none items-center justify-center text-center font-display font-bold uppercase tracking-[0.18em] transition duration-200",
    "hover:drop-shadow-[0_0_18px_rgb(255_46_46/0.5)] active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50",
    block && "flex w-full",
    sizeClasses[size],
    labelClasses[variant],
    className,
  );

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "clip-chamfer absolute inset-0 transition-colors duration-200",
          frameClasses[variant],
        )}
      />
      <span
        aria-hidden
        className={cn(
          "clip-chamfer absolute inset-px transition-all duration-200 [--chamfer:13px]",
          plateClasses[variant],
        )}
      />
      <Decor variant={variant} />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {led !== undefined && <Lamp led={led} />}
        <span>{children}</span>
        <span
          aria-hidden
          className="font-mono font-normal leading-none opacity-60"
        >
          {"//"}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {body}
    </button>
  );
}
