"""GET /api/telemetry/{entity_type}/{entity_id}?metric=&limit=60 — chronological."""
from typing import Optional

from fastapi import APIRouter

from db import get_conn

router = APIRouter(prefix="/api", tags=["telemetry"])


@router.get("/telemetry/{entity_type}/{entity_id}")
def get_telemetry(entity_type: str, entity_id: str,
                  metric: Optional[str] = None, limit: int = 60):
    limit = max(1, min(limit, 500))
    conn = get_conn()
    try:
        if metric:
            rows = conn.execute(
                """SELECT metric, value, ts FROM telemetry
                   WHERE entity_type = ? AND entity_id = ? AND metric = ?
                   ORDER BY id DESC LIMIT ?""",
                (entity_type, entity_id, metric, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT metric, value, ts FROM telemetry
                   WHERE entity_type = ? AND entity_id = ?
                   ORDER BY id DESC LIMIT ?""",
                (entity_type, entity_id, limit),
            ).fetchall()
        return [dict(r) for r in reversed(rows)]  # chronological
    finally:
        conn.close()
