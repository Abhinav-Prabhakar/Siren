"""GET /api/dispatches?status=, POST /api/dispatches,
POST /api/dispatches/{id}/approve|reject."""
import sqlite3
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


def apply_approval(conn, d, *, tag: str = "DISPATCH", tone: str = "flame",
                   message: Optional[str] = None) -> str:
    """Mark a dispatch approved and apply assignment side-effects.

    Vehicles/personnel -> 'dispatched' with incident_id set; personnel with no
    vehicle ride the first assigned vehicle; equipment -> 'in_use'. Writes an
    events row. Does NOT commit — caller owns the transaction.
    """
    now = now_iso()
    conn.execute(
        "UPDATE dispatches SET status = 'approved', decided_at = ? WHERE id = ?",
        (now, d["id"]),
    )
    # Crew members without a vehicle ride the first assigned unit.
    first_vehicle = conn.execute(
        "SELECT vehicle_id FROM dispatch_vehicles WHERE dispatch_id = ? LIMIT 1",
        (d["id"],),
    ).fetchone()
    if first_vehicle:
        conn.execute(
            """UPDATE personnel SET vehicle_id = ?, updated_at = ?
               WHERE id IN (SELECT personnel_id FROM dispatch_personnel
                            WHERE dispatch_id = ?) AND vehicle_id IS NULL""",
            (first_vehicle["vehicle_id"], now, d["id"]),
        )
    conn.execute(
        """UPDATE vehicles SET status = 'dispatched', incident_id = ?, updated_at = ?
           WHERE id IN (SELECT vehicle_id FROM dispatch_vehicles WHERE dispatch_id = ?)
             AND status NOT IN ('en_route', 'on_scene')""",
        (d["incident_id"], now, d["id"]),
    )
    conn.execute(
        """UPDATE personnel SET status = 'dispatched', incident_id = ?, updated_at = ?
           WHERE id IN (SELECT personnel_id FROM dispatch_personnel WHERE dispatch_id = ?)
             AND status NOT IN ('en_route', 'on_scene')""",
        (d["incident_id"], now, d["id"]),
    )
    conn.execute(
        """UPDATE equipment SET status = 'in_use', updated_at = ?
           WHERE id IN (SELECT equipment_id FROM dispatch_equipment WHERE dispatch_id = ?)""",
        (now, d["id"]),
    )
    nv = conn.execute(
        "SELECT COUNT(*) AS c FROM dispatch_vehicles WHERE dispatch_id = ?",
        (d["id"],),
    ).fetchone()["c"]
    np_ = conn.execute(
        "SELECT COUNT(*) AS c FROM dispatch_personnel WHERE dispatch_id = ?",
        (d["id"],),
    ).fetchone()["c"]
    if message is None:
        message = (f"{d['id']} approved — {nv} vehicle(s), {np_} personnel "
                   f"dispatched to {d['incident_id']}.")
    conn.execute(
        "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
        (now, tag, message, tone),
    )
    return now


def _next_dispatch_id(conn) -> str:
    """Next DSP-### id based on the max numeric suffix in use."""
    best = 0
    for r in conn.execute("SELECT id FROM dispatches").fetchall():
        rid = r["id"] or ""
        if rid.startswith("DSP-") and rid[4:].isdigit():
            best = max(best, int(rid[4:]))
    return f"DSP-{best + 1:03d}"


class DispatchIn(BaseModel):
    incident_id: str
    vehicle_ids: List[str] = []
    personnel_ids: List[str] = []
    equipment_ids: List[str] = []
    notes: Optional[str] = None


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


