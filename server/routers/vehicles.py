"""GET /api/vehicles, GET /api/vehicles/{id}."""
from fastapi import APIRouter, HTTPException

from db import get_conn, row_dict, rows_dicts

router = APIRouter(prefix="/api", tags=["vehicles"])


@router.get("/vehicles")
def list_vehicles():
    conn = get_conn()
    try:
        return rows_dicts(conn.execute("SELECT * FROM vehicles ORDER BY id").fetchall())
    finally:
        conn.close()


@router.get("/vehicles/{vehicle_id}")
def get_vehicle(vehicle_id: str):
    conn = get_conn()
    try:
        v = row_dict(conn.execute(
            "SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)
        ).fetchone())
        if v is None:
            raise HTTPException(status_code=404, detail="vehicle not found")
        v["crew"] = rows_dicts(conn.execute(
            "SELECT * FROM personnel WHERE vehicle_id = ? ORDER BY id", (vehicle_id,)
        ).fetchall())
        v["equipment"] = rows_dicts(conn.execute(
            "SELECT * FROM equipment WHERE vehicle_id = ? ORDER BY id", (vehicle_id,)
        ).fetchall())
        return v
    finally:
        conn.close()
