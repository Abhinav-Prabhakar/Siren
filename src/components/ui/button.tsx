import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[10px]",
  md: "h-11 px-6 text-xs",
  lg: "h-14 px-9 text-sm",
};

const frameClasses: Record<ButtonVariant, string> = {
  solid: "bg-gradient-to-b from-blaze via-flame to-blood",
  outline: "bg-flame/60 group-hover:bg-flame",
  ghost: "bg-ash/25 group-hover:bg-flame/70",
};

const fillClasses: Record<ButtonVariant, string> = {
  solid:
    "bg-gradient-to-b from-[#ff4a3d] via-flame to-[#c4121c] group-hover:from-blaze group-hover:via-[#ff3b3b] group-hover:to-flame",
  outline: "bg-ink/85 group-hover:bg-wine/80",
  ghost: "bg-transparent group-hover:bg-flame/10",
};

const labelClasses: Record<ButtonVariant, string> = {
  solid: "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]",
  outline: "text-flame group-hover:text-blaze",
  ghost: "text-bone/70 group-hover:text-bone",
};

function Decor() {
  return (
    <>
      {/* sheen sweep on hover */}
      <span
        aria-hidden
        className="clip-chamfer pointer-events-none absolute inset-px [--chamfer:13px] overflow-hidden"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-[160%] -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-[460%]" />
      </span>
      {/* rivets at the chamfered corners */}
      <span
        aria-hidden
        className="absolute right-1.5 top-1 h-[3px] w-[3px] rotate-45 bg-current opacity-60"
      />
      <span
        aria-hidden
        className="absolute bottom-1 left-1.5 h-[3px] w-[3px] rotate-45 bg-current opacity-60"
      />
      {/* charge bar — widens on hover */}
      <span
        aria-hidden
        className="absolute bottom-[3px] left-1/2 h-[2px] w-5 -translate-x-1/2 bg-current opacity-90 transition-all duration-300 group-hover:w-[calc(100%-36px)]"
      />
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders as a link when set. */
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(
    "group relative inline-flex cursor-pointer select-none items-center justify-center text-center font-display font-bold uppercase tracking-[0.18em] transition duration-150",
    "hover:drop-shadow-[0_0_16px_rgb(255_46_46/0.45)] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50",
    sizeClasses[size],
    labelClasses[variant],
    className,
  );

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "clip-chamfer absolute inset-0 transition-colors",
          frameClasses[variant],
        )}
      />
      <span
        aria-hidden
        className={cn(
          "clip-chamfer absolute inset-px transition-colors [--chamfer:13px]",
          fillClasses[variant],
        )}
      />
      <Decor />
      <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
        <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-current" />
        <span>{children}</span>
        <span aria-hidden className="font-mono font-normal leading-none opacity-70">
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
