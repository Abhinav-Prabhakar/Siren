"""GET /api/overview — station, status counts, latest events."""
from fastapi import APIRouter

from db import get_conn, row_dict, rows_dicts

router = APIRouter(prefix="/api", tags=["overview"])

VEHICLE_STATUSES = ["available", "dispatched", "en_route", "on_scene",
                    "returning", "refuel", "out_of_service"]
PERSONNEL_STATUSES = ["on_duty", "dispatched", "en_route", "on_scene",
                      "resting", "off_duty"]
EQUIPMENT_STATUSES = ["ready", "in_use", "maintenance", "missing"]


def _status_counts(conn, table: str, statuses: list[str]) -> dict:
    out = {s: 0 for s in statuses}
    for r in conn.execute(f"SELECT status, COUNT(*) AS c FROM {table} GROUP BY status"):
        out[r["status"]] = r["c"]
    return out


@router.get("/overview")
def overview():
    conn = get_conn()
    try:
        station = row_dict(conn.execute("SELECT * FROM stations LIMIT 1").fetchone())
        counts = {
            "vehicles": _status_counts(conn, "vehicles", VEHICLE_STATUSES),
            "personnel": _status_counts(conn, "personnel", PERSONNEL_STATUSES),
            "equipment": _status_counts(conn, "equipment", EQUIPMENT_STATUSES),
            "active_incidents": conn.execute(
                "SELECT COUNT(*) AS c FROM incidents WHERE status != 'resolved'"
            ).fetchone()["c"],
            "pending_dispatches": conn.execute(
                "SELECT COUNT(*) AS c FROM dispatches WHERE status = 'pending'"
            ).fetchone()["c"],
            "live_calls": conn.execute(
                "SELECT COUNT(*) AS c FROM calls WHERE live = 1"
            ).fetchone()["c"],
        }
        latest_events = rows_dicts(conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT 10"
        ).fetchall())
        latest_events.reverse()  # newest-last
        return {"station": station, "counts": counts, "latest_events": latest_events}
    finally:
        conn.close()