@router.post("/dispatches", status_code=201)
def create_dispatch(body: DispatchIn):
    """Manual dispatch — operator-proposed, approved immediately."""
    conn = get_conn()
    try:
        inc = conn.execute(
            "SELECT id, status FROM incidents WHERE id = ?", (body.incident_id,)
        ).fetchone()
        if inc is None:
            raise HTTPException(status_code=404, detail="incident not found")
        if inc["status"] == "resolved":
            raise HTTPException(
                status_code=422,
                detail=f"{body.incident_id} is already resolved — "
                       "cannot dispatch to a closed incident",
            )

        # Clients may send duplicate ids; dispatch rows should be unique.
        body.vehicle_ids = list(dict.fromkeys(body.vehicle_ids))
        body.personnel_ids = list(dict.fromkeys(body.personnel_ids))
        body.equipment_ids = list(dict.fromkeys(body.equipment_ids))

        missing = []
        for table, col, ids in (
            ("vehicles", "id", body.vehicle_ids),
            ("personnel", "id", body.personnel_ids),
            ("equipment", "id", body.equipment_ids),
        ):
            for rid in ids:
                row = conn.execute(
                    f"SELECT {col} FROM {table} WHERE {col} = ?", (rid,)
                ).fetchone()
                if row is None:
                    missing.append(rid)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"unknown resource id(s): {', '.join(missing)}",
            )
        if not (body.vehicle_ids or body.personnel_ids or body.equipment_ids):
            raise HTTPException(
                status_code=422,
                detail="dispatch must assign at least one vehicle, person or equipment item",
            )

        # Concurrent creators can compute the same DSP-### id — retry the
        # allocation on PK collision instead of 500ing on IntegrityError.
        dispatch_id = None
        now = now_iso()
        for _ in range(5):
            candidate = _next_dispatch_id(conn)
            try:
                conn.execute(
                    """INSERT INTO dispatches(id,incident_id,status,proposed_by,notes,
                       created_at,decided_at) VALUES(?,?,?,?,?,?,?)""",
                    (candidate, body.incident_id, "approved", "operator",
                     body.notes, now, now),
                )
                dispatch_id = candidate
                break
            except sqlite3.IntegrityError:
                continue
        if dispatch_id is None:
            raise HTTPException(
                status_code=500, detail="could not allocate a dispatch id"
            )
        conn.executemany(
            "INSERT INTO dispatch_vehicles(dispatch_id,vehicle_id) VALUES(?,?)",
            [(dispatch_id, vid) for vid in body.vehicle_ids],
        )
        conn.executemany(
            "INSERT INTO dispatch_personnel(dispatch_id,personnel_id) VALUES(?,?)",
            [(dispatch_id, pid) for pid in body.personnel_ids],
        )
        conn.executemany(
            "INSERT INTO dispatch_equipment(dispatch_id,equipment_id) VALUES(?,?)",
            [(dispatch_id, eid) for eid in body.equipment_ids],
        )
        d = _fetch_dispatch(conn, dispatch_id)
        apply_approval(
            conn, d, tag="OPS",
            message=(f"{dispatch_id} created and approved by operator — "
                     f"{len(body.vehicle_ids)} vehicle(s), "
                     f"{len(body.personnel_ids)} personnel, "
                     f"{len(body.equipment_ids)} equipment to {body.incident_id}."),
        )
        conn.commit()
        return hydrate_dispatch(conn, _fetch_dispatch(conn, dispatch_id))
    finally:
        conn.close()


@router.post("/dispatches/{dispatch_id}/approve")
def approve_dispatch(dispatch_id: str):
    conn = get_conn()
    try:
        d = _fetch_dispatch(conn, dispatch_id)
        if d["status"] != "pending":
            raise HTTPException(
                status_code=409,
                detail=f"dispatch {dispatch_id} is already {d['status']} — "
                       "only pending dispatches can be approved",
            )
        apply_approval(conn, d)
        conn.commit()
        return hydrate_dispatch(conn, _fetch_dispatch(conn, dispatch_id))
    finally:
        conn.close()


@router.post("/dispatches/{dispatch_id}/reject")
def reject_dispatch(dispatch_id: str):
    conn = get_conn()
    try:
        d = _fetch_dispatch(conn, dispatch_id)
        if d["status"] != "pending":
            raise HTTPException(
                status_code=409,
                detail=f"dispatch {dispatch_id} is already {d['status']} — "
                       "only pending dispatches can be rejected",
            )
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
