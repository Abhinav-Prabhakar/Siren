import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Led } from "./led";

export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonLed = "off" | "on" | "pulse";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-5 text-[10px]",
  md: "h-11 px-7 text-xs",
  lg: "h-14 px-10 text-sm",
};

/* outer layer draws the chamfered edge */
const frameClasses: Record<ButtonVariant, string> = {
  solid: "bg-flame",
  outline: "bg-flame/40 group-hover:bg-flame/80",
  ghost: "bg-ash/20 group-hover:bg-flame/50",
};

/* inner layer is the button face */
const faceClasses: Record<ButtonVariant, string> = {
  solid: "bg-flame group-hover:bg-blaze group-active:bg-blood",
  outline: "bg-ink group-hover:bg-wine/60",
  ghost: "bg-ink group-hover:bg-flame/10",
};

const labelClasses: Record<ButtonVariant, string> = {
  solid: "text-white",
  outline: "text-flame",
  ghost: "text-bone/60 group-hover:text-bone",
};

const ledMap: Record<ButtonLed, { tone: "flame" | "blaze" | "off"; pulse: boolean }> = {
  off: { tone: "off", pulse: false },
  on: { tone: "flame", pulse: false },
  pulse: { tone: "blaze", pulse: true },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Status dot on the button face. Omit for no dot. */
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
    "group relative inline-flex cursor-pointer select-none items-center justify-center text-center font-display font-bold uppercase tracking-[0.18em] transition duration-150",
    "active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-40",
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
          "clip-chamfer absolute inset-0 transition-colors duration-150",
          frameClasses[variant],
        )}
      />
      <span
        aria-hidden
        className={cn(
          "clip-chamfer absolute inset-px transition-colors duration-150 [--chamfer:12px]",
          faceClasses[variant],
        )}
      />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {led !== undefined && (
          <Led
            tone={variant === "solid" && led !== "off" ? "bone" : ledMap[led].tone}
            pulse={ledMap[led].pulse}
            size="sm"
          />
        )}
        <span>{children}</span>
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
