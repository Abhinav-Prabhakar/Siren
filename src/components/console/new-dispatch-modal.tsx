"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import {
  api,
  type Dispatch,
  type Equipment,
  type Incident,
  type Personnel,
  type Vehicle,
} from "@/lib/api";

interface Resources {
  incidents: Incident[];
  vehicles: Vehicle[];
  personnel: Personnel[];
  equipment: Equipment[];
}

type FeedName = keyof Resources;

/** A dispatch may reinforce any live incident — resolved ones are closed. */
const DISPATCHABLE = new Set(["active", "contained", "monitoring"]);

export interface NewDispatchModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired after the backend commits the operator dispatch (auto-approved). */
  onCreated: (dispatch: Dispatch) => void;
}

function toggleId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function PickList({
  title,
  count,
  failed,
  children,
}: {
  title: string;
  count: number;
  /** Feed for this list is down — show that instead of an empty list. */
  failed?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-ash">
        <span>{title}</span>
        <span>{count} picked</span>
      </div>
      <div className="max-h-32 space-y-1.5 overflow-y-auto border border-ash/15 bg-ink/60 px-3 py-2.5">
        {failed ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-flame">
            Feed down — list unavailable
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Operator takeover — build a dispatch by hand against live availability.
 * Server-side these are `proposed_by='operator'` and commit immediately.
 */
export function NewDispatchModal({
  open,
  onClose,
  onCreated,
}: NewDispatchModalProps) {
  const [res, setRes] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedErrors, setFeedErrors] = useState<
    Partial<Record<FeedName, string>>
  >({});
  const [attempt, setAttempt] = useState(0);

  const [incidentId, setIncidentId] = useState("");
  const [vehicleIds, setVehicleIds] = useState<Set<string>>(new Set());
  const [personnelIds, setPersonnelIds] = useState<Set<string>>(new Set());
  const [equipmentIds, setEquipmentIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* reset the form each time the console opens (render-adjust pattern) */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRes(null);
      setLoading(true);
      setLoadError(null);
      setFeedErrors({});
      setSubmitError(null);
      setIncidentId("");
      setVehicleIds(new Set());
      setPersonnelIds(new Set());
      setEquipmentIds(new Set());
      setNotes("");
      setDeploying(false);
    }
  }

  /* fetch live availability every time the console opens — feeds resolve
     independently so one dead endpoint can't kill the whole dialog */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.allSettled([
      api.incidents(),
      api.vehicles(),
      api.personnel("on_duty"),
      api.equipment(undefined, "ready"),
    ]).then((results) => {
      if (cancelled) return;
      const names: FeedName[] = [
        "incidents",
        "vehicles",
        "personnel",
        "equipment",
      ];
      const errors: Partial<Record<FeedName, string>> = {};
      const list = <T,>(r: PromiseSettledResult<T[]>, name: FeedName): T[] => {
        if (r.status === "fulfilled") return r.value;
        errors[name] =
          r.reason instanceof Error ? r.reason.message : "fetch failed";
        return [];
      };
      const incidents = list<Incident>(results[0], "incidents");
      const vehicles = list<Vehicle>(results[1], "vehicles");
      const personnel = list<Personnel>(results[2], "personnel");
      const equipment = list<Equipment>(results[3], "equipment");
      if (names.every((n) => errors[n] !== undefined)) {
        /* every feed down — backend unreachable, nothing to build a
           dispatch from */
        setRes(null);
        setLoadError(
          errors.incidents ?? "availability fetch failed",
        );
      } else {
        setRes({
          incidents: incidents.filter((i) => DISPATCHABLE.has(i.status)),
          vehicles: vehicles.filter((v) => v.status === "available"),
          personnel,
          equipment,
        });
        setFeedErrors(errors);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const selectedCount = vehicleIds.size + personnelIds.size + equipmentIds.size;
  const canDeploy = incidentId !== "" && selectedCount > 0 && !deploying;

  async function deploy() {
    if (!canDeploy) return;
    setDeploying(true);
    setSubmitError(null);
    let d: Dispatch;
    try {
      d = await api.createDispatch({
        incident_id: incidentId,
        vehicle_ids: [...vehicleIds],
        personnel_ids: [...personnelIds],
        equipment_ids: [...equipmentIds],
        notes: notes.trim() || undefined,
      });
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "dispatch rejected by backend",
      );
      setDeploying(false);
      return;
    }
    setDeploying(false);
    /* the dispatch is committed — a failure downstream must not be
       reported as a refusal */
    try {
      onCreated(d);
    } catch {
      setSubmitError(
        `${d.id} committed and approved — but the console refresh failed; ` +
          "the dispatch is live in the log.",
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!deploying) onClose();
      }}
      title="Manual dispatch // operator takeover"
      led="flame"
      className="max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={deploying}
            onClick={onClose}
          >
            Abort
          </Button>
          <Button
            variant="solid"
            size="sm"
            led="pulse"
            disabled={!canDeploy}
            onClick={() => void deploy()}
          >
            Deploy{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <Alert tone="critical" title="Dispatch refused">
            {submitError}
          </Alert>
        )}

        {Object.keys(feedErrors).length > 0 && (
          <Alert tone="warning" title="Partial uplink failure">
            {Object.keys(feedErrors).join(", ")} feed(s) down —{" "}
            {Object.values(feedErrors)[0]}. Lists that loaded are live; a
            dispatch still requires an incident pick.{" "}
            <button
              type="button"
              className="cursor-pointer underline decoration-flame/60 underline-offset-2 hover:text-blaze"
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Retry fetch
            </button>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : loadError !== null ? (
          <Alert tone="critical" title="Availability uplink failed">
            {loadError} — resource lists could not be loaded.{" "}
            <button
              type="button"
              className="cursor-pointer underline decoration-flame/60 underline-offset-2 hover:text-blaze"
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Retry fetch
            </button>
          </Alert>
        ) : res === null ? null : (
          <>
            {feedErrors.incidents !== undefined ? (
              <Alert tone="critical" title="Incident feed down">
                {feedErrors.incidents} — DEPLOY stays disarmed until the
                incident list loads; there is nothing to target without it.
              </Alert>
            ) : res.incidents.length === 0 ? (
              <Alert tone="warning" title="No live incidents">
                Nothing active, contained or monitoring on the board to
                dispatch against — stand down.
              </Alert>
            ) : (
              <Select
                label="Target incident"
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
              >
                <option value="">— select live incident —</option>
                {res.incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} · {i.status} — {i.classification}
                  </option>
                ))}
              </Select>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PickList
                title="Units available"
                count={vehicleIds.size}
                failed={feedErrors.vehicles !== undefined}
              >
                {res.vehicles.length === 0 ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                    No units available
                  </span>
                ) : (
                  res.vehicles.map((v) => (
                    <div key={v.id}>
                      <Checkbox
                        label={`${v.callsign} · ${v.status}`}
                        checked={vehicleIds.has(v.id)}
                        onCheckedChange={() =>
                          setVehicleIds((s) => toggleId(s, v.id))
                        }
                      />
                    </div>
                  ))
                )}
              </PickList>

              <PickList
                title="Crew on duty"
                count={personnelIds.size}
                failed={feedErrors.personnel !== undefined}
              >
                {res.personnel.length === 0 ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                    No crew on duty
                  </span>
                ) : (
                  res.personnel.map((p) => (
                    <div key={p.id}>
                      <Checkbox
                        label={`${p.name} · ${p.role}`}
                        checked={personnelIds.has(p.id)}
                        onCheckedChange={() =>
                          setPersonnelIds((s) => toggleId(s, p.id))
                        }
                      />
                    </div>
                  ))
                )}
              </PickList>
            </div>

            <PickList
              title="Kit ready"
              count={equipmentIds.size}
              failed={feedErrors.equipment !== undefined}
            >
              {res.equipment.length === 0 ? (
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ash">
                  No kit ready
                </span>
              ) : (
                res.equipment.map((e) => (
                  <div key={e.id}>
                    <Checkbox
                      label={`${e.name} · ${e.category}`}
                      checked={equipmentIds.has(e.id)}
                      onCheckedChange={() =>
                        setEquipmentIds((s) => toggleId(s, e.id))
                      }
                    />
                  </div>
                ))
              )}
            </PickList>

            <Textarea
              label="Dispatch notes"
              placeholder="Staging instructions, hazards, routing…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <Divider label="operator authority" />
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ash">
              Manual dispatch bypasses agent review — DEPLOY commits the listed
              resources and marks them dispatched immediately.
            </p>
            {!canDeploy && !deploying && (
              <p className="border border-ash/15 bg-smoke/40 px-3 py-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.2em] text-blaze">
                Deploy disarmed — needs one live incident plus at least one
                unit, crew member or kit item.
              </p>
            )}
            {deploying && (
              <p className="border border-flame/25 bg-wine/40 px-3 py-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.2em] text-flame">
                Deploying — committing dispatch to the backend…
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
