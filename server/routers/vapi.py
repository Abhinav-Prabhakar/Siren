"""SIREN — Vapi voice-agent webhook router.

Receives Vapi "server messages" at POST /api/vapi/webhook and persists the
call lifecycle into the `calls` table (keyed by `vapi_call_id`), upserts
`incidents`, and creates *pending* `dispatches` proposed by the agent — a
human operator always approves/rejects; nothing is ever auto-dispatched.

Handled message types (https://docs.vapi.ai/server-url/events):
  - assistant-request      -> returns a transient assistant (server/vapi/assistant.json)
  - tool-calls             -> create_incident / update_incident / dispatch_units
  - function-call          -> legacy single-function variant of tool-calls
  - transcript             -> appends final transcripts to calls.transcript
  - status-update          -> marks call started/ended, live flag
  - end-of-call-report     -> transcript, summary, duration, extracted intel
  - hang                   -> logged as an event
  - everything else        -> acknowledged with 200 {}

Auth: if env VAPI_WEBHOOK_SECRET is set, requests must carry it either as the
legacy `x-vapi-secret` header (assistant.serverUrlSecret) or as
`Authorization: Bearer <secret>` (Custom Credential on server.credentialId).

DB access follows the backend's stdlib pattern: sqlite3.connect against
server/siren.db, opened per request, row_factory=sqlite3.Row. Tables are
created defensively (CREATE TABLE IF NOT EXISTS, PLAN.md schema) so this
module works even if imported before seeding runs.
"""

import hmac
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

try:  # load server/.env so VAPI_* config works regardless of import order
    import env
except ImportError:  # imported as server.routers.vapi in some contexts
    from server import env
env.load()

_DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "siren.db")
_ASSISTANT_SPEC = os.path.join(os.path.dirname(__file__), "..", "vapi", "assistant.json")

# PLAN.md schema — defensively created so the webhook works pre-seed.
# vehicles/personnel/equipment are included so dispatch_units auto-proposal
# never hits a missing table even if this module runs before seeding.
_SCHEMA = """
CREATE TABLE IF NOT EXISTS stations(
  id TEXT PRIMARY KEY, name TEXT, code TEXT, address TEXT, lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS vehicles(
  id TEXT PRIMARY KEY, station_id TEXT, name TEXT, callsign TEXT, type TEXT,
  status TEXT, fuel_pct REAL, water_pct REAL, foam_pct REAL, battery_v REAL,
  mileage_km REAL, pump_pressure_bar REAL, lat REAL, lng REAL, speed_kmh REAL,
  incident_id TEXT, free_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS personnel(
  id TEXT PRIMARY KEY, station_id TEXT, name TEXT, role TEXT, rank TEXT,
  status TEXT, vehicle_id TEXT, incident_id TEXT, heart_rate INT, scba_pct REAL,
  lat REAL, lng REAL, shift_start TEXT, shift_end TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS equipment(
  id TEXT PRIMARY KEY, station_id TEXT, vehicle_id TEXT, name TEXT,
  category TEXT, status TEXT, battery_pct REAL, condition_pct REAL,
  serial TEXT, last_check TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS incidents(
  id TEXT PRIMARY KEY,
  classification TEXT,
  priority TEXT,
  status TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  reported_at TEXT,
  resolved_at TEXT,
  wind TEXT,
  wind_dir TEXT,
  temp_c REAL,
  humidity_pct REAL,
  precip TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS calls(
  id TEXT PRIMARY KEY,
  incident_id TEXT,
  vapi_call_id TEXT,
  caller_name TEXT,
  caller_number TEXT,
  started_at TEXT,
  ended_at TEXT,
  duration_s INT,
  transcript TEXT,
  summary TEXT,
  extracted TEXT,
  live INT
);
CREATE TABLE IF NOT EXISTS dispatches(
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id),
  status TEXT,
  proposed_by TEXT,
  notes TEXT,
  created_at TEXT,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS dispatch_vehicles(
  dispatch_id TEXT,
  vehicle_id TEXT
);
CREATE TABLE IF NOT EXISTS dispatch_personnel(
  dispatch_id TEXT,
  personnel_id TEXT
);
CREATE TABLE IF NOT EXISTS dispatch_equipment(
  dispatch_id TEXT,
  equipment_id TEXT
);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  tag TEXT,
  message TEXT,
  tone TEXT
);
"""

