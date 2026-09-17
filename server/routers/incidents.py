"""GET /api/incidents?status=, GET /api/incidents/{id}."""
from typing import Optional

from fastapi import APIRouter, HTTPException

from db import get_conn, row_dict, rows_dicts
from .calls import _parse_extracted
from .dispatches import hydrate_dispatch

router = APIRouter(prefix="/api", tags=["incidents"])


def _with_counts(conn, inc: dict) -> dict:
    inc["call_count"] = conn.execute(
        "SELECT COUNT(*) AS c FROM calls WHERE incident_id = ?", (inc["id"],)
    ).fetchone()["c"]
    inc["unit_count"] = conn.execute(
        "SELECT COUNT(*) AS c FROM vehicles WHERE incident_id = ?", (inc["id"],)
    ).fetchone()["c"]
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
        return [_with_counts(conn, dict(r)) for r in rows]
    finally:
        conn.close()


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    conn = get_conn()
    try:
        inc = row_dict(conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone())
        if inc is None:
            raise HTTPException(status_code=404, detail="incident not found")
        _with_counts(conn, inc)
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
