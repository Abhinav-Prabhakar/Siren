"""SIREN-1 chat tool executors — unit tests on the seeded temp DB.

Runs execute_tool() directly (no LLM calls). Uses the session `client`
fixture so SIREN_DB points at the seeded throwaway DB; handlers get a real
sqlite conn via db.get_conn(), same pattern as test_night_mode_auto_approve.
The seed ships no incidents — tests create their own via make_incident.
"""
import json

import pytest


@pytest.fixture()
def conn(client):
    """Yield a sqlite conn to the seeded test DB (fixture forces client up)."""
    from db import get_conn
    c = get_conn()
    try:
        yield c
    finally:
        c.close()


def _run(conn, name, args):
    from chat_tools import execute_tool
    return execute_tool(conn, name, args)


# ------------------------------------------------------------------ queries

def test_tool_get_fleet_status(conn):
    result, summary = _run(conn, "get_fleet_status", {})
    assert result["count"] == 8
    assert sum(result["by_status"].values()) == 8
    v = result["vehicles"][0]
    assert {"id", "callsign", "type", "status", "fuel_pct"} <= set(v)
    assert "8 unit(s)" in summary


def test_tool_get_fleet_status_filtered(conn):
    result, _ = _run(conn, "get_fleet_status", {"status": "available"})
    assert result["count"] == len(result["vehicles"]) > 0
    assert all(v["status"] == "available" for v in result["vehicles"])


def test_tool_get_incidents_parses_contacts(conn, make_incident):
    iid = make_incident()
    conn.execute(
        "UPDATE incidents SET external_contacts = ? WHERE id = ?",
        (json.dumps([{"service": "utility", "ts": "2025-01-01T00:00:00Z"}]),
         iid),
    )
    conn.commit()

    result, _ = _run(conn, "get_incidents", {"status": "active"})
    assert result["count"] >= 1
    inc = next(i for i in result["incidents"] if i["id"] == iid)
    assert isinstance(inc["external_contacts"], list)
    assert inc["external_contacts"][0]["service"] == "utility"
    assert inc["unit_count"] == 0
    assert inc["call_count"] == 0


def test_tool_get_telemetry(conn):
    result, summary = _run(conn, "get_telemetry", {
        "entity_type": "vehicle", "entity_id": "VEH-01",
        "metric": "fuel_pct", "limit": 10,
    })
    assert result["count"] >= 1
    assert all(p["metric"] == "fuel_pct" for p in result["points"])
    assert "VEH-01" in summary


def test_tool_get_telemetry_bad_entity_type(conn):
    result, summary = _run(conn, "get_telemetry", {
        "entity_type": "dragon", "entity_id": "VEH-01",
    })
    assert "error" in result
    assert "entity_type" in result["error"]


def test_tool_get_events_and_equipment(conn):
    result, _ = _run(conn, "get_events", {"limit": 5})
    assert result["count"] == 5
    assert {"ts", "tag", "message", "tone"} <= set(result["events"][0])

    flagged, summary = _run(conn, "get_equipment", {"flagged": True})
    ids = {e["id"] for e in flagged["equipment"]}
    assert "EQ-29" in ids  # maintenance
    assert "(flagged)" in summary


def test_tool_unknown(conn):
    result, summary = _run(conn, "launch_missiles", {})
    assert "error" in result
    assert "unknown tool" in result["error"]


# ------------------------------------------------------------------ actions

def test_tool_create_incident(conn):
    result, summary = _run(conn, "create_incident", {
        "classification": "Gas Leak — Commercial",
        "priority": "P2",
        "address": "9 Cinder Court",
        "wind": "12 km/h",
        "wind_dir": "S",
        "temp_c": 11.5,
        "notes": "Caller reports strong gas smell in basement.",
    })
    iid = result["incident_id"]
    assert iid.startswith("INC-")
    assert result["status"] == "active"
    assert iid in summary

    row = conn.execute(
        "SELECT * FROM incidents WHERE id = ?", (iid,)
    ).fetchone()
    assert row["classification"] == "Gas Leak — Commercial"
    assert row["priority"] == "P2"
    assert row["status"] == "active"
    assert row["reported_at"]

    ev = conn.execute(
        "SELECT tag, message FROM events WHERE message LIKE ?",
        (f"{iid}%",),
    ).fetchone()
    assert ev is not None