# Vehicle types proposed per incident classification when the caller/agent
# does not supply explicit vehicle ids. Everything still lands as
# status='pending' for human approval.
_CLASSIFICATION_UNITS = {
    "structure_fire": ["pumper", "ladder", "command"],
    "wildfire": ["tender", "pumper", "command"],
    "brush_fire": ["tender", "pumper"],
    "mva": ["rescue", "ambulance", "pumper"],
    "vehicle_accident": ["rescue", "ambulance"],
    "medical": ["ambulance", "rescue"],
    "hazmat": ["hazmat", "pumper", "command"],
    "gas_leak": ["hazmat", "pumper"],
    "rescue": ["rescue", "ambulance"],
    "alarm": ["pumper"],
}

_VALID_PRIORITIES = {"P1", "P2", "P3", "P4"}
_VALID_INCIDENT_STATUSES = {"active", "contained", "monitoring", "resolved"}


# --------------------------------------------------------------------------- #
# DB helpers
# --------------------------------------------------------------------------- #

def _connect() -> sqlite3.Connection:
    # SIREN_DB override (test suite) wins; otherwise the real siren.db.
    conn = sqlite3.connect(os.environ.get("SIREN_DB") or _DEFAULT_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def _parse_ts(value: Any) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp (handles trailing Z and epoch ms)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Vapi timestamps are epoch milliseconds.
        return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _log_event(conn: sqlite3.Connection, message: str, tone: str = "bone") -> None:
    conn.execute(
        "INSERT INTO events(ts, tag, message, tone) VALUES (?, 'VAPI', ?, ?)",
        (_utcnow(), message, tone),
    )


def _norm_addr(address: Optional[str]) -> str:
    """Normalize an address for incident grouping: lowercase, strip punctuation."""
    if not address:
        return ""
    s = re.sub(r"[^a-z0-9\s]", " ", address.lower())
    return re.sub(r"\s+", " ", s).strip()


def _classification_key(value: Optional[str]) -> str:
    """Normalize a classification toward the _CLASSIFICATION_UNITS key form."""
    return re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")


def _units_for_classification(classification: Optional[str]) -> list:
    """Vehicle types to propose — exact key match, then contained-key match
    for long-form seeded classifications like 'Structure Fire — Residential'."""
    key = _classification_key(classification)
    if key in _CLASSIFICATION_UNITS:
        return _CLASSIFICATION_UNITS[key]
    for k, units in _CLASSIFICATION_UNITS.items():
        if k in key:
            return units
    return ["pumper", "ambulance"]


def _jsonable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


# --------------------------------------------------------------------------- #
# Call rows
# --------------------------------------------------------------------------- #

def _get_call(conn: sqlite3.Connection, vapi_call_id: str) -> Optional[sqlite3.Row]:
    row = conn.execute(
        "SELECT * FROM calls WHERE vapi_call_id = ?", (vapi_call_id,)
    ).fetchone()
    return row


def _upsert_call(conn: sqlite3.Connection, vapi_call_id: str, **fields) -> sqlite3.Row:
    """Insert or update a calls row keyed by vapi_call_id. Returns the row."""
    if not vapi_call_id:
        raise ValueError("vapi_call_id required")
    row = _get_call(conn, vapi_call_id)
    if row is None:
        conn.execute(
            "INSERT INTO calls(id, vapi_call_id, live, extracted) VALUES (?, ?, 0, '[]')",
            (_new_id("CALL"), vapi_call_id),
        )
        row = _get_call(conn, vapi_call_id)
    if fields:
        cols = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(
            f"UPDATE calls SET {cols} WHERE vapi_call_id = ?",
            (*fields.values(), vapi_call_id),
        )
        row = _get_call(conn, vapi_call_id)
    return row


def _append_extracted(conn: sqlite3.Connection, vapi_call_id: str, entry: dict) -> None:
    row = _get_call(conn, vapi_call_id)
    if row is None:
        return
    try:
        items = json.loads(row["extracted"] or "[]")
        if not isinstance(items, list):
            items = []
    except (json.JSONDecodeError, TypeError):
        items = []
    items.append(entry)
    conn.execute(
        "UPDATE calls SET extracted = ? WHERE vapi_call_id = ?",
        (_jsonable(items), vapi_call_id),
    )


def _append_transcript_line(conn: sqlite3.Connection, vapi_call_id: str, line: str) -> None:
    row = _get_call(conn, vapi_call_id)
    if row is None:
        return
    existing = (row["transcript"] or "").rstrip()
    merged = f"{existing}\n{line}" if existing else line
    conn.execute(
        "UPDATE calls SET transcript = ? WHERE vapi_call_id = ?",
        (merged, vapi_call_id),
    )


def _caller_info(message: dict) -> tuple[Optional[str], Optional[str]]:
    """Best-effort caller name/number from the places Vapi puts them."""
    call = message.get("call") or {}
    customer = call.get("customer") or message.get("customer") or {}
    name = customer.get("name")
    number = (
        customer.get("number")
        or call.get("customer", {}).get("number")
        or (message.get("phoneNumber") or {}).get("number")
    )
    return name, number


# --------------------------------------------------------------------------- #
# Incidents
# --------------------------------------------------------------------------- #

def _find_incident(
    conn: sqlite3.Connection,
    incident_id: Optional[str] = None,
    address: Optional[str] = None,
) -> Optional[sqlite3.Row]:
    """Match an existing incident by explicit id, then normalized address."""
    if incident_id:
        row = conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()
        if row is not None:
            return row
    target = _norm_addr(address)
    if target:
        for row in conn.execute(
            "SELECT * FROM incidents WHERE status != 'resolved' AND address IS NOT NULL"
        ).fetchall():
            if _norm_addr(row["address"]) == target:
                return row
    return None


def _tool_create_incident(conn, call_row, args: dict) -> dict:
    address = (args.get("address") or "").strip() or None
    classification = (args.get("classification") or "other").strip().lower()
    priority = (args.get("priority") or "P2").strip().upper()
    if priority not in _VALID_PRIORITIES:
        priority = "P2"

    # Incident grouping: explicit incident id wins, else normalized address.
    existing = _find_incident(conn, args.get("incident_id"), address)
    if existing is not None:
        if call_row is not None:
            conn.execute(
                "UPDATE calls SET incident_id = ? WHERE vapi_call_id = ?",
                (existing["id"], call_row["vapi_call_id"]),
            )
        _log_event(
            conn,
            f"Call grouped into existing incident {existing['id']} ({existing['classification']})",
            "bone",
        )
        return {
            "incident_id": existing["id"],
            "status": existing["status"],
            "priority": existing["priority"],
            "matched_existing": True,
            "message": "Caller matched to an already-open incident at this address.",
        }

    incident_id = _new_id("INC")
    notes_bits = [args.get("notes") or ""]
    if args.get("hazards"):
        notes_bits.append(f"Hazards: {args['hazards']}")
    if args.get("casualties"):
        notes_bits.append(f"Casualties: {args['casualties']}")
    notes = " | ".join(b for b in notes_bits if b) or None

    conn.execute(
        """INSERT INTO incidents(
             id, classification, priority, status, address, lat, lng,
             reported_at, resolved_at, notes
           ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, ?)""",
        (
            incident_id,
            classification,
            priority,
            address,
            args.get("lat"),
            args.get("lng"),
            _utcnow(),
            notes,
        ),
    )
    if call_row is not None:
        conn.execute(
            "UPDATE calls SET incident_id = ? WHERE vapi_call_id = ?",
            (incident_id, call_row["vapi_call_id"]),
        )
        caller = call_row["caller_number"] or "unknown caller"
        _log_event(
            conn,
            f"Incident {incident_id} created from call ({priority} {classification}"
            + (f" @ {address}" if address else "")
            + f") via {caller}",
            "flame",
        )
    return {
        "incident_id": incident_id,
        "status": "active",
        "priority": priority,
        "classification": classification,
        "matched_existing": False,
        "message": "Incident created and logged. Repeat the incident id back if helpful.",
    }


def _tool_update_incident(conn, call_row, args: dict) -> dict:
    incident = _find_incident(conn, args.get("incident_id"), args.get("address"))
    if incident is None and call_row is not None and call_row["incident_id"]:
        incident = conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (call_row["incident_id"],)
        ).fetchone()
    if incident is None:
        return {
            "error": "No matching incident found. Provide incident_id or a known address, "
                     "or call create_incident first."
        }

    updates: dict[str, Any] = {}
    if args.get("classification"):
        updates["classification"] = str(args["classification"]).strip().lower()
    if args.get("priority"):
        p = str(args["priority"]).strip().upper()
        if p in _VALID_PRIORITIES:
            updates["priority"] = p
    if args.get("status"):
        s = str(args["status"]).strip().lower()
        if s in _VALID_INCIDENT_STATUSES:
            updates["status"] = s
            if s == "resolved":
                updates["resolved_at"] = _utcnow()
    if args.get("address"):
        updates["address"] = str(args["address"]).strip()
    for f in ("wind", "wind_dir", "precip"):
        if args.get(f) is not None:
            updates[f] = args[f]
    for f in ("lat", "lng", "temp_c", "humidity_pct"):
        if args.get(f) is not None:
            try:
                updates[f] = float(args[f])
            except (TypeError, ValueError):
                pass

    note_bits = [b for b in (args.get("notes"), args.get("hazards") and f"Hazards: {args['hazards']}",
                             args.get("casualties") and f"Casualties: {args['casualties']}") if b]
    if note_bits:
        merged = (incident["notes"] or "")
        add = " | ".join(note_bits)
        updates["notes"] = f"{merged} | {add}".strip(" |") if merged else add

    if updates:
        cols = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE incidents SET {cols} WHERE id = ?",
            (*updates.values(), incident["id"]),
        )
    if call_row is not None:
        conn.execute(
            "UPDATE calls SET incident_id = ? WHERE vapi_call_id = ?",
            (incident["id"], call_row["vapi_call_id"]),
        )
    _log_event(conn, f"Incident {incident['id']} updated by voice intake", "bone")
    return {
        "incident_id": incident["id"],
        "updated_fields": sorted(updates.keys()),
        "message": "Incident updated.",
    }


