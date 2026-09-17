"""GET /api/settings, POST /api/settings/night-mode.

Night mode: when enabled, ALL currently-pending dispatches are auto-approved
(with full assignment side-effects) and the simulator auto-approves any new
pending dispatch on each tick. Auto-approval events are tagged NIGHT.
"""
from fastapi import APIRouter
from pydantic import BaseModel

from db import get_conn, now_iso
from .dispatches import apply_approval

router = APIRouter(prefix="/api", tags=["settings"])


def night_mode_on(conn) -> bool:
    row = conn.execute(
        "SELECT value FROM settings WHERE key = 'night_mode'"
    ).fetchone()
    return bool(row and str(row["value"]).lower() in ("1", "true", "yes", "on"))


class NightModeIn(BaseModel):
    enabled: bool


@router.get("/settings")
def get_settings():
    conn = get_conn()
    try:
        return {"night_mode": night_mode_on(conn)}
    finally:
        conn.close()


@router.post("/settings/night-mode")
def set_night_mode(body: NightModeIn):
    conn = get_conn()
    try:
        now = now_iso()
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES('night_mode', ?)",
            ("true" if body.enabled else "false",),
        )
        auto_approved = []
        if body.enabled:
            pending = conn.execute(
                "SELECT * FROM dispatches WHERE status = 'pending' ORDER BY created_at"
            ).fetchall()
            for d in pending:
                apply_approval(
                    conn, d, tag="NIGHT",
                    message=(f"{d['id']} auto-approved — night mode engaged, "
                             f"units rolling to {d['incident_id']}."),
                )
                auto_approved.append(d["id"])
            conn.execute(
                "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
                (now, "NIGHT",
                 f"Night mode engaged — {len(auto_approved)} pending dispatch(es) auto-approved.",
                 "flame"),
            )
        else:
            conn.execute(
                "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
                (now, "NIGHT", "Night mode disengaged — dispatches require manual approval.", "ash"),
            )
        conn.commit()
        return {"night_mode": body.enabled, "auto_approved": auto_approved}
    finally:
        conn.close()
