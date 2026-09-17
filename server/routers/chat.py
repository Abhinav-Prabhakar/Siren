"""POST /api/chat {message} -> {reply, ts}; GET /api/chat/history.

Real LLM via the OpenAI-compatible endpoint configured by env:
  VOIDAI_API_KEY, VOIDAI_BASE_URL, VOIDAI_MODEL (default gpt-5-nano).

The system prompt carries a compact live DB snapshot and the last ~20
chat_messages are sent as context. Both user and assistant messages persist to
chat_messages. Missing key / LLM failure -> HTTP 503 (never a fake reply).
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import env
from db import get_conn, now_iso, rows_dicts

env.load()

router = APIRouter(prefix="/api", tags=["chat"])

HISTORY_LIMIT = 20


class ChatIn(BaseModel):
    message: str


def _status_counts(conn, table: str) -> dict:
    return {r["status"]: r["c"] for r in conn.execute(
        f"SELECT status, COUNT(*) AS c FROM {table} GROUP BY status"
    )}


def _snapshot(conn) -> str:
    """Compact live-state digest injected into the system prompt."""
    vehicles = _status_counts(conn, "vehicles")
    personnel = _status_counts(conn, "personnel")
    on_duty = rows_dicts(conn.execute(
        """SELECT name, role, status FROM personnel
           WHERE status IN ('on_duty','dispatched','en_route','on_scene')
           ORDER BY id"""
    ))
    incidents = rows_dicts(conn.execute(
        """SELECT id, priority, classification, address, status FROM incidents
           WHERE status != 'resolved' ORDER BY priority"""
    ))
    pending = rows_dicts(conn.execute(
        """SELECT id, incident_id, proposed_by FROM dispatches
           WHERE status = 'pending' ORDER BY created_at"""
    ))
    live_calls = rows_dicts(conn.execute(
        "SELECT id, caller_name, incident_id FROM calls WHERE live = 1"
    ))

    def counts(d):
        return ", ".join(f"{k}:{n}" for k, n in sorted(d.items()) if n) or "none"

    lines = [
        "LIVE SNAPSHOT:",
        f"- Units by status: {counts(vehicles)}",
        f"- Personnel by status: {counts(personnel)}",
        f"- On-duty personnel: "
        + ("; ".join(f"{p['name']} ({p['role']}, {p['status']})" for p in on_duty) or "none"),
        "- Active incidents: "
        + ("; ".join(f"{i['id']} [{i['priority']}/{i['status']}] "
                     f"{i['classification']} @ {i['address']}" for i in incidents) or "none"),
        f"- Pending dispatches: {len(pending)}"
        + (" (" + "; ".join(f"{d['id']}->{d['incident_id']} by {d['proposed_by']}"
                           for d in pending) + ")" if pending else ""),
        f"- Live calls: {len(live_calls)}"
        + (" (" + "; ".join(f"{c['id']} {c['caller_name']}->{c['incident_id'] or 'unassigned'}"
                           for c in live_calls) + ")" if live_calls else ""),
    ]
    return "\n".join(lines)


SYSTEM_PROMPT = """You are SIREN-1, the dispatch copilot for Siren Central fire station \
(SIREN emergency dispatch console). You answer the incident commander's \
questions using the live operations snapshot below. Be terse, precise, and \
operational — radio voice. Use exact unit callsigns, personnel names, incident \
ids and statuses from the snapshot. If asked for something not in the data, \
say so plainly instead of guessing. Never fabricate numbers."""


def _llm_reply(conn, user_message: str, exclude_id: Optional[int] = None) -> str:
    api_key = env.get("VOIDAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM unavailable: VOIDAI_API_KEY is not configured (server/.env)",
        )
    base_url = env.get("VOIDAI_BASE_URL")
    model = env.get("VOIDAI_MODEL", "gpt-5-nano")

    # exclude_id skips the just-persisted user message — it's appended
    # explicitly below, and would otherwise appear twice in the context.
    history = rows_dicts(conn.execute(
        "SELECT id, role, content FROM chat_messages ORDER BY id DESC LIMIT ?",
        (HISTORY_LIMIT + 1,),
    ))
    history = [h for h in history if h["id"] != exclude_id][:HISTORY_LIMIT]
    history.reverse()  # chronological

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\n" + _snapshot(conn)},
        *[{"role": h["role"], "content": h["content"]} for h in history],
        {"role": "user", "content": user_message},
    ]

    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="LLM unavailable: 'openai' package not installed",
        )

    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)
        resp = client.chat.completions.create(model=model, messages=messages)
        reply = (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"LLM request failed: {exc}"
        )
    if not reply:
        raise HTTPException(
            status_code=503, detail="LLM returned an empty reply"
        )
    return reply


@router.post("/chat")
def chat(body: ChatIn):
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="message must not be empty")
    conn = get_conn()
    try:
        user_ts = now_iso()
        cur = conn.execute(
            "INSERT INTO chat_messages(role,content,ts) VALUES(?,?,?)",
            ("user", message, user_ts),
        )
        conn.commit()

        reply = _llm_reply(conn, message, exclude_id=cur.lastrowid)
        reply_ts = now_iso()
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
