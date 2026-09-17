"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Led,
  Modal,
  Panel,
  Skeleton,
  Tip,
  type BadgeTone,
} from "@/components/ui";
import {
  api,
  fmtAgo,
  fmtClock,
  statusTone,
  type Dispatch,
  type DispatchStatus,
} from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_ICONS,
  classificationKey,
  DISPATCH_ICON_FALLBACK,
  DISPATCH_ICONS,
} from "@/components/incidents/incident-icons";
import { PriorityMark } from "@/components/incidents/marks";

const POLL_MS = 4000;
const DECIDED_SHOWN = 6;

/** Priority rail on the left edge of a proposal row. */
const PROPOSAL_RAIL: Record<BadgeTone, string> = {
  hot: "bg-flame shadow-[2px_0_12px_-2px_rgb(255_46_46/0.7)]",
  warm: "bg-blaze",
  cold: "bg-bone/40",
  dead: "bg-ash/30",
  plain: "bg-flame/50",
};

/** Decided-dispatch rows get a glyph + tone, never a badge. */
const DECIDE_ICON_CLS: Record<DispatchStatus, string> = {
  pending: "text-blaze",
  approved: "text-flame",
  rejected: "text-ash/50",
  completed: "text-bone/70",
};

/**
 * Icon-headed resource manifest. `compact` reads as icon + count with the
 * id list on hover; the expanded form prints ids inline (modal detail).
 */
function Manifest({
  icon: Icon,
  items,
  max = 6,
  compact = false,
}: {
  icon: LucideIcon;
  items: string[];
  max?: number;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  if (compact) {
    return (
      <Tip side="bottom" content={items.join("  ·  ")}>
        <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-bone/70">
          <Icon
            aria-hidden
            className="h-3 w-3 shrink-0 text-ash"
          />
          {items.length}
        </span>
      </Tip>
    );
  }
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <Icon
        aria-hidden
        className="h-3 w-3 shrink-0 translate-y-px text-flame/70"
      />
      <span className="truncate font-mono text-[10px] tracking-[0.12em] text-bone/70">
        {items.slice(0, max).join(" · ")}
        {items.length > max && (
          <span className="text-ash"> +{items.length - max}</span>
        )}
      </span>
    </span>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-8">
      <Led tone="off" size="sm" />
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash/70">
        {text}
      </span>
    </div>
  );
}

/**
 * Human-in-the-loop dispatch queue — the panel that used to sit centre-stage
 * in the control room, relocated to live under the incident board. Pending
 * proposals carry approve/reject; a short decided log trails below. Clicking
 * a proposal arms its incident on the board via `onSelectIncident`.
 */