def _tool_dispatch_units(conn, call_row, args: dict) -> dict:
    incident = _find_incident(conn, args.get("incident_id"), args.get("address"))
    if incident is None and call_row is not None and call_row["incident_id"]:
        incident = conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (call_row["incident_id"],)
        ).fetchone()
    if incident is None:
        return {
            "error": "No incident to dispatch against. Create or identify the incident first."
        }

    def _existing_ids(table: str, ids: list) -> list:
        found = []
        for i in ids:
            row = conn.execute(f"SELECT id FROM {table} WHERE id = ?", (i,)).fetchone()
            if row is not None:
                found.append(row["id"])
        return found

    vehicle_ids = _existing_ids("vehicles", [str(v) for v in (args.get("vehicle_ids") or [])])
    personnel_ids = _existing_ids("personnel", [str(p) for p in (args.get("personnel_ids") or [])])
    equipment_ids = _existing_ids("equipment", [str(e) for e in (args.get("equipment_ids") or [])])

    # Auto-propose when the caller didn't name units: available vehicles whose
    # type fits the classification, then on-duty personnel at those stations.
    if not vehicle_ids:
        wanted = _units_for_classification(incident["classification"])
        picked: list[str] = []
        for vtype in wanted:
            row = conn.execute(
                "SELECT id FROM vehicles WHERE status = 'available' AND type = ? "
                "AND id NOT IN (%s) LIMIT 1" % (",".join("?" * len(picked)) or "''"),
                (vtype, *picked),
            ).fetchone()
            if row is not None:
                picked.append(row["id"])
        if not picked:
            for row in conn.execute(
                "SELECT id FROM vehicles WHERE status = 'available' LIMIT 2"
            ).fetchall():
                picked.append(row["id"])
        vehicle_ids = picked
    if not personnel_ids and vehicle_ids:
        rows = conn.execute(
            "SELECT DISTINCT p.id FROM personnel p JOIN vehicles v ON p.station_id = v.station_id "
            "WHERE p.status = 'on_duty' AND v.id IN (%s) LIMIT 6"
            % ",".join("?" * len(vehicle_ids)),
            tuple(vehicle_ids),
        ).fetchall()
        personnel_ids = [r["id"] for r in rows]
    if not personnel_ids:
        rows = conn.execute(
            "SELECT id FROM personnel WHERE status = 'on_duty' LIMIT 4"
        ).fetchall()
        personnel_ids = [r["id"] for r in rows]

    if not vehicle_ids and not personnel_ids and not equipment_ids:
        return {
            "error": "No units available to propose for dispatch. Flag for manual assignment."
        }

    dispatch_id = _new_id("DSP")
    notes = args.get("notes") or "Proposed by SIREN voice intake — awaiting operator approval."
    conn.execute(
        "INSERT INTO dispatches(id, incident_id, status, proposed_by, notes, created_at, decided_at) "
        "VALUES (?, ?, 'pending', 'agent', ?, ?, NULL)",
        (dispatch_id, incident["id"], notes, _utcnow()),
    )
    for vid in vehicle_ids:
        conn.execute(
            "INSERT INTO dispatch_vehicles(dispatch_id, vehicle_id) VALUES (?, ?)",
            (dispatch_id, vid),
        )
    for pid in personnel_ids:
        conn.execute(
            "INSERT INTO dispatch_personnel(dispatch_id, personnel_id) VALUES (?, ?)",
            (dispatch_id, pid),
        )
    for eid in equipment_ids:
        conn.execute(
            "INSERT INTO dispatch_equipment(dispatch_id, equipment_id) VALUES (?, ?)",
            (dispatch_id, eid),
        )
    _log_event(
        conn,
        f"Dispatch {dispatch_id} proposed for incident {incident['id']} "
        f"({len(vehicle_ids)} vehicles, {len(personnel_ids)} personnel) — pending approval",
        "flame",
    )
    return {
        "dispatch_id": dispatch_id,
        "incident_id": incident["id"],
        "status": "pending",
        "vehicle_ids": vehicle_ids,
        "personnel_ids": personnel_ids,
        "equipment_ids": equipment_ids,
        "message": "Dispatch proposal queued for human operator approval. "
                   "Tell the caller help is being coordinated.",
    }


