import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps {
  columns: TableColumn[];
  rows: Array<Record<string, ReactNode>>;
  dense?: boolean;
  className?: string;
}

export function DataTable({
  columns,
  rows,
  dense = false,
  className,
}: DataTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-flame/25">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-3 pb-2 font-mono text-[9px] font-normal uppercase tracking-[0.25em] text-ash",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-flame/10 transition-colors last:border-b-0 hover:bg-flame/5"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 text-xs text-bone/80",
                    dense ? "py-1.5" : "py-2.5",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.className,
                  )}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
