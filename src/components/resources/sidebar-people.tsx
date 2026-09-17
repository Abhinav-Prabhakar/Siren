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
import { Led, Skeleton, type BadgeTone } from "@/components/ui";
import {
  fmtClock,
  type Personnel,
  type PersonnelRole,
  type PersonnelStatus,
} from "@/lib/api";
import type { Feed } from "./sidebar";
import {
  DockCell,
  GroupLabel,
  IconChip,
  InspectorDock,
  Row,
  RowMeta,
  TONE_TEXT,
} from "./rows";

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

const DEPLOYED: PersonnelStatus[] = [
  "dispatched",
  "en_route",
  "on_scene",
];

/** Manifest groups — deployed first, off watch last. */
const GROUPS: { label: string; statuses: PersonnelStatus[] }[] = [
  { label: "Deployed", statuses: DEPLOYED },
  { label: "On duty", statuses: ["on_duty"] },
  { label: "Resting", statuses: ["resting"] },
  { label: "Off duty", statuses: ["off_duty"] },
];

function PersonRow({
  person: p,
  onSelect,
  onHover,
}: {
  person: Personnel;
  onSelect: (id: string) => void;
  onHover: (p: Personnel | null) => void;
}) {
  const lamp = dutyLed(p.status);
  const flag = vitalsAlert(p);
  const tone = LAMP_TONE[lamp.tone];
  const Icon = ROLE_ICON[p.role];

  return (
    <Row
      onClick={() => onSelect(p.id)}
      onHover={(h) => onHover(h ? p : null)}
      dimmed={p.status === "off_duty"}
    >
      <IconChip tone={tone}>
        <Icon className={`h-4 w-4 ${lamp.pulse ? "animate-pulse" : ""}`} />
      </IconChip>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[13px] font-bold uppercase tracking-[0.08em] text-bone">
          {p.name}
        </span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-ash">
          {ROLE_SHORT[p.role]}
          {" · "}
          {p.vehicle_id ?? p.incident_id ?? p.station_id}
        </span>
      </span>
      <RowMeta
        top={STATUS_LABELS[p.status]}
        topClassName={TONE_TEXT[tone]}
        bottom={
          flag !== null ? (
            <span
              className={`flex items-center gap-1 ${
                flag === "critical" ? "text-flame" : "text-blaze"
              }`}
            >
              <HeartPulse
                className={`h-3 w-3 ${flag === "critical" ? "animate-pulse" : ""}`}
              />
              {p.heart_rate}
            </span>
          ) : (
            `til ${fmtClock(p.shift_end)}`
          )
        }
      />
    </Row>
  );
}

function PersonInspector({
  p,
  all,
}: {
  p: Personnel | null;
  all: Personnel[] | null;
}) {
  const flag = p === null ? null : vitalsAlert(p);
  const Icon = p === null ? Flame : ROLE_ICON[p.role];
  return (
    <InspectorDock
      title={p === null ? null : `${p.name} — ${p.rank}`}
      icon={<Icon className="h-3.5 w-3.5 text-flame" />}
      idle={
        all !== null && (
          <>
            {GROUPS.map((g) => {
              const n = all.filter((x) => g.statuses.includes(x.status)).length;
              return n > 0 ? (
                <span key={g.label}>
                  <span className="text-bone/70">{n}</span> {g.label}
                </span>
              ) : null;
            })}
          </>
        )
      }
    >
      {p !== null && (
        <>
          <DockCell label="Task">
            {STATUS_LABELS[p.status]}
            {p.incident_id !== null && ` · ${p.incident_id}`}
          </DockCell>
          <DockCell label="Unit">{p.vehicle_id ?? "—"}</DockCell>
          <DockCell label="Heart rate">
            <span
              className={
                flag === "critical"
                  ? "text-flame"
                  : flag === "warning"
                    ? "text-blaze"
                    : undefined
              }
            >
              {p.heart_rate} bpm
            </span>
          </DockCell>
          <DockCell label="SCBA / free">
            <span className="flex items-center gap-1.5">
              <Wind className="h-3 w-3 text-ash/60" />
              {Math.round(p.scba_pct)}% · til {fmtClock(p.shift_end)}
            </span>
          </DockCell>
        </>
      )}
    </InspectorDock>
  );
}

export function PersonnelList({ feed }: { feed: Feed<Personnel> }) {
  const { data, error, loading } = feed;
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Personnel | null>(null);

  const sorted = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.name.localeCompare(b.name),
      ),
    [data],
  );

  let body;
  if (data === null && loading) {
    body = (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (data === null) {
    body = (
      <div className="flex items-center gap-3 px-4 py-6">
        <Led tone="off" size="sm" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
          {error ?? "Roster feed down"}
        </span>
      </div>
    );
  } else {
    body = GROUPS.map((g) => {
      const inGroup = sorted.filter((p) => g.statuses.includes(p.status));
      if (inGroup.length === 0) return null;
      return (
        <div key={g.label}>
          <GroupLabel label={g.label} count={inGroup.length} />
          {inGroup.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onSelect={setSelected}
              onHover={setInspected}
            />
          ))}
        </div>
      );
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">{body}</div>
      <PersonInspector p={inspected} all={data} />
      {selected && (
        <PersonDetailModal id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