_TOOLS = {
    "create_incident": _tool_create_incident,
    "update_incident": _tool_update_incident,
    "dispatch_units": _tool_dispatch_units,
}


def _run_tool(conn, vapi_call_id: Optional[str], name: str, args: dict) -> dict:
    call_row = _get_call(conn, vapi_call_id) if vapi_call_id else None
    handler = _TOOLS.get(name)
    if handler is None:
        return {"error": f"Unknown tool '{name}'."}
    try:
        result = handler(conn, call_row, args or {})
    except Exception as exc:
        result = {"error": f"Tool '{name}' failed: {exc}"}
    if vapi_call_id:
        _append_extracted(
            conn,
            vapi_call_id,
            {"type": "tool_call", "tool": name, "args": args, "result": result, "at": _utcnow()},
        )
    return result


# --------------------------------------------------------------------------- #
# Message handlers
# --------------------------------------------------------------------------- #

def _load_assistant_spec() -> dict:
    """Load server/vapi/assistant.json; substitute VAPI_SERVER_URL into the
    serverUrl placeholder if configured."""
    try:
        with open(_ASSISTANT_SPEC, "r", encoding="utf-8") as fh:
            spec = json.load(fh)
    except (OSError, json.JSONDecodeError):
        spec = {}
    server_url = os.environ.get("VAPI_SERVER_URL", "").strip()
    if server_url:
        spec["serverUrl"] = server_url
        for tool in (spec.get("model") or {}).get("tools") or []:
            if isinstance(tool.get("server"), dict):
                tool["server"]["url"] = server_url
    elif isinstance(spec.get("serverUrl"), str) and "<your-tunnel>" in spec["serverUrl"]:
        # Placeholder not configured — let the phone-number/account server URL apply.
        spec.pop("serverUrl", None)
    if not spec:
        spec = {
            "firstMessage": "SIREN dispatch. What is your emergency?",
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are SIREN, a calm emergency-intake voice agent. "
                                   "Gather classification, address, hazards, casualties and "
                                   "caller info, then call create_incident and dispatch_units.",
                    }
                ],
            },
        }
        if server_url:
            spec["serverUrl"] = server_url
    return spec


