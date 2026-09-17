import { cn } from "@/lib/utils";

export interface LogLine {
  time: string;
  tag?: string;
  text: string;
  tone?: "flame" | "bone" | "ash";
}

const toneClasses = {
  flame: "text-flame",
  bone: "text-bone/80",
  ash: "text-ash",
} as const;

/** Monospace radio/agent feed — newest at the bottom. */
export function LogFeed({
  lines,
  className,
}: {
  lines: LogLine[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-1 font-mono text-[11px] leading-relaxed tracking-wider",
        className,
      )}
    >
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3">
          <span className="shrink-0 text-ash/70">{line.time}</span>
          {line.tag !== undefined && (
            <span className="shrink-0 text-flame/80">[{line.tag}]</span>
          )}
          <span className={toneClasses[line.tone ?? "bone"]}>{line.text}</span>
        </div>
      ))}
    </div>
  );
}
