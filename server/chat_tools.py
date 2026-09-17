"""SIREN-1 tool belt — OpenAI function-calling definitions + DB executors.

Every handler signature: (conn, args: dict) -> (result: dict, summary: str).
`result` is JSON-serialised back to the model as the tool message; `summary`
is a one-line operator-readable record persisted on the assistant chat row
and rendered in the control-room UI.

Human-in-the-loop: propose_dispatch only ever *proposes* (status 'pending',
proposed_by 'agent') — the control-room operator approves it in the UI. The
single exception is night watch: while settings.night_mode is on, proposals
auto-approve via the same apply_approval() path the settings endpoint and the
simulator use. The agent cannot toggle night watch itself — only the operator
controls that switch, so the model can never self-authorise a dispatch.
"""
import json
import re
import sqlite3
from typing import Any, Dict, List, Optional, Tuple

from db import now_iso, rows_dicts
from routers.dispatches import _next_dispatch_id, apply_approval, hydrate_dispatch
from routers.settings import night_mode_on

MAX_LIMIT = 120

_INCIDENT_STATUSES = {"active", "contained", "monitoring", "resolved"}
_PRIORITIES = {"P1", "P2", "P3", "P4"}
_ENTITY_TYPES = {"vehicle", "personnel", "equipment"}
_PERSONNEL_QUIET = {"off_duty", "resting"}

Result = Tuple[Dict[str, Any], str]


def _err(message: str) -> Result:
    """Tool-level failure — sent back to the model so it can recover."""
    return {"error": message}, f"error — {message}"


def _str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _num_or_none(v: Any) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _str_list(v: Any) -> List[str]:
    if not isinstance(v, list):
        return []
    return [str(x).strip() for x in v if str(x).strip()]


def _event(conn, tag: str, message: str, tone: str, ts: str) -> None:
    conn.execute(
        "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
        (ts, tag, message, tone),
    )


def _fetch_by_ids(conn, cols: str, table: str, ids: List[str]):
    """SELECT <cols> FROM <table> WHERE id IN (...) — [] when ids empty."""
    if not ids:
        return []
    q = ",".join("?" * len(ids))
    return conn.execute(
        f"SELECT {cols} FROM {table} WHERE id IN ({q})", ids
    ).fetchall()


# --------------------------------------------------------------------- #
# Action tools — they write real rows
# --------------------------------------------------------------------- #