def _handle_tool_calls(conn, message: dict) -> JSONResponse:
    """Modern tool-calls message -> {"results":[{toolCallId,result}]}"""
    vapi_call_id = (message.get("call") or {}).get("id")

    # Normalize both shapes:
    #  toolCallList:        [{id, name, arguments|parameters}]
    #  toolWithToolCallList:[{name, toolCall:{id, function:{name,parameters}|parameters}}]
    calls: list[tuple[str, str, dict]] = []
    for item in message.get("toolCallList") or []:
        args = item.get("arguments")
        if args is None:
            args = item.get("parameters")
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}
        calls.append((item.get("id") or "", item.get("name") or "", args or {}))
    if not calls:
        for item in message.get("toolWithToolCallList") or []:
            tc = item.get("toolCall") or {}
            fn = tc.get("function") or {}
            name = fn.get("name") or item.get("name") or ""
            args = fn.get("parameters") if isinstance(fn.get("parameters"), dict) else tc.get("parameters")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            calls.append((tc.get("id") or "", name, args or {}))

    results = [
        {"toolCallId": tc_id, "name": name, "result": _jsonable(_run_tool(conn, vapi_call_id, name, args))}
        for tc_id, name, args in calls
    ]
    return JSONResponse({"results": results})


def _handle_function_call(conn, message: dict) -> JSONResponse:
    """Legacy function-call message -> {"result": ...}"""
    vapi_call_id = (message.get("call") or {}).get("id")
    fc = message.get("functionCall") or {}
    name = fc.get("name") or fc.get("functionName") or ""
    args = fc.get("parameters") or {}
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            args = {}
    return JSONResponse({"result": _jsonable(_run_tool(conn, vapi_call_id, name, args))})


