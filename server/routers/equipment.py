"""GET /api/equipment?category=&status=, GET /api/equipment/{id}."""
from typing import Optional

from fastapi import APIRouter, HTTPException

from db import get_conn, row_dict, rows_dicts

router = APIRouter(prefix="/api", tags=["equipment"])


@router.get("/equipment")
def list_equipment(category: Optional[str] = None, status: Optional[str] = None):
    sql = "SELECT * FROM equipment"
    clauses, params = [], []
    if category:
        clauses.append("category = ?")
        params.append(category)
    if status:
        clauses.append("status = ?")
        params.append(status)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY id"
    conn = get_conn()
    try:
        return rows_dicts(conn.execute(sql, params).fetchall())
    finally:
        conn.close()


@router.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: str):
    conn = get_conn()
    try:
        e = row_dict(conn.execute(
            "SELECT * FROM equipment WHERE id = ?", (equipment_id,)
        ).fetchone())
        if e is None:
            raise HTTPException(status_code=404, detail="equipment not found")
        if e["vehicle_id"]:
            v = conn.execute(
                "SELECT name FROM vehicles WHERE id = ?", (e["vehicle_id"],)
            ).fetchone()
            e["vehicle_name"] = v["name"] if v else None
        else:
            e["vehicle_name"] = None
        s = conn.execute(
            "SELECT name FROM stations WHERE id = ?", (e["station_id"],)
        ).fetchone()
        e["station_name"] = s["name"] if s else None
        return e
    finally:
        conn.close()