def propose_dispatch(conn, args) -> Result:
    """Agent-proposed dispatch → pending (or auto-approved under night watch)."""
    incident_id = _str_or_none(args.get("incident_id"))
    vehicle_ids = _str_list(args.get("vehicle_ids"))
    personnel_ids = _str_list(args.get("personnel_ids"))
    equipment_ids = _str_list(args.get("equipment_ids"))
    notes = _str_or_none(args.get("notes"))

    if not incident_id:
        return _err("incident_id is required")
    inc = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    if inc is None:
        return _err(f"incident {incident_id} not found")
    if inc["status"] == "resolved":
        return _err(f"incident {incident_id} is resolved — dispatch refused")
    if not (vehicle_ids or personnel_ids or equipment_ids):
        return _err(
            "dispatch must assign at least one vehicle, person or equipment item"
        )

    missing = []
    for table, ids in (
        ("vehicles", vehicle_ids),
        ("personnel", personnel_ids),
        ("equipment", equipment_ids),
    ):
        for rid in ids:
            row = conn.execute(
                f"SELECT id FROM {table} WHERE id = ?", (rid,)
            ).fetchone()
            if row is None:
                missing.append(rid)
    if missing:
        return _err("unknown resource id(s): " + ", ".join(missing))

    # Soft warnings — resources exist but aren't in the expected state.
    warnings = []
    for r in _fetch_by_ids(conn, "id,callsign,status", "vehicles", vehicle_ids):
        if r["status"] != "available":
            warnings.append(
                f"{r['id']} ({r['callsign']}) is {r['status']}, not available")
    for r in _fetch_by_ids(conn, "id,name,status", "personnel", personnel_ids):
        if r["status"] != "on_duty":
            warnings.append(
                f"{r['id']} ({r['name']}) is {r['status']}, not on_duty")
    for r in _fetch_by_ids(conn, "id,name,status", "equipment", equipment_ids):
        if r["status"] != "ready":
            warnings.append(
                f"{r['id']} ({r['name']}) is {r['status']}, not ready")

    now = now_iso()
    dispatch_id = None
    for _ in range(5):  # retry DSP-### allocation on PK collision
        candidate = _next_dispatch_id(conn)
        try:
            conn.execute(
                """INSERT INTO dispatches(id,incident_id,status,proposed_by,notes,
                   created_at,decided_at) VALUES(?,?,?,?,?,?,?)""",
                (candidate, incident_id, "pending", "agent", notes, now, None),
            )
            dispatch_id = candidate
            break
        except sqlite3.IntegrityError:
            continue
    if dispatch_id is None:
        return _err("could not allocate a dispatch id")

    conn.executemany(
        "INSERT INTO dispatch_vehicles(dispatch_id,vehicle_id) VALUES(?,?)",
        [(dispatch_id, vid) for vid in vehicle_ids],
    )
    conn.executemany(
        "INSERT INTO dispatch_personnel(dispatch_id,personnel_id) VALUES(?,?)",
        [(dispatch_id, pid) for pid in personnel_ids],
    )
    conn.executemany(
        "INSERT INTO dispatch_equipment(dispatch_id,equipment_id) VALUES(?,?)",
        [(dispatch_id, eid) for eid in equipment_ids],
    )

    auto_approved = False
    if night_mode_on(conn):
        d = conn.execute(
            "SELECT * FROM dispatches WHERE id = ?", (dispatch_id,)
        ).fetchone()
        apply_approval(
            conn, d, tag="NIGHT",
            message=(f"{dispatch_id} auto-approved — night mode engaged, "
                     f"units rolling to {incident_id}."),
        )
        auto_approved = True
    else:
        _event(
            conn, "DISPATCH",
            (f"Agent proposed {dispatch_id}: {len(vehicle_ids)} vehicle(s), "
             f"{len(personnel_ids)} crew, {len(equipment_ids)} kit to "
             f"{incident_id} — awaiting operator approval."),
            "bone", now,
        )

    d = hydrate_dispatch(
        conn,
        conn.execute(
            "SELECT * FROM dispatches WHERE id = ?", (dispatch_id,)
        ).fetchone(),
    )
    result: Dict[str, Any] = {
        "dispatch": d,
        "auto_approved": auto_approved,
        "awaiting_operator": not auto_approved,
    }
    if warnings:
        result["warnings"] = warnings
    state = "auto-approved (night watch)" if auto_approved else "pending operator approval"
    summary = (
        f"{dispatch_id} → {incident_id} {state} — "
        f"{len(vehicle_ids)}u/{len(personnel_ids)}c/{len(equipment_ids)}k"
    )
    return result, summary


def _next_incident_id(conn) -> str:
    """Next INC-### id — matches 3-7 digit suffixes only, so Vapi's
    INC-<8 hex> ids never inflate the sequence."""
    best = 0
    for r in conn.execute("SELECT id FROM incidents").fetchall():
        rid = r["id"] or ""
        m = re.fullmatch(r"INC-(\d{3,7})", rid)
        if m:
            best = max(best, int(m.group(1)))
    return f"INC-{best + 1:03d}"