def test_tool_create_incident_validation(conn):
    result, _ = _run(conn, "create_incident", {
        "classification": "x", "priority": "P9", "address": "y",
    })
    assert "error" in result
    result, _ = _run(conn, "create_incident", {"priority": "P1"})
    assert "error" in result


def test_tool_update_incident(conn):
    result, _ = _run(conn, "get_incidents", {"status": "active"})
    iid = next(i["id"] for i in result["incidents"]
               if i["classification"] == "Gas Leak — Commercial")

    result, summary = _run(conn, "update_incident", {
        "incident_id": iid, "status": "contained", "priority": "P3",
    })
    assert result["incident_id"] == iid
    row = conn.execute(
        "SELECT status, priority, resolved_at FROM incidents WHERE id = ?",
        (iid,),
    ).fetchone()
    assert row["status"] == "contained"
    assert row["priority"] == "P3"
    assert row["resolved_at"] is None


def test_tool_update_incident_resolved_releases_units(conn, make_incident):
    iid = make_incident()
    # attach a vehicle, then resolve through the tool
    conn.execute(
        "UPDATE vehicles SET status='on_scene', incident_id=? WHERE id='VEH-08'",
        (iid,),
    )
    conn.commit()

    result, summary = _run(conn, "update_incident", {
        "incident_id": iid, "status": "resolved",
    })
    assert result["units_released"] >= 1

    row = conn.execute(
        "SELECT status, resolved_at FROM incidents WHERE id=?", (iid,)
    ).fetchone()
    assert row["status"] == "resolved"
    assert row["resolved_at"]

    v = conn.execute("SELECT status FROM vehicles WHERE id='VEH-08'").fetchone()
    assert v["status"] == "returning"


def test_tool_update_incident_errors(conn, make_incident):
    iid = make_incident()
    result, _ = _run(conn, "update_incident", {"incident_id": "INC-XX",
                                             "status": "active"})
    assert "not found" in result["error"]
    result, _ = _run(conn, "update_incident", {"incident_id": iid})
    assert "nothing to update" in result["error"]
    result, _ = _run(conn, "update_incident", {"incident_id": iid,
                                             "status": "exploded"})
    assert "error" in result


def test_tool_contact_external_service(conn, make_incident):
    iid = make_incident()
    result, summary = _run(conn, "contact_external_service", {
        "incident_id": iid, "service": "gas",
    })
    contacts = result["external_contacts"]
    assert contacts[-1]["service"] == "gas"
    assert contacts[-1]["ts"]
    assert f"gas notified on {iid}" in summary

    raw = conn.execute(
        "SELECT external_contacts FROM incidents WHERE id=?", (iid,)
    ).fetchone()["external_contacts"]
    assert json.loads(raw)[-1]["service"] == "gas"

    ev = conn.execute(
        "SELECT tag FROM events WHERE tag='EXT' AND message LIKE '%gas%'"
    ).fetchone()
    assert ev is not None

    result, _ = _run(conn, "contact_external_service", {
        "incident_id": "INC-XX", "service": "ems",
    })
    assert "not found" in result["error"]


def test_tool_propose_dispatch_pending(conn, make_incident):
    iid = make_incident()
    result, summary = _run(conn, "propose_dispatch", {
        "incident_id": iid,
        "personnel_ids": ["PER-02"],
        "equipment_ids": ["EQ-08"],
        "notes": "Chief + spare PPE to the P1.",
    })
    d = result["dispatch"]
    assert d["status"] == "pending"
    assert d["proposed_by"] == "agent"
    assert d["incident_id"] == iid
    assert d["personnel_ids"] == ["PER-02"]
    assert d["equipment_ids"] == ["EQ-08"]
    assert result["awaiting_operator"] is True
    assert result["auto_approved"] is False
    assert d["id"] in summary
    assert "pending operator approval" in summary

    # join rows + proposal event landed
    assert conn.execute(
        "SELECT COUNT(*) AS c FROM dispatch_personnel WHERE dispatch_id = ?",
        (d["id"],),
    ).fetchone()["c"] == 1
    ev = conn.execute(
        "SELECT tag, message FROM events WHERE message LIKE ?",
        (f"%{d['id']}%",),
    ).fetchone()
    assert ev is not None and "awaiting operator approval" in ev["message"]


