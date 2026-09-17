"""GET /api/incidents?status=, GET /api/incidents/{id},
POST /api/incidents/{id}/contact."""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_conn, now_iso, row_dict, rows_dicts
from .calls import _parse_extracted
from .dispatches import hydrate_dispatch

router = APIRouter(prefix="/api", tags=["incidents"])


def _parse_contacts(inc: dict) -> dict:
    """external_contacts is stored as JSON text; return it as an array."""
    raw = inc.get("external_contacts")
    try:
        parsed = json.loads(raw) if raw else []
        inc["external_contacts"] = parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        inc["external_contacts"] = []
    return inc


def _with_counts(conn, inc: dict) -> dict:
    inc["call_count"] = conn.execute(
        "SELECT COUNT(*) AS c FROM calls WHERE incident_id = ?", (inc["id"],)
    ).fetchone()["c"]
    inc["unit_count"] = conn.execute(
        "SELECT COUNT(*) AS c FROM vehicles WHERE incident_id = ?", (inc["id"],)
    ).fetchone()["c"]
    return inc


def _fetch_incident(conn, incident_id: str) -> dict:
    inc = row_dict(conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone())
    if inc is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return inc


@router.get("/incidents")
def list_incidents(status: Optional[str] = None):
    conn = get_conn()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM incidents WHERE status = ? ORDER BY reported_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM incidents ORDER BY reported_at DESC"
            ).fetchall()
        return [_parse_contacts(_with_counts(conn, dict(r))) for r in rows]
    finally:
        conn.close()


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    conn = get_conn()
    try:
        inc = _fetch_incident(conn, incident_id)
        _with_counts(conn, inc)
        _parse_contacts(inc)
        inc["calls"] = [
            _parse_extracted(c) for c in rows_dicts(conn.execute(
                "SELECT * FROM calls WHERE incident_id = ? ORDER BY started_at",
                (incident_id,),
            ).fetchall())
        ]
        inc["dispatches"] = [
            hydrate_dispatch(conn, d) for d in conn.execute(
                "SELECT * FROM dispatches WHERE incident_id = ? ORDER BY created_at",
                (incident_id,),
            ).fetchall()
        ]
        inc["vehicles"] = rows_dicts(conn.execute(
            "SELECT * FROM vehicles WHERE incident_id = ? ORDER BY id", (incident_id,)
        ).fetchall())
        inc["personnel"] = rows_dicts(conn.execute(
            "SELECT * FROM personnel WHERE incident_id = ? ORDER BY id", (incident_id,)
        ).fetchall())
        return inc
    finally:
        conn.close()


class ContactIn(BaseModel):
    service: str  # ems|police|utility|gas|other (free-form string accepted)


@router.post("/incidents/{incident_id}/contact")
def contact_service(incident_id: str, body: ContactIn):
    """Append an external-service contact to the incident."""
    conn = get_conn()
    try:
        inc = _fetch_incident(conn, incident_id)
        _parse_contacts(inc)
        now = now_iso()
        contacts = inc["external_contacts"] + [{"service": body.service, "ts": now}]
        conn.execute(
            "UPDATE incidents SET external_contacts = ? WHERE id = ?",
            (json.dumps(contacts), incident_id),
        )
        conn.execute(
            "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
            (now, "EXT",
             f"{incident_id}: external contact notified — {body.service}.",
             "bone"),
        )
        conn.commit()
        inc["external_contacts"] = contacts
        return _with_counts(conn, inc)
    finally:
        conn.close()