def create_incident(conn, args) -> Result:
    classification = _str_or_none(args.get("classification"))
    priority = (str(args.get("priority") or "P3").strip().upper())
    address = _str_or_none(args.get("address"))
    notes = _str_or_none(args.get("notes"))

    if not classification:
        return _err("classification is required")
    if not address:
        return _err("address is required")
    if priority not in _PRIORITIES:
        return _err(f"priority must be one of {sorted(_PRIORITIES)}")

    now = now_iso()
    incident_id = None
    for _ in range(5):
        candidate = _next_incident_id(conn)
        try:
            conn.execute(
                """INSERT INTO incidents(id,classification,priority,status,address,
                   lat,lng,reported_at,resolved_at,wind,wind_dir,temp_c,
                   humidity_pct,precip,notes,external_contacts)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    candidate, classification, priority, "active", address,
                    _num_or_none(args.get("lat")), _num_or_none(args.get("lng")),
                    now, None,
                    _str_or_none(args.get("wind")),
                    _str_or_none(args.get("wind_dir")),
                    _num_or_none(args.get("temp_c")),
                    _num_or_none(args.get("humidity_pct")),
                    _str_or_none(args.get("precip")),
                    notes, "[]",
                ),
            )
            incident_id = candidate
            break
        except sqlite3.IntegrityError:
            continue
    if incident_id is None:
        return _err("could not allocate an incident id")

    _event(
        conn, "INCIDENT",
        (f"{incident_id} opened by SIREN-1: {priority} {classification} "
         f"@ {address}."),
        "flame", now,
    )
    return (
        {"incident_id": incident_id, "status": "active", "priority": priority},
        f"{incident_id} opened — {priority} {classification} @ {address}",
    )


def update_incident(conn, args) -> Result:
    incident_id = _str_or_none(args.get("incident_id"))
    if not incident_id:
        return _err("incident_id is required")
    inc = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    if inc is None:
        return _err(f"incident {incident_id} not found")

    sets: List[str] = []
    params: List[Any] = []
    changes: List[str] = []

    status = _str_or_none(args.get("status"))
    if status is not None:
        status = status.lower()
        if status not in _INCIDENT_STATUSES:
            return _err(f"status must be one of {sorted(_INCIDENT_STATUSES)}")
        sets.append("status = ?")
        params.append(status)
        changes.append(f"status→{status}")
        if status == "resolved" and inc["status"] != "resolved":
            sets.append("resolved_at = ?")
            params.append(now_iso())
        elif status != "resolved":
            sets.append("resolved_at = NULL")

    priority = _str_or_none(args.get("priority"))
    if priority is not None:
        priority = priority.upper()
        if priority not in _PRIORITIES:
            return _err(f"priority must be one of {sorted(_PRIORITIES)}")
        sets.append("priority = ?")
        params.append(priority)
        changes.append(f"priority→{priority}")

    for col in ("classification", "address", "notes"):
        v = args.get(col)
        if v is not None:
            sets.append(f"{col} = ?")
            params.append(_str_or_none(v))
            changes.append(f"{col} updated")

    if not sets:
        return _err("nothing to update — pass status, priority, "
                    "classification, address or notes")

    params.append(incident_id)
    conn.execute(
        f"UPDATE incidents SET {', '.join(sets)} WHERE id = ?", params
    )

    released = 0
    if status == "resolved" and inc["status"] != "resolved":
        # Same release path the simulator uses when an incident resolves.
        released = conn.execute(
            """UPDATE vehicles SET status='returning', updated_at=?
               WHERE incident_id = ? AND status != 'available'""",
            (now_iso(), incident_id),
        ).rowcount
        # Crew not riding a vehicle stand down directly.
        conn.execute(
            """UPDATE personnel SET status='on_duty', incident_id=NULL,
               updated_at=? WHERE incident_id = ? AND vehicle_id IS NULL
               AND status NOT IN ('off_duty','resting')""",
            (now_iso(), incident_id),
        )
        for veh in conn.execute(
            "SELECT name FROM vehicles WHERE incident_id = ? AND status = 'returning'",
            (incident_id,),
        ).fetchall():
            _event(conn, "UNIT",
                   f"{veh['name']} released from {incident_id} — "
                   f"returning to quarters.", "ash", now_iso())

    _event(
        conn, "INC",
        f"{incident_id} updated by SIREN-1 — {', '.join(changes)}.",
        "bone", now_iso(),
    )
    extra = f", {released} unit(s) released" if released else ""
    return (
        {"incident_id": incident_id, "changes": changes,
         "units_released": released},
        f"{incident_id} updated — {', '.join(changes)}{extra}",
    )


def contact_external_service(conn, args) -> Result:
    """Mirror POST /api/incidents/{id}/contact — append {service, ts}."""
    incident_id = _str_or_none(args.get("incident_id"))
    service = _str_or_none(args.get("service"))
    if not incident_id:
        return _err("incident_id is required")
    if not service:
        return _err("service is required (ems|police|utility|gas|other)")

    inc = conn.execute(
        "SELECT external_contacts FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    if inc is None:
        return _err(f"incident {incident_id} not found")

    try:
        contacts = json.loads(inc["external_contacts"]) \
            if inc["external_contacts"] else []
        if not isinstance(contacts, list):
            contacts = []
    except (TypeError, json.JSONDecodeError):
        contacts = []

    now = now_iso()
    contacts.append({"service": service, "ts": now})
    conn.execute(
        "UPDATE incidents SET external_contacts = ? WHERE id = ?",
        (json.dumps(contacts), incident_id),
    )
    _event(
        conn, "EXT",
        f"{incident_id}: external contact notified — {service}.",
        "bone", now,
    )
    return (
        {"incident_id": incident_id, "external_contacts": contacts},
        f"{service} notified on {incident_id}",
    )


# --------------------------------------------------------------------- #
# Query tools — read-only
# --------------------------------------------------------------------- #

def _clamp_limit(v: Any, default: int, cap: int = MAX_LIMIT) -> int:
    n = _num_or_none(v)
    if n is None:
        return default
    return max(1, min(int(n), cap))


def get_fleet_status(conn, args) -> Result:
    status = _str_or_none(args.get("status"))
    if status:
        rows = rows_dicts(conn.execute(
            """SELECT id,name,callsign,type,status,fuel_pct,water_pct,
                      incident_id,free_at FROM vehicles
               WHERE status = ? ORDER BY id""", (status,),
        ).fetchall())
    else:
        rows = rows_dicts(conn.execute(
            """SELECT id,name,callsign,type,status,fuel_pct,water_pct,
                      incident_id,free_at FROM vehicles ORDER BY id"""
        ).fetchall())
    by_status: Dict[str, int] = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    return (
        {"count": len(rows), "by_status": by_status, "vehicles": rows},
        f"{len(rows)} unit(s) returned"
        + (f" (status={status})" if status else ""),
    )


def get_personnel(conn, args) -> Result:
    status = _str_or_none(args.get("status"))
    base = """SELECT id,name,role,rank,status,vehicle_id,incident_id,
                     heart_rate,scba_pct FROM personnel"""
    if status:
        rows = rows_dicts(conn.execute(
            base + " WHERE status = ? ORDER BY id", (status,),
        ).fetchall())
    else:
        rows = rows_dicts(conn.execute(base + " ORDER BY id").fetchall())
    return (
        {"count": len(rows), "personnel": rows},
        f"{len(rows)} crew record(s) returned"
        + (f" (status={status})" if status else ""),
    )


def get_incidents(conn, args) -> Result:
    status = _str_or_none(args.get("status"))
    base = "SELECT * FROM incidents"
    if status:
        rows = conn.execute(
            base + " WHERE status = ? ORDER BY reported_at DESC", (status,),
        ).fetchall()
    else:
        rows = conn.execute(
            base + " ORDER BY reported_at DESC").fetchall()
    out = []
    for r in rows:
        inc = dict(r)
        try:
            parsed = json.loads(inc["external_contacts"]) \
                if inc.get("external_contacts") else []
            inc["external_contacts"] = parsed if isinstance(parsed, list) else []
        except (TypeError, json.JSONDecodeError):
            inc["external_contacts"] = []
        inc["unit_count"] = conn.execute(
            "SELECT COUNT(*) AS c FROM vehicles WHERE incident_id = ?",
            (inc["id"],),
        ).fetchone()["c"]
        inc["call_count"] = conn.execute(
            "SELECT COUNT(*) AS c FROM calls WHERE incident_id = ?",
            (inc["id"],),
        ).fetchone()["c"]
        out.append(inc)
    return (
        {"count": len(out), "incidents": out},
        f"{len(out)} incident(s) returned"
        + (f" (status={status})" if status else ""),
    )


def get_equipment(conn, args) -> Result:
    status = _str_or_none(args.get("status"))
    flagged = bool(args.get("flagged"))
    base = """SELECT id,name,category,status,battery_pct,condition_pct,
                     vehicle_id FROM equipment"""
    if flagged:
        rows = rows_dicts(conn.execute(
            base + """ WHERE status IN ('maintenance','missing')
                        OR (battery_pct IS NOT NULL AND battery_pct <= 25)
                        OR condition_pct <= 60 ORDER BY id"""
        ).fetchall())
    elif status:
        rows = rows_dicts(conn.execute(
            base + " WHERE status = ? ORDER BY id", (status,),
        ).fetchall())
    else:
        rows = rows_dicts(conn.execute(base + " ORDER BY id").fetchall())
    return (
        {"count": len(rows), "equipment": rows},
        f"{len(rows)} kit item(s) returned"
        + (" (flagged)" if flagged else
           f" (status={status})" if status else ""),
    )


def get_dispatches(conn, args) -> Result:
    status = _str_or_none(args.get("status"))
    if status:
        rows = conn.execute(
            "SELECT * FROM dispatches WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM dispatches ORDER BY created_at DESC").fetchall()
    out = [hydrate_dispatch(conn, d) for d in rows]
    return (
        {"count": len(out), "dispatches": out},
        f"{len(out)} dispatch(es) returned"
        + (f" (status={status})" if status else ""),
    )


def get_telemetry(conn, args) -> Result:
    entity_type = _str_or_none(args.get("entity_type"))
    entity_id = _str_or_none(args.get("entity_id"))
    metric = _str_or_none(args.get("metric"))
    limit = _clamp_limit(args.get("limit"), 30)

    if entity_type not in _ENTITY_TYPES:
        return _err(f"entity_type must be one of {sorted(_ENTITY_TYPES)}")
    if not entity_id:
        return _err("entity_id is required")

    if metric:
        rows = conn.execute(
            """SELECT metric,value,ts FROM telemetry
               WHERE entity_type = ? AND entity_id = ? AND metric = ?
               ORDER BY id DESC LIMIT ?""",
            (entity_type, entity_id, metric, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT metric,value,ts FROM telemetry
               WHERE entity_type = ? AND entity_id = ?
               ORDER BY id DESC LIMIT ?""",
            (entity_type, entity_id, limit),
        ).fetchall()
    points = [dict(r) for r in reversed(rows)]
    return (
        {"entity_type": entity_type, "entity_id": entity_id,
         "count": len(points), "points": points},
        f"{len(points)} telemetry point(s) for {entity_id}",
    )