export function ApprovalsPanel({
  onSelectIncident,
  onChanged,
  className,
}: {
  onSelectIncident?: (incidentId: string) => void;
  /** fired after an approve/reject so the host can refetch its own feeds */
  onChanged?: () => void;
  className?: string;
}) {
  const dispatches = usePolling(() => api.dispatches(), POLL_MS);
  const [dispatchFocus, setDispatchFocus] = useState<Dispatch | null>(null);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(id);
  }, [notice]);

  async function decide(d: Dispatch, intent: "approve" | "reject") {
    if (acting) return;
    setActing(true);
    try {
      if (intent === "approve") await api.approveDispatch(d.id);
      else await api.rejectDispatch(d.id);
      setNotice({
        error: false,
        text: `${d.id} ${intent === "approve" ? "approved" : "rejected"} // dispatch log updated`,
      });
      setDispatchFocus(null);
      dispatches.refresh();
      onChanged?.();
    } catch (e) {
      setNotice({
        error: true,
        text: `${d.id} // decision failed — ${
          e instanceof Error ? e.message : "backend unreachable"
        }`,
      });
    } finally {
      setActing(false);
    }
  }

  const allDispatches = dispatches.data ?? [];
  const pendingDispatches = allDispatches.filter((d) => d.status === "pending");
  const decidedDispatches = allDispatches
    .filter((d) => d.status !== "pending")
    .sort(
      (a, b) =>
        Date.parse(b.decided_at ?? b.created_at) -
        Date.parse(a.decided_at ?? a.created_at),
    )
    .slice(0, DECIDED_SHOWN);

  return (
    <>
      <Panel
        title="Pending approvals"
        led={pendingDispatches.length > 0 ? "pulse" : "off"}
        right={`${pendingDispatches.length} queued`}
        bodyClassName="space-y-4"
        className={className}
      >
        {notice && (
          <Alert tone={notice.error ? "critical" : "ok"}>{notice.text}</Alert>
        )}
        {dispatches.data === null && dispatches.loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : pendingDispatches.length === 0 ? (
          <PanelEmpty text="Queue clear — no proposals awaiting operator" />
        ) : (
          <div className="divide-y divide-flame/10">
            {pendingDispatches.map((d) => {
              const tone = d.incident_priority
                ? statusTone(d.incident_priority)
                : "plain";
              const ClassIcon =
                CLASSIFICATION_ICONS[
                  classificationKey(d.incident_classification ?? "")
                ];
              const selectIncident = () => {
                if (d.incident_id) onSelectIncident?.(d.incident_id);
              };
              return (
                <div key={d.id} className="flex items-stretch">
                  <span
                    aria-hidden
                    className={cn("w-1 shrink-0", PROPOSAL_RAIL[tone])}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={selectIncident}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectIncident();
                      }
                    }}
                    className="min-w-0 flex-1 cursor-pointer px-3.5 py-3 transition-colors hover:bg-wine/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-flame/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ClassIcon
                          aria-hidden
                          strokeWidth={1.75}
                          className="h-5 w-5 shrink-0 text-flame"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-display text-xs font-bold uppercase tracking-[0.12em] text-bone">
                            {d.incident_classification ?? d.incident_id}
                          </div>
                          <div className="truncate font-mono text-[9px] tracking-[0.15em] text-bone/55">
                            {d.incident_address ?? d.incident_id}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        {d.incident_priority && (
                          <PriorityMark priority={d.incident_priority} />
                        )}
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                          {fmtAgo(d.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <Manifest icon={Truck} items={d.vehicle_ids} compact />
                      <Manifest icon={Users} items={d.personnel_ids} compact />
                      <Manifest icon={Package} items={d.equipment_ids} compact />
                    </div>

                    {d.notes && (
                      <p className="mt-2 truncate border-l-2 border-blaze/40 pl-2 text-[10px] leading-relaxed text-bone/60">
                        {d.notes}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDispatchFocus(d);
                        }}
                      >
                        Detail
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={acting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void decide(d, "reject");
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={acting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void decide(d, "approve");
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {dispatches.data !== null && (
          <>
            <Divider label="decided" className="pt-1" />
            {decidedDispatches.length === 0 ? (
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                No decisions on record
              </div>
            ) : (
              <div className="divide-y divide-ash/10">
                {decidedDispatches.map((d) => {
                  const DecideIcon =
                    DISPATCH_ICONS[d.status] ?? DISPATCH_ICON_FALLBACK;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2.5 px-1 py-2"
                    >
                      <DecideIcon
                        aria-hidden
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          DECIDE_ICON_CLS[d.status],
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">
                        {d.id} — {d.incident_classification ?? d.incident_id}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
                        {d.decided_at
                          ? `${fmtClock(d.decided_at)} · ${fmtAgo(d.decided_at)}`
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Panel>

      {/* dispatch detail + confirm */}
      <Modal
        open={dispatchFocus !== null}
        onClose={() => {
          if (!acting) setDispatchFocus(null);
        }}
        title={dispatchFocus ? `Dispatch ${dispatchFocus.id}` : undefined}
        led="blaze"
        footer={
          dispatchFocus ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={acting}
                onClick={() => setDispatchFocus(null)}
              >
                Abort
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={acting}
                onClick={() => void decide(dispatchFocus, "reject")}
              >
                Reject
              </Button>
              <Button
                variant="solid"
                size="sm"
                disabled={acting}
                onClick={() => void decide(dispatchFocus, "approve")}
              >
                Approve dispatch
              </Button>
            </>
          ) : undefined
        }
      >
        {dispatchFocus && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  dispatchFocus.incident_priority
                    ? statusTone(dispatchFocus.incident_priority)
                    : "plain"
                }
              >
                {dispatchFocus.incident_priority ?? "P?"}
              </Badge>
              <Badge tone="warm">pending</Badge>
              <Badge tone="dead">by {dispatchFocus.proposed_by}</Badge>
            </div>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone">
                {dispatchFocus.incident_classification ??
                  dispatchFocus.incident_id}
              </div>
              <div className="font-mono text-[11px] tracking-wider text-bone/70">
                {dispatchFocus.incident_address ?? dispatchFocus.incident_id}
              </div>
            </div>
            <div className="space-y-2">
              <Manifest
                icon={Truck}
                items={dispatchFocus.vehicle_ids}
                max={8}
              />
              <Manifest
                icon={Users}
                items={dispatchFocus.personnel_ids}
                max={8}
              />
              <Manifest
                icon={Package}
                items={dispatchFocus.equipment_ids}
                max={8}
              />
            </div>
            {dispatchFocus.notes && (
              <p className="border-l-2 border-blaze/40 pl-3 text-xs leading-relaxed text-bone/75">
                {dispatchFocus.notes}
              </p>
            )}
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">
              proposed {fmtAgo(dispatchFocus.created_at)} {"//"} incident{" "}
              {dispatchFocus.incident_id}
            </div>
            <Divider label="operator approval required" />
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ash">
              Agent-proposed dispatch holds until an operator confirms. Approve
              commits listed units and marks them dispatched; reject returns the
              plan to the agent.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
