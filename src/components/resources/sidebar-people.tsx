"use client";

import { useMemo, useState } from "react";
import {
  Flame,
  HeartPulse,
  Radio,
  Shield,
  Stethoscope,
  Truck,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  dutyLed,
  ROLE_SHORT,
  STATUS_LABELS,
  STATUS_ORDER,
  vitalsAlert,
} from "@/components/people/lib";
import { PersonDetailModal } from "@/components/people/person-detail-modal";
import { Led, Skeleton } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { type Personnel, type PersonnelRole } from "@/lib/api";
import type { Feed } from "./sidebar";
import { MiniBar, Row, TONE_TEXT } from "./rows";

const ROLE_ICON: Record<PersonnelRole, LucideIcon> = {
  firefighter: Flame,
  driver: Truck,
  chief: Shield,
  incident_commander: Radio,
  paramedic: Stethoscope,
};

const LAMP_TONE: Record<string, BadgeTone> = {
  flame: "hot",
  blaze: "warm",
  bone: "cold",
  off: "dead",
};

const COMMITTED: ReadonlySet<string> = new Set([
  "dispatched",
  "en_route",
  "on_scene",
]);

function PersonRow({
  person: p,
  onSelect,
}: {
  person: Personnel;
  onSelect: (id: string) => void;
}) {
  const lamp = dutyLed(p.status);
  const flag = vitalsAlert(p);
  const Icon = ROLE_ICON[p.role];
  const committed = COMMITTED.has(p.status);
  const offWatch = p.status === "off_duty" || p.status === "resting";

  return (
    <Row onClick={() => onSelect(p.id)} dimmed={p.status === "off_duty"}>
      <Icon
        className={`h-5 w-5 shrink-0 ${TONE_TEXT[LAMP_TONE[lamp.tone]]} ${lamp.pulse ? "animate-pulse" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-[13px] font-bold uppercase tracking-[0.08em] text-bone">
            {p.name}
          </span>
          <span
            className={`flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums ${
              flag === "critical"
                ? "text-flame"
                : flag === "warning"
                  ? "text-blaze"
                  : "text-ash/60"
            }`}
          >
            <HeartPulse
              className={`h-3.5 w-3.5 ${flag === "critical" ? "animate-pulse" : ""}`}
            />
            {p.heart_rate}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-ash">
          {ROLE_SHORT[p.role]}
          {" · "}
          {STATUS_LABELS[p.status]}
          {p.vehicle_id !== null && ` · ${p.vehicle_id}`}
          {p.incident_id !== null && ` · ${p.incident_id}`}
        </div>
        {committed && (
          <div className="mt-1.5 flex items-center gap-2">
            <Wind className="h-3 w-3 shrink-0 text-ash/60" />
            <MiniBar value={p.scba_pct} />
            <span
              className={`shrink-0 font-mono text-[9px] tabular-nums ${
                p.scba_pct <= 25 ? "text-flame" : "text-ash/70"
              }`}
            >
              {Math.round(p.scba_pct)}%
            </span>
          </div>
        )}
        {offWatch && (
          <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-ash/50">
            off watch
          </div>
        )}
      </div>
    </Row>
  );
}

export function PersonnelList({ feed }: { feed: Feed<Personnel> }) {
  const { data, error, loading } = feed;
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.name.localeCompare(b.name),
      ),
    [data],
  );

  if (data === null && loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Roster feed down"}
        </span>
      </div>
    );
  }

  return (
    <>
      {sorted.map((p) => (
        <PersonRow key={p.id} person={p} onSelect={setSelected} />
      ))}
      {selected && (
        <PersonDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