def _handle_transcript(conn, message: dict) -> None:
    # Only persist final transcripts; partials would spam the row.
    mtype = message.get("type") or ""
    transcript_type = message.get("transcriptType")
    if transcript_type != "final" and 'transcriptType="final"' not in mtype:
        return
    call = message.get("call") or {}
    vapi_call_id = call.get("id")
    text = message.get("transcript") or message.get("originalTranscript")
    if not vapi_call_id or not text:
        return
    _upsert_call(conn, vapi_call_id)
    speaker = "CALLER" if message.get("role") == "user" else "AGENT"
    _append_transcript_line(conn, vapi_call_id, f"{speaker}: {text}")


def _handle_status_update(conn, message: dict) -> None:
    call = message.get("call") or {}
    vapi_call_id = call.get("id")
    if not vapi_call_id:
        return
    status = message.get("status") or call.get("status") or ""
    name, number = _caller_info(message)

    if status == "in-progress":
        started = _parse_ts(call.get("startedAt"))
        fields: dict[str, Any] = {
            "live": 1,
            "started_at": (started or _parse_ts(_utcnow())).isoformat(timespec="seconds").replace("+00:00", "Z"),
        }
        if name:
            fields["caller_name"] = name
        if number:
            fields["caller_number"] = number
        is_new = _get_call(conn, vapi_call_id) is None
        _upsert_call(conn, vapi_call_id, **fields)
        if is_new:
            _log_event(
                conn,
                f"Call started ({vapi_call_id})"
                + (f" from {number}" if number else ""),
                "flame",
            )
    elif status == "ended":
        row = _get_call(conn, vapi_call_id)
        ended = _parse_ts(call.get("endedAt")) or _parse_ts(_utcnow())
        fields = {"live": 0, "ended_at": ended.isoformat(timespec="seconds").replace("+00:00", "Z")}
        if row is not None:
            started = _parse_ts(row["started_at"])
            if started is not None:
                fields["duration_s"] = int((ended - started).total_seconds())
        _upsert_call(conn, vapi_call_id, **fields)
    else:
        # queued/ringing/scheduled/forwarding — ensure the row exists.
        fields = {}
        if number:
            fields["caller_number"] = number
        _upsert_call(conn, vapi_call_id, **fields)


