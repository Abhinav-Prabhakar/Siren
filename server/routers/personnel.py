"""GET /api/personnel?status=&role=, GET /api/personnel/{id}."""
from typing import Optional

from fastapi import APIRouter, HTTPException

from db import get_conn, row_dict, rows_dicts

router = APIRouter(prefix="/api", tags=["personnel"])


@router.get("/personnel")
def list_personnel(status: Optional[str] = None, role: Optional[str] = None):
    sql = "SELECT * FROM personnel"
    clauses, params = [], []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if role:
        clauses.append("role = ?")
        params.append(role)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY id"
    conn = get_conn()
    try:
        return rows_dicts(conn.execute(sql, params).fetchall())
    finally:
        conn.close()


@router.get("/personnel/{personnel_id}")
def get_personnel(personnel_id: str):
    conn = get_conn()
    try:
        p = row_dict(conn.execute(
            "SELECT * FROM personnel WHERE id = ?", (personnel_id,)
        ).fetchone())
        if p is None:
            raise HTTPException(status_code=404, detail="personnel not found")
        if p["vehicle_id"]:
            v = conn.execute(
                "SELECT name FROM vehicles WHERE id = ?", (p["vehicle_id"],)
            ).fetchone()
            p["vehicle_name"] = v["name"] if v else None
        else:
            p["vehicle_name"] = None
        if p["incident_id"]:
            i = conn.execute(
                "SELECT address FROM incidents WHERE id = ?", (p["incident_id"],)
            ).fetchone()
            p["incident_address"] = i["address"] if i else None
        else:
            p["incident_address"] = None
        return p
    finally:
        conn.close()
