import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  sub?: string;
  /** Breadcrumb link back to the parent view. */
  back?: { href: string; label: string };
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  sub,
  back,
  status,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-end justify-between gap-6 border-b border-flame/20 pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {back !== undefined && (
          <Link
            href={back.href}
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash transition-colors hover:text-flame"
          >
            {"‹ "}
            {back.label}
          </Link>
        )}
        <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-[0.08em] text-bone">
          {title}
        </h1>
        {sub !== undefined && (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-ash">
            {sub}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {status}
        {actions}
      </div>
    </header>
  );
}
