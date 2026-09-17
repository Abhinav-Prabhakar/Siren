"""GET /api/calls?live= — `extracted` is stored as JSON text, returned as array."""
import json
from typing import Optional

from fastapi import APIRouter

from db import get_conn, rows_dicts

router = APIRouter(prefix="/api", tags=["calls"])


def _parse_extracted(call: dict) -> dict:
    raw = call.get("extracted")
    try:
        call["extracted"] = json.loads(raw) if raw else []
    except (TypeError, json.JSONDecodeError):
        call["extracted"] = []
    return call


@router.get("/calls")
def list_calls(live: Optional[bool] = None):
    conn = get_conn()
    try:
        if live is None:
            rows = conn.execute(
                "SELECT * FROM calls ORDER BY started_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM calls WHERE live = ? ORDER BY started_at DESC",
                (1 if live else 0,),
            ).fetchall()
        return [_parse_extracted(c) for c in rows_dicts(rows)]
    finally:
        conn.close()
