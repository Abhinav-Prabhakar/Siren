"""GET /api/events?limit=50 — newest-last (chronological, latest at the end)."""
from fastapi import APIRouter

from db import get_conn, rows_dicts

router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events")
def list_events(limit: int = 50):
    limit = max(1, min(limit, 500))
    conn = get_conn()
    try:
        rows = rows_dicts(conn.execute(
            "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall())
        rows.reverse()
        return rows
    finally:
        conn.close()
