import { cn } from "@/lib/utils";

export interface WeatherStripProps {
  /** Wind speed + unit, e.g. "14 kt" */
  wind: string;
  /** Compass direction, e.g. "NW" */
  windDir?: string;
  temp: string;
  humidity: string;
  precip: string;
  className?: string;
}

/** Destination climate readout — factors into dispatch decisions. */
export function WeatherStrip({
  wind,
  windDir,
  temp,
  humidity,
  precip,
  className,
}: WeatherStripProps) {
  const items = [
    { label: "Wind", value: windDir !== undefined ? `${wind} ${windDir}` : wind },
    { label: "Temp", value: temp },
    { label: "Humidity", value: humidity },
    { label: "Precip", value: precip },
  ];

  return (
    <div
      className={cn(
        "inline-flex divide-x divide-flame/15 border border-flame/20 bg-coal/80",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="px-3.5 py-2">
          <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-ash">
            {item.label}
          </div>
          <div className="mt-0.5 font-mono text-[11px] font-medium tracking-wider text-bone">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
