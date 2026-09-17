"""POST /api/chat {message} -> {reply, ts, tool_calls}; GET /api/chat/history.

Real LLM via the OpenAI-compatible endpoint configured by env:
  VOIDAI_API_KEY, VOIDAI_BASE_URL, VOIDAI_MODEL (default gpt-5-nano).

The system prompt carries a compact live DB snapshot and the last ~20
chat_messages are sent as context. SIREN-1 can ACT through function tools
(server/chat_tools.py): propose dispatches (operator approves — unless night
watch auto-approves), create/update incidents, contact external services and
query live state. The tool-call loop runs until the model stops calling tools
(cap ~8 iterations). Both user and assistant messages persist to
chat_messages; the assistant row stores a compact JSON record of the tools it
fired (tool_calls column, lazily migrated). Missing key / LLM failure ->
HTTP 503 (never a fake reply).
"""
import json
import sqlite3
from typing import List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import env
from db import get_conn, now_iso, rows_dicts
from chat_tools import TOOLS, execute_tool

env.load()

router = APIRouter(prefix="/api", tags=["chat"])

HISTORY_LIMIT = 20
MAX_TOOL_ITERATIONS = 8


class ChatIn(BaseModel):
    message: str


def _ensure_tool_calls_col(conn) -> None:
    """Lazy migration — same try/except ALTER pattern db.init_db uses.
    chat_tools.py can't touch db.py (different owner), so the column is
    added here on first use."""
    try:
        conn.execute("ALTER TABLE chat_messages ADD COLUMN tool_calls TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # column already exists


def _status_counts(conn, table: str) -> dict:
    return {r["status"]: r["c"] for r in conn.execute(
        f"SELECT status, COUNT(*) AS c FROM {table} GROUP BY status"
    )}


def _night_mode(conn) -> bool:
    row = conn.execute(
        "SELECT value FROM settings WHERE key = 'night_mode'"
    ).fetchone()
    return bool(row and str(row["value"]).lower() in ("1", "true", "yes", "on"))


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
        f"- Night watch (auto-approve): "
        + ("ARMED — your proposals take effect immediately"
           if _night_mode(conn)
           else "off — your proposals wait for operator approval"),
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
        "- Use your query tools for exact ids, callsigns, vitals, kit status "
        "and telemetry before proposing anything.",
    ]
    return "\n".join(lines)


SYSTEM_PROMPT = """You are SIREN-1, the dispatch copilot for Siren Central fire station \
(SIREN emergency dispatch console). You answer the incident commander's \
questions AND act on the operations database through your tools.

Tools — query: get_fleet_status, get_personnel, get_incidents, get_equipment, \
get_dispatches, get_telemetry, get_events. Tools — act: propose_dispatch, \
create_incident, update_incident, contact_external_service.

Rules of engagement:
- propose_dispatch is the ONLY way you move units. It files a PENDING \
proposal — the control-room operator approves or rejects it. Never claim \
units are rolling unless the tool reports auto_approved.
- Night watch: while the station's night mode is armed, your proposals \
auto-approve. You CANNOT toggle night watch — only the operator's switch \
controls it. If the operator asks you to change it, tell them it's a \
manual-only control.
- Query before you act: pull real ids (VEH-##, PER-##, EQ-##, INC-###) via \
the query tools — never invent ids, callsigns, numbers or statuses. If the \
data isn't there, say so plainly.
- contact_external_service only logs that an agency was notified — Siren \
does not monitor external services afterwards.
- Be terse, precise, operational — radio voice. Report what you did in \
plain terms: tool name, id, outcome."""


def _history_messages(conn, exclude_id: Optional[int]) -> List[dict]:
    # exclude_id skips the just-persisted user message — it's appended
    # explicitly by the caller and would otherwise appear twice.
    history = rows_dicts(conn.execute(
        "SELECT id, role, content FROM chat_messages ORDER BY id DESC LIMIT ?",
        (HISTORY_LIMIT + 1,),
    ))
    history = [h for h in history if h["id"] != exclude_id][:HISTORY_LIMIT]
    history.reverse()  # chronological
    return [{"role": h["role"], "content": h["content"]} for h in history]


def _llm_turn(conn, user_message: str,
              exclude_id: Optional[int] = None) -> Tuple[str, List[dict]]:
    """Run the agent loop. Returns (reply, tool_call_records).

    Each record: {name, args, summary} — summary is the one-line operator
    record produced by chat_tools.execute_tool.
    """
    api_key = env.get("VOIDAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM unavailable: VOIDAI_API_KEY is not configured (server/.env)",
        )
    base_url = env.get("VOIDAI_BASE_URL")
    model = env.get("VOIDAI_MODEL", "gpt-5-nano")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\n" + _snapshot(conn)},
        *_history_messages(conn, exclude_id),
        {"role": "user", "content": user_message},
    ]

    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="LLM unavailable: 'openai' package not installed",
        )

    client = OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)
    records: List[dict] = []
    reply = ""

    def _completion(**kwargs):
        try:
            return client.chat.completions.create(model=model,
                                                  messages=messages, **kwargs)
        except Exception as exc:
            raise HTTPException(
                status_code=503, detail=f"LLM request failed: {exc}"
            )

    for _ in range(MAX_TOOL_ITERATIONS):
        resp = _completion(tools=TOOLS)
        msg = resp.choices[0].message
        if not msg.tool_calls:
            reply = (msg.content or "").strip()
            break
        # assistant turn that carries the tool calls
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name,
                              "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
                if not isinstance(args, dict):
                    args = {}
            except json.JSONDecodeError:
                args = {}
            result, summary = execute_tool(conn, name, args)
            records.append({"name": name, "args": args, "summary": summary})
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": name,
                "content": json.dumps(result, default=str),
            })
    else:
        # Iteration cap hit while still tool-calling — force a plain answer.
        resp = _completion()
        reply = (resp.choices[0].message.content or "").strip()

    if not reply:
        raise HTTPException(
            status_code=503, detail="LLM returned an empty reply"
        )
    return reply, records


@router.post("/chat")
def chat(body: ChatIn):
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="message must not be empty")
    conn = get_conn()
    try:
        _ensure_tool_calls_col(conn)
        user_ts = now_iso()
        cur = conn.execute(
            "INSERT INTO chat_messages(role,content,ts) VALUES(?,?,?)",
            ("user", message, user_ts),
        )
        conn.commit()

        reply, records = _llm_turn(conn, message, exclude_id=cur.lastrowid)
        reply_ts = now_iso()
        conn.execute(
            """INSERT INTO chat_messages(role,content,ts,tool_calls)
               VALUES(?,?,?,?)""",
            ("assistant", reply, reply_ts,
             json.dumps(records) if records else None),
        )
        conn.commit()
        return {"reply": reply, "ts": reply_ts, "tool_calls": records}
    finally:
        conn.close()


def _parse_tool_calls(row: dict) -> dict:
    """tool_calls is stored as JSON text; return it as an array."""
    raw = row.get("tool_calls")
    try:
        parsed = json.loads(raw) if raw else []
        row["tool_calls"] = parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        row["tool_calls"] = []
    return row


@router.get("/chat/history")
def chat_history():
    conn = get_conn()
    try:
        _ensure_tool_calls_col(conn)
        return [_parse_tool_calls(r) for r in rows_dicts(conn.execute(
            "SELECT * FROM chat_messages ORDER BY id"
        ).fetchall())]
    finally:
        conn.close()