def get_events(conn, args) -> Result:
    limit = _clamp_limit(args.get("limit"), 20, cap=50)
    tag = _str_or_none(args.get("tag"))
    if tag:
        rows = conn.execute(
            "SELECT * FROM events WHERE tag = ? ORDER BY id DESC LIMIT ?",
            (tag.upper(), limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,),
        ).fetchall()
    events = [dict(r) for r in reversed(rows)]  # chronological
    return (
        {"count": len(events), "events": events},
        f"{len(events)} event(s) returned"
        + (f" (tag={tag.upper()})" if tag else ""),
    )


# --------------------------------------------------------------------- #
# Dispatch table
# --------------------------------------------------------------------- #

HANDLERS = {
    "propose_dispatch": propose_dispatch,
    "create_incident": create_incident,
    "update_incident": update_incident,
    "contact_external_service": contact_external_service,
    "get_fleet_status": get_fleet_status,
    "get_personnel": get_personnel,
    "get_incidents": get_incidents,
    "get_equipment": get_equipment,
    "get_dispatches": get_dispatches,
    "get_telemetry": get_telemetry,
    "get_events": get_events,
}


def execute_tool(conn, name: str, args: Dict[str, Any]) -> Result:
    """Run one tool call against the DB. Commits on success; rolls back and
    reports the failure to the model on error — tool results are never faked."""
    fn = HANDLERS.get(name)
    if fn is None:
        return _err(f"unknown tool '{name}'")
    try:
        result, summary = fn(conn, args or {})
        conn.commit()
        return result, summary
    except Exception as exc:  # report, don't crash the agent loop
        conn.rollback()
        return _err(f"{type(exc).__name__}: {exc}")


