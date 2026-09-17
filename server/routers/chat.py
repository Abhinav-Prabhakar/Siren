"""POST /api/chat {message} -> {reply, ts}; GET /api/chat/history.

Rule-based stub — no real LLM. Answers are computed from live DB state and
both user + assistant messages are persisted to chat_messages.
"""
from fastapi import APIRouter
from pydantic import BaseModel

from db import get_conn, now_iso, rows_dicts

router = APIRouter(prefix="/api", tags=["chat"])


class ChatIn(BaseModel):
    message: str


def _status_counts(conn, table: str) -> dict:
    return {r["status"]: r["c"] for r in conn.execute(
        f"SELECT status, COUNT(*) AS c FROM {table} GROUP BY status"
    )}


def _summary(conn) -> str:
    v = _status_counts(conn, "vehicles")
    p = _status_counts(conn, "personnel")
    active = conn.execute(
        "SELECT COUNT(*) AS c FROM incidents WHERE status != 'resolved'"
    ).fetchone()["c"]
    pending = conn.execute(
        "SELECT COUNT(*) AS c FROM dispatches WHERE status = 'pending'"
    ).fetchone()["c"]
    live = conn.execute(
        "SELECT COUNT(*) AS c FROM calls WHERE live = 1"
    ).fetchone()["c"]
    avail = v.get("available", 0)
    total_v = sum(v.values())
    on_scene = v.get("on_scene", 0)
    en_route = v.get("en_route", 0)
    duty = p.get("on_duty", 0) + p.get("on_scene", 0) + p.get("en_route", 0)
    return (
        f"Station status: {avail}/{total_v} units available, {en_route} en route, "
        f"{on_scene} on scene. {duty} personnel engaged, {active} active incident(s), "
        f"{pending} dispatch(es) awaiting approval, {live} live call(s)."
    )


def _reply(conn, message: str) -> str:
    msg = message.lower()

    if any(w in msg for w in ("hello", "hi", "hey")):
        return "SIREN-1 online. Ask for status, units, incidents, dispatches, calls, fuel, crew or equipment."

    if "availab" in msg or "unit" in msg or "vehicle" in msg or "apparatus" in msg:
        v = _status_counts(conn, "vehicles")
        total = sum(v.values())
        names = [r["callsign"] for r in conn.execute(
            "SELECT callsign FROM vehicles WHERE status = 'available' ORDER BY id"
        )]
        breakdown = ", ".join(f"{k}:{n}" for k, n in v.items() if n)
        listed = f" Available: {', '.join(names)}." if names else ""
        return f"{v.get('available', 0)} of {total} units available.{listed} Breakdown — {breakdown}."

    if "incident" in msg or "fire" in msg or "emergency" in msg:
        rows = rows_dicts(conn.execute(
            "SELECT id, priority, classification, address, status FROM incidents "
            "WHERE status != 'resolved' ORDER BY priority"
        ))
        if not rows:
            return "No active incidents. Board is green."
        parts = [f"{r['id']} [{r['priority']}/{r['status']}] {r['classification']} @ {r['address']}"
                 for r in rows]
        return f"{len(rows)} active incident(s): " + " | ".join(parts)

    if "dispatch" in msg or "pending" in msg or "approv" in msg:
        rows = rows_dicts(conn.execute(
            "SELECT id, incident_id, notes FROM dispatches WHERE status = 'pending' "
            "ORDER BY created_at"
        ))
        if not rows:
            return "No dispatches awaiting approval."
        parts = [f"{r['id']} → {r['incident_id']} ({r['notes']})" for r in rows]
        return f"{len(rows)} pending dispatch(es): " + " | ".join(parts)

    if "call" in msg or "phone" in msg or "vapi" in msg:
        live = conn.execute(
            "SELECT COUNT(*) AS c FROM calls WHERE live = 1"
        ).fetchone()["c"]
        total = conn.execute("SELECT COUNT(*) AS c FROM calls").fetchone()["c"]
        live_rows = rows_dicts(conn.execute(
            "SELECT id, caller_name, incident_id FROM calls WHERE live = 1"
        ))
        detail = " Live: " + ", ".join(
            f"{r['id']} ({r['caller_name']} → {r['incident_id'] or 'unassigned'})"
            for r in live_rows
        ) if live_rows else ""
        return f"{live} live call(s), {total} total on record.{detail}"

    if "fuel" in msg:
        rows = rows_dicts(conn.execute(
            "SELECT callsign, fuel_pct FROM vehicles ORDER BY fuel_pct ASC LIMIT 3"
        ))
        parts = ", ".join(f"{r['callsign']} {r['fuel_pct']:.0f}%" for r in rows)
        return f"Lowest fuel: {parts}."

    if "crew" in msg or "personnel" in msg or "staff" in msg or "people" in msg or "who" in msg:
        p = _status_counts(conn, "personnel")
        total = sum(p.values())
        breakdown = ", ".join(f"{k}:{n}" for k, n in p.items() if n)
        return f"{total} personnel on roster. Breakdown — {breakdown}."

    if "equipment" in msg or "gear" in msg or "scba" in msg or "tool" in msg:
        e = _status_counts(conn, "equipment")
        total = sum(e.values())
        breakdown = ", ".join(f"{k}:{n}" for k, n in e.items() if n)
        return f"{total} equipment items tracked. Breakdown — {breakdown}."

    if "battery" in msg:
        rows = rows_dicts(conn.execute(
            "SELECT id, name, battery_pct FROM equipment "
            "WHERE battery_pct IS NOT NULL ORDER BY battery_pct ASC LIMIT 3"
        ))
        parts = ", ".join(f"{r['name']} {r['battery_pct']:.0f}%" for r in rows)
        return f"Lowest equipment batteries: {parts}."

    # default — station summary
    return _summary(conn)


@router.post("/chat")
def chat(body: ChatIn):
    conn = get_conn()
    try:
        user_ts = now_iso()
        reply = _reply(conn, body.message or "")
        reply_ts = now_iso()
        conn.execute(
            "INSERT INTO chat_messages(role,content,ts) VALUES(?,?,?)",
            ("user", body.message, user_ts),
        )
        conn.execute(
            "INSERT INTO chat_messages(role,content,ts) VALUES(?,?,?)",
            ("assistant", reply, reply_ts),
        )
        conn.commit()
        return {"reply": reply, "ts": reply_ts}
    finally:
        conn.close()


@router.get("/chat/history")
def chat_history():
    conn = get_conn()
    try:
        return rows_dicts(conn.execute(
            "SELECT * FROM chat_messages ORDER BY id"
        ).fetchall())
    finally:
        conn.close()