def _handle_end_of_call_report(conn, message: dict) -> None:
    call = message.get("call") or {}
    vapi_call_id = call.get("id")
    if not vapi_call_id:
        return
    artifact = message.get("artifact") or {}
    analysis = message.get("analysis") or {}
    name, number = _caller_info(message)

    transcript = (
        artifact.get("transcript")
        or message.get("transcript")
    )
    summary = analysis.get("summary") or message.get("summary")

    started = _parse_ts(call.get("startedAt") or message.get("startedAt"))
    ended = _parse_ts(call.get("endedAt") or message.get("endedAt")) or _parse_ts(_utcnow())
    duration = message.get("durationSeconds") or call.get("durationSeconds")
    if duration is None and (call.get("durationMs") or message.get("durationMs")):
        duration = round((call.get("durationMs") or message.get("durationMs")) / 1000)
    if duration is None and started is not None and ended is not None:
        duration = int((ended - started).total_seconds())

    fields: dict[str, Any] = {"live": 0}
    if started is not None:
        fields["started_at"] = started.isoformat(timespec="seconds").replace("+00:00", "Z")
    if ended is not None:
        fields["ended_at"] = ended.isoformat(timespec="seconds").replace("+00:00", "Z")
    if duration is not None:
        try:
            fields["duration_s"] = int(duration)
        except (TypeError, ValueError):
            pass
    if transcript:
        fields["transcript"] = transcript
    if summary:
        fields["summary"] = summary
    if name:
        fields["caller_name"] = name
    if number:
        fields["caller_number"] = number
    _upsert_call(conn, vapi_call_id, **fields)

    _append_extracted(
        conn,
        vapi_call_id,
        {
            "type": "call_analysis",
            "ended_reason": message.get("endedReason") or call.get("endedReason"),
            "summary": summary,
            "structured_data": analysis.get("structuredData"),
            "success_evaluation": analysis.get("successEvaluation"),
            "recording_url": ((artifact.get("recording") or {}).get("url")
                              or (artifact.get("recording") or {}).get("stereoUrl")),
            "at": _utcnow(),
        },
    )
    dur_txt = f", {fields.get('duration_s')}s" if fields.get("duration_s") else ""
    _log_event(
        conn,
        f"Call ended ({vapi_call_id}{dur_txt})"
        + (f" — {summary[:120]}" if summary else ""),
        "bone",
    )


# --------------------------------------------------------------------------- #
# Webhook
# --------------------------------------------------------------------------- #

def _authorized(request: Request) -> bool:
    secret = os.environ.get("VAPI_WEBHOOK_SECRET", "").strip()
    if not secret:
        return True
    candidates = [
        request.headers.get("x-vapi-secret", ""),
        request.query_params.get("secret", ""),
    ]
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        candidates.append(auth[7:].strip())
    return any(hmac.compare_digest(c, secret) for c in candidates if c)


@router.post("/api/vapi/webhook")
async def vapi_webhook(request: Request) -> JSONResponse:
    if not _authorized(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid json"}, status_code=400)

    message = body.get("message") if isinstance(body, dict) else None
    if not isinstance(message, dict):
        # Tolerate unwrapped payloads (tests, forwards).
        message = body if isinstance(body, dict) else {}

    mtype = message.get("type") or ""
    conn = _connect()
    try:
        if mtype == "assistant-request":
            return JSONResponse({"assistant": _load_assistant_spec()})
        if mtype == "tool-calls":
            resp = _handle_tool_calls(conn, message)
            conn.commit()
            return resp
        if mtype == "function-call":
            resp = _handle_function_call(conn, message)
            conn.commit()
            return resp
        if mtype == "transcript" or mtype.startswith("transcript["):
            _handle_transcript(conn, message)
        elif mtype == "status-update":
            _handle_status_update(conn, message)
        elif mtype == "end-of-call-report":
            _handle_end_of_call_report(conn, message)
        elif mtype == "hang":
            call_id = (message.get("call") or {}).get("id", "?")
            _log_event(conn, f"Assistant hang detected on call {call_id}", "ash")
        # conversation-update, speech-update, model-output, transfer-*,
        # user-interrupted, etc.: informational only -> acknowledge.
        conn.commit()
        return JSONResponse({})
    except Exception as exc:  # never leave Vapi hanging on a 500-retry loop
        conn.rollback()
        return JSONResponse({"error": f"webhook handler failed: {exc}"}, status_code=200)
    finally:
        conn.close()