def test_tool_propose_dispatch_validation(conn, make_incident):
    iid = make_incident()
    result, _ = _run(conn, "propose_dispatch", {
        "incident_id": "INC-XX", "vehicle_ids": ["VEH-03"],
    })
    assert "not found" in result["error"]

    result, _ = _run(conn, "propose_dispatch", {"incident_id": iid})
    assert "at least one" in result["error"]

    result, _ = _run(conn, "propose_dispatch", {
        "incident_id": iid, "vehicle_ids": ["VEH-XX"],
    })
    assert "VEH-XX" in result["error"]

    # resolved incident refuses
    _run(conn, "update_incident", {"incident_id": iid, "status": "resolved"})
    result, _ = _run(conn, "propose_dispatch", {
        "incident_id": iid, "vehicle_ids": ["VEH-03"],
    })
    assert "resolved" in result["error"]


def test_tool_propose_dispatch_warns_on_busy(conn, make_incident):
    iid = make_incident()
    # put resources into non-expected states to exercise the soft warnings
    conn.execute("UPDATE vehicles SET status='on_scene' WHERE id='VEH-01'")
    conn.execute("UPDATE equipment SET status='in_use' WHERE id='EQ-01'")
    conn.commit()  # PER-14 is 'resting' in the seed

    result, _ = _run(conn, "propose_dispatch", {
        "incident_id": iid,
        "vehicle_ids": ["VEH-01"],      # on_scene, not available
        "personnel_ids": ["PER-14"],    # resting, not on_duty
        "equipment_ids": ["EQ-01"],     # in_use, not ready
    })
    warnings = result.get("warnings", [])
    assert any("VEH-01" in w for w in warnings)
    assert any("PER-14" in w for w in warnings)
    assert any("EQ-01" in w for w in warnings)


def test_tool_night_mode_auto_approve(conn, make_incident):
    iid = make_incident()
    # arm night watch directly in settings (the tool can't touch it by design)
    conn.execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES('night_mode','true')"
    )
    conn.commit()
    try:
        result, summary = _run(conn, "propose_dispatch", {
            "incident_id": iid,
            "vehicle_ids": ["VEH-03"],
            "personnel_ids": ["PER-09"],
        })
        assert result["auto_approved"] is True
        assert result["dispatch"]["status"] == "approved"
        assert "auto-approved" in summary

        v = conn.execute(
            "SELECT status, incident_id FROM vehicles WHERE id='VEH-03'"
        ).fetchone()
        assert v["status"] == "dispatched"
        assert v["incident_id"] == iid
        p = conn.execute(
            "SELECT status FROM personnel WHERE id='PER-09'"
        ).fetchone()
        assert p["status"] == "dispatched"

        ev = conn.execute(
            "SELECT tag, message FROM events WHERE tag='NIGHT' "
            "AND message LIKE ?",
            (f"%{result['dispatch']['id']}%",),
        ).fetchone()
        assert ev is not None
    finally:
        conn.execute(
            "INSERT OR REPLACE INTO settings(key, value) "
            "VALUES('night_mode','false')"
        )
        conn.commit()


# ------------------------------------------------------------- history shape

def test_chat_history_tool_calls_parsed(client, conn):
    """Assistant rows persist a JSON tool-call record; history returns arrays."""
    from routers.chat import _ensure_tool_calls_col
    _ensure_tool_calls_col(conn)
    conn.execute(
        """INSERT INTO chat_messages(role,content,ts,tool_calls)
           VALUES('assistant','Done.','2025-01-01T00:00:00Z',?)""",
        (json.dumps([{"name": "propose_dispatch",
                      "args": {"incident_id": "INC-001"},
                      "summary": "DSP-999 → INC-001 pending operator approval"}]),),
    )
    conn.execute(
        "INSERT INTO chat_messages(role,content,ts) "
        "VALUES('user','hi','2025-01-01T00:00:01Z')"
    )
    conn.commit()

    r = client.get("/api/chat/history")
    assert r.status_code == 200
    rows = r.json()
    assistant = next(m for m in reversed(rows) if m["role"] == "assistant")
    assert isinstance(assistant["tool_calls"], list)
    assert assistant["tool_calls"][0]["name"] == "propose_dispatch"
    assert assistant["tool_calls"][0]["summary"].startswith("DSP-999")
    # plain user rows get an empty array, not null
    user = rows[-1]
    assert user["role"] == "user" and user["tool_calls"] == []