# --------------------------------------------------------------------- #
# OpenAI tool schemas
# --------------------------------------------------------------------- #

_ID_DESC = "exact DB id from the snapshot/query tools (e.g. VEH-03, PER-08, EQ-12)"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "propose_dispatch",
            "description": (
                "Propose a dispatch of vehicles/crew/equipment to an incident. "
                "Creates a PENDING dispatch — the control-room operator must "
                "approve it before units roll. Under night watch it "
                "auto-approves immediately. This is the ONLY way you move "
                "resources; you can never dispatch directly."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {
                        "type": "string",
                        "description": "target incident id (e.g. INC-001)",
                    },
                    "vehicle_ids": {
                        "type": "array", "items": {"type": "string"},
                        "description": f"vehicle ids to assign — {_ID_DESC}",
                    },
                    "personnel_ids": {
                        "type": "array", "items": {"type": "string"},
                        "description": f"personnel ids to assign — {_ID_DESC}",
                    },
                    "equipment_ids": {
                        "type": "array", "items": {"type": "string"},
                        "description": f"equipment ids to assign — {_ID_DESC}",
                    },
                    "notes": {
                        "type": "string",
                        "description": "tactical rationale shown to the operator",
                    },
                },
                "required": ["incident_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_incident",
            "description": (
                "Open a new incident (status active) from operator-reported "
                "intel. Returns the new INC-### id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "classification": {
                        "type": "string",
                        "description": "e.g. 'Structure Fire — Residential'",
                    },
                    "priority": {
                        "type": "string", "enum": ["P1", "P2", "P3", "P4"],
                        "description": "P1 = most severe",
                    },
                    "address": {"type": "string"},
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "notes": {"type": "string"},
                    "wind": {"type": "string", "description": "e.g. '18 km/h'"},
                    "wind_dir": {"type": "string", "description": "e.g. 'NW'"},
                    "temp_c": {"type": "number"},
                    "humidity_pct": {"type": "number"},
                    "precip": {"type": "string", "description": "e.g. 'none', 'rain'"},
                },
                "required": ["classification", "priority", "address"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_incident",
            "description": (
                "Update an incident's status (active|contained|monitoring|"
                "resolved), priority, classification, address or notes. "
                "Marking resolved releases assigned units."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["active", "contained", "monitoring", "resolved"],
                    },
                    "priority": {
                        "type": "string", "enum": ["P1", "P2", "P3", "P4"],
                    },
                    "classification": {"type": "string"},
                    "address": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["incident_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contact_external_service",
            "description": (
                "Log that an external agency (ems|police|utility|gas|other) "
                "was notified about an incident. Siren does not monitor "
                "external services — this only records the contact."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {"type": "string"},
                    "service": {"type": "string"},
                },
                "required": ["incident_id", "service"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fleet_status",
            "description": "List vehicles with callsign, type, status, fuel/water "
                           "and current incident assignment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "optional filter: available|dispatched|"
                                       "en_route|on_scene|returning|refuel|"
                                       "out_of_service",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_personnel",
            "description": "List personnel with role, rank, status, vitals "
                           "(heart_rate, scba_pct) and assignments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "optional filter: on_duty|dispatched|"
                                       "en_route|on_scene|resting|off_duty",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_incidents",
            "description": "List incidents with status, priority, address, "
                           "weather, notes, unit/call counts and external "
                           "contacts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "optional filter: active|contained|"
                                       "monitoring|resolved",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_equipment",
            "description": "List equipment with category, status, battery and "
                           "condition. flagged=true returns only items needing "
                           "attention (maintenance|missing|low battery|worn).",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "optional filter: ready|in_use|"
                                       "maintenance|missing",
                    },
                    "flagged": {
                        "type": "boolean",
                        "description": "only items needing attention",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dispatches",
            "description": "List dispatches with assigned resource ids and "
                           "incident context. status filter: pending|approved|"
                           "rejected|completed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_telemetry",
            "description": "Recent telemetry points for one entity — fuel_pct, "
                           "water_pct, battery_v, speed_kmh (vehicle); "
                           "heart_rate, scba_pct (personnel); battery_pct "
                           "(equipment).",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_type": {
                        "type": "string",
                        "enum": ["vehicle", "personnel", "equipment"],
                    },
                    "entity_id": {"type": "string"},
                    "metric": {"type": "string", "description": "optional"},
                    "limit": {"type": "integer", "description": "default 30, max 120"},
                },
                "required": ["entity_type", "entity_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_events",
            "description": "Recent ops-feed events (dispatches, unit moves, "
                           "incident lifecycle, calls, night-watch actions).",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "default 20, max 50"},
                    "tag": {
                        "type": "string",
                        "description": "optional filter e.g. UNIT|INC|DISPATCH|"
                                       "CALL|NIGHT|EXT|OPS",
                    },
                },
            },
        },
    },
]
