"""GET /api/dispatches?status=, POST /api/dispatches/{id}/approve|reject."""
from typing import Optional

from fastapi import APIRouter, HTTPException

from db import get_conn, now_iso, rows_dicts

router = APIRouter(prefix="/api", tags=["dispatches"])


def hydrate_dispatch(conn, d) -> dict:
    """Dispatch row → contract shape with assignment id lists + incident fields."""
    out = dict(d)
    out["vehicle_ids"] = [
        r["vehicle_id"] for r in conn.execute(
            "SELECT vehicle_id FROM dispatch_vehicles WHERE dispatch_id = ?", (d["id"],)
        )
    ]
    out["personnel_ids"] = [
        r["personnel_id"] for r in conn.execute(
            "SELECT personnel_id FROM dispatch_personnel WHERE dispatch_id = ?", (d["id"],)
        )
    ]
    out["equipment_ids"] = [
        r["equipment_id"] for r in conn.execute(
            "SELECT equipment_id FROM dispatch_equipment WHERE dispatch_id = ?", (d["id"],)
        )
    ]
    inc = conn.execute(
        "SELECT address, classification, priority FROM incidents WHERE id = ?",
        (d["incident_id"],),
    ).fetchone()
    out["incident_address"] = inc["address"] if inc else None
    out["incident_classification"] = inc["classification"] if inc else None
    out["incident_priority"] = inc["priority"] if inc else None
    return out


def _fetch_dispatch(conn, dispatch_id: str):
    d = conn.execute(
        "SELECT * FROM dispatches WHERE id = ?", (dispatch_id,)
    ).fetchone()
    if d is None:
        raise HTTPException(status_code=404, detail="dispatch not found")
    return d


@router.get("/dispatches")
def list_dispatches(status: Optional[str] = None):
    conn = get_conn()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM dispatches WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM dispatches ORDER BY created_at DESC"
            ).fetchall()
        return [hydrate_dispatch(conn, d) for d in rows]
    finally:
        conn.close()


@router.post("/dispatches/{dispatch_id}/approve")
def approve_dispatch(dispatch_id: str):
    conn = get_conn()
    try:
        d = _fetch_dispatch(conn, dispatch_id)
        now = now_iso()
        conn.execute(
            "UPDATE dispatches SET status = 'approved', decided_at = ? WHERE id = ?",
            (now, dispatch_id),
        )
        conn.execute(
            """UPDATE vehicles SET status = 'dispatched', incident_id = ?, updated_at = ?
               WHERE id IN (SELECT vehicle_id FROM dispatch_vehicles WHERE dispatch_id = ?)""",
            (d["incident_id"], now, dispatch_id),
        )
        conn.execute(
            """UPDATE personnel SET status = 'dispatched', incident_id = ?, updated_at = ?
               WHERE id IN (SELECT personnel_id FROM dispatch_personnel WHERE dispatch_id = ?)""",
            (d["incident_id"], now, dispatch_id),
        )
        conn.execute(
            """UPDATE equipment SET status = 'in_use', updated_at = ?
               WHERE id IN (SELECT equipment_id FROM dispatch_equipment WHERE dispatch_id = ?)""",
            (now, dispatch_id),
        )
        nv = conn.execute(
            "SELECT COUNT(*) AS c FROM dispatch_vehicles WHERE dispatch_id = ?",
            (dispatch_id,),
        ).fetchone()["c"]
        np_ = conn.execute(
            "SELECT COUNT(*) AS c FROM dispatch_personnel WHERE dispatch_id = ?",
            (dispatch_id,),
        ).fetchone()["c"]
        conn.execute(
            "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
            (now, "DISPATCH",
             f"{dispatch_id} approved — {nv} vehicle(s), {np_} personnel dispatched to {d['incident_id']}.",
             "flame"),
        )
        conn.commit()
        return hydrate_dispatch(conn, _fetch_dispatch(conn, dispatch_id))
    finally:
        conn.close()


@router.post("/dispatches/{dispatch_id}/reject")
def reject_dispatch(dispatch_id: str):
    conn = get_conn()
    try:
        d = _fetch_dispatch(conn, dispatch_id)
        now = now_iso()
        conn.execute(
            "UPDATE dispatches SET status = 'rejected', decided_at = ? WHERE id = ?",
            (now, dispatch_id),
        )
        conn.execute(
            "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
            (now, "DISPATCH",
             f"{dispatch_id} rejected by operator — proposal for {d['incident_id']} discarded.",
             "ash"),
        )
        conn.commit()
        return hydrate_dispatch(conn, _fetch_dispatch(conn, dispatch_id))
    finally:
        conn.close()
