"""SIREN API contract tests — ordered: read-only checks first, mutations after.

The session-scoped `client` fixture serves a freshly seeded temp DB, so the
mutation tests (approve/reject/create/night-mode) must come after the
read-only assertions. The seed ships no incidents/dispatches — tests that
need them create their own via the make_incident / make_pending_dispatch
fixtures.
"""
import json
import os

import pytest


# ---------------------------------------------------------------- read-only

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_overview(client):
    r = client.get("/api/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["station"]["id"] == "STA-01"
    counts = body["counts"]
    assert counts["vehicles"]["available"] == 8
    assert sum(counts["vehicles"].values()) == 8
    assert counts["personnel"]["on_duty"] == 13
    assert sum(counts["personnel"].values()) == 14
    assert sum(counts["equipment"].values()) == 30
    assert counts["active_incidents"] == 0
    assert counts["pending_dispatches"] == 0
    assert counts["live_calls"] == 0
    assert isinstance(body["latest_events"], list) and body["latest_events"]


def test_vehicles(client):
    r = client.get("/api/vehicles")
    assert r.status_code == 200
    vehicles = r.json()
    assert len(vehicles) == 8
    assert all(v["status"] == "available" for v in vehicles)
    assert {"id", "callsign", "type", "status", "fuel_pct"} <= set(vehicles[0])

    r = client.get("/api/vehicles/VEH-01")
    assert r.status_code == 200
    v = r.json()
    assert v["id"] == "VEH-01"
    assert isinstance(v["crew"], list) and len(v["crew"]) >= 1
    assert isinstance(v["equipment"], list)

    assert client.get("/api/vehicles/VEH-XX").status_code == 404


def test_personnel(client):
    r = client.get("/api/personnel")
    assert r.status_code == 200
    assert len(r.json()) == 14

    r = client.get("/api/personnel?status=on_duty")
    assert all(p["status"] == "on_duty" for p in r.json())

    r = client.get("/api/personnel/PER-01")
    assert r.status_code == 200
    p = r.json()
    assert p["name"] == "Dana Reyes"
    assert p["vehicle_name"] == "Command 1"
    assert p["incident_address"] is None

    assert client.get("/api/personnel/PER-XX").status_code == 404


def test_equipment(client):
    r = client.get("/api/equipment")
    assert r.status_code == 200
    assert len(r.json()) == 30

    r = client.get("/api/equipment?category=scba")
    assert all(e["category"] == "scba" for e in r.json())

    r = client.get("/api/equipment/EQ-01")
    assert r.status_code == 200
    e = r.json()
    assert e["vehicle_name"] == "Engine 1"
    assert e["station_name"] == "Siren Central"

    assert client.get("/api/equipment/EQ-XX").status_code == 404


def test_incidents(client, make_incident):
    iid1 = make_incident(
        classification="Structure Fire — Residential",
        priority="P1", address="812 Ashgrove Lane")
    iid2 = make_incident(
        classification="Motor Vehicle Accident — Entrapment",
        priority="P2", address="Harbor Blvd & 9th St")

    # contacts arrive as a parsed array — plant one via SQL
    from db import get_conn
    conn = get_conn()
    conn.execute(
        "UPDATE incidents SET external_contacts = ? WHERE id = ?",
        (json.dumps([{"service": "utility", "ts": "2025-01-01T00:00:00Z"}]),
         iid1),
    )
    conn.commit()
    conn.close()

    r = client.get("/api/incidents")
    assert r.status_code == 200
    incidents = r.json()
    assert len(incidents) == 2
    inc1 = next(i for i in incidents if i["id"] == iid1)
    assert inc1["call_count"] == 0
    assert inc1["unit_count"] == 0
    assert isinstance(inc1["external_contacts"], list)
    assert inc1["external_contacts"][0]["service"] == "utility"

    r = client.get("/api/incidents?status=active")
    assert {i["id"] for i in r.json()} == {iid1, iid2}

    r = client.get(f"/api/incidents/{iid1}")
    assert r.status_code == 200
    detail = r.json()
    assert isinstance(detail["external_contacts"], list)
    assert isinstance(detail["calls"], list)
    assert isinstance(detail["vehicles"], list)
    assert isinstance(detail["dispatches"], list)
    assert isinstance(detail["personnel"], list)

    assert client.get("/api/incidents/INC-XX").status_code == 404


def test_calls(client):
    r = client.get("/api/calls")
    assert r.status_code == 200
    assert r.json() == []


def test_dispatches_list(client, make_incident, make_pending_dispatch):
    iid = make_incident(priority="P1", address="812 Ashgrove Lane")
    did = make_pending_dispatch(
        iid, dispatch_id="DSP-903",
        vehicles=["VEH-03"], personnel=["PER-08", "PER-09"])

    r = client.get("/api/dispatches")
    assert r.status_code == 200
    dsps = r.json()
    d = next(d for d in dsps if d["id"] == did)
    assert d["status"] == "pending"
    assert d["proposed_by"] == "agent"
    assert d["vehicle_ids"] == ["VEH-03"]
    assert set(d["personnel_ids"]) == {"PER-08", "PER-09"}
    assert d["incident_address"] == "812 Ashgrove Lane"
    assert d["incident_priority"] == "P1"

    r = client.get("/api/dispatches?status=pending")
    assert len(r.json()) >= 1


def test_telemetry(client):
    r = client.get("/api/telemetry/vehicle/VEH-01?metric=fuel_pct")
    assert r.status_code == 200
    pts = r.json()
    assert len(pts) >= 10
    assert {"metric", "value", "ts"} <= set(pts[0])
    assert pts[0]["metric"] == "fuel_pct"
    assert all(isinstance(p["value"], (int, float)) for p in pts)


def test_events(client):
    r = client.get("/api/events?limit=50")
    assert r.status_code == 200
    ev = r.json()
    assert len(ev) >= 5
    assert {"ts", "tag", "message", "tone"} <= set(ev[0])
    # newest-last
    assert ev[-1]["ts"] >= ev[0]["ts"]


def test_chat_history_empty_or_list(client):
    r = client.get("/api/chat/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_settings_default(client):
    r = client.get("/api/settings")
    assert r.status_code == 200
    assert r.json() == {"night_mode": False}


# ---------------------------------------------------------------- mutations

def test_dispatch_approve_side_effects(client, make_incident,
                                       make_pending_dispatch):
    iid = make_incident()
    did = make_pending_dispatch(
        iid, dispatch_id="DSP-901",
        vehicles=["VEH-03"], personnel=["PER-08"], equipment=["EQ-12"])

    r = client.post(f"/api/dispatches/{did}/approve")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "approved"
    assert d["decided_at"]

    v = client.get("/api/vehicles/VEH-03").json()
    assert v["status"] == "dispatched"
    assert v["incident_id"] == iid
    p = client.get("/api/personnel/PER-08").json()
    assert p["status"] == "dispatched"
    assert p["incident_id"] == iid
    e = client.get("/api/equipment/EQ-12").json()
    assert e["status"] == "in_use"

    assert client.post("/api/dispatches/DSP-XX/approve").status_code == 404


def test_dispatch_reject_side_effects(client, make_incident,
                                      make_pending_dispatch):
    iid = make_incident()
    did = make_pending_dispatch(
        iid, dispatch_id="DSP-902", vehicles=["VEH-05"])

    r = client.post(f"/api/dispatches/{did}/reject")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "rejected"
    assert d["decided_at"]
    # assigned unit untouched
    v = client.get("/api/vehicles/VEH-05").json()
    assert v["status"] == "available"
    assert v["incident_id"] is None

    assert client.post("/api/dispatches/DSP-XX/reject").status_code == 404


def test_manual_dispatch(client, make_incident):
    iid = make_incident()
    r = client.post("/api/dispatches", json={
        "incident_id": iid,
        "vehicle_ids": ["VEH-06"],
        "personnel_ids": ["PER-12"],
        "equipment_ids": ["EQ-25"],
        "notes": "Operator dispatch: hazmat support for fuel spill.",
    })
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "approved"
    assert d["proposed_by"] == "operator"
    assert d["incident_id"] == iid
    assert d["vehicle_ids"] == ["VEH-06"]

    v = client.get("/api/vehicles/VEH-06").json()
    assert v["status"] == "dispatched"
    assert v["incident_id"] == iid
    p = client.get("/api/personnel/PER-12").json()
    assert p["status"] == "dispatched"
    assert p["vehicle_id"] == "VEH-06"  # crew rides first assigned vehicle
    e = client.get("/api/equipment/EQ-25").json()
    assert e["status"] == "in_use"

    # OPS event written
    ev = client.get("/api/events?limit=5").json()
    assert any(x["tag"] == "OPS" and d["id"] in x["message"] for x in ev)


def test_manual_dispatch_validation(client, make_incident):
    iid = make_incident()
    assert client.post("/api/dispatches", json={
        "incident_id": "INC-XX", "vehicle_ids": ["VEH-05"],
    }).status_code == 404
    r = client.post("/api/dispatches", json={
        "incident_id": iid, "vehicle_ids": ["VEH-XX"],
    })
    assert r.status_code == 422
    assert "VEH-XX" in r.json()["detail"]
    assert client.post("/api/dispatches", json={
        "incident_id": iid,
    }).status_code == 422


def test_contact_endpoint(client, make_incident):
    iid = make_incident()
    r = client.post(f"/api/incidents/{iid}/contact", json={"service": "gas"})
    assert r.status_code == 200
    inc = r.json()
    assert isinstance(inc["external_contacts"], list)
    assert inc["external_contacts"][-1]["service"] == "gas"
    assert inc["external_contacts"][-1]["ts"]

    assert client.post(
        "/api/incidents/INC-XX/contact", json={"service": "ems"}
    ).status_code == 404


def test_incident_report_pdf(client, make_incident):
    iid = make_incident()
    r = client.get(f"/api/incidents/{iid}/report")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"]
    assert f"{iid}-report.pdf" in r.headers["content-disposition"]
    assert r.content[:5] == b"%PDF-"
    assert len(r.content) > 500

    assert client.get("/api/incidents/INC-XX/report").status_code == 404


def test_night_mode_auto_approve(client, make_incident,
                                 make_pending_dispatch):
    iid = make_incident()
    did = make_pending_dispatch(
        iid, dispatch_id="DSP-900", vehicles=["VEH-05"])

    r = client.post("/api/settings/night-mode", json={"enabled": True})
    assert r.status_code == 200
    body = r.json()
    assert body["night_mode"] is True
    assert did in body["auto_approved"]

    assert client.get("/api/settings").json()["night_mode"] is True
    assert client.get("/api/dispatches?status=pending").json() == []
    v = client.get("/api/vehicles/VEH-05").json()
    assert v["status"] == "dispatched"
    assert v["incident_id"] == iid

    ev = client.get("/api/events?limit=10").json()
    assert any(x["tag"] == "NIGHT" for x in ev)

    # leave night mode off for any later tests / cleanliness
    r = client.post("/api/settings/night-mode", json={"enabled": False})
    assert r.json()["night_mode"] is False


# ---------------------------------------------------------------- chat

def test_chat_503_without_key(client, monkeypatch):
    monkeypatch.delenv("VOIDAI_API_KEY", raising=False)
    r = client.post("/api/chat", json={"message": "status?"})
    assert r.status_code == 503
    assert "VOIDAI_API_KEY" in r.json()["detail"]


@pytest.mark.skipif(
    not os.environ.get("VOIDAI_API_KEY"),
    reason="VOIDAI_API_KEY not configured — skipping the one real LLM call",
)
def test_chat_real_llm(client):
    """The suite's single real LLM call — proves the pipeline works end to end."""
    r = client.post("/api/chat", json={
        "message": "Reply with exactly one word: READY"
    })
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["reply"], str) and body["reply"].strip()
    assert body["ts"]

    history = client.get("/api/chat/history").json()
    assert history[-1]["role"] == "assistant"
    assert history[-2]["role"] == "user"


def test_chat_stream_503_without_key(client, monkeypatch):
    monkeypatch.delenv("VOIDAI_API_KEY", raising=False)
    r = client.post("/api/chat/stream", json={"message": "status?"})
    assert r.status_code == 503
    assert "VOIDAI_API_KEY" in r.json()["detail"]


def test_chat_stream_validation(client):
    assert client.post("/api/chat/stream", json={"message": "  "}).status_code == 422


def test_chat_history_clear(client):
    # guaranteed non-empty: the 503 tests above persisted user rows
    r = client.delete("/api/chat/history")
    assert r.status_code == 200
    assert r.json()["cleared"] >= 1
    assert client.get("/api/chat/history").json() == []
