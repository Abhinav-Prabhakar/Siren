import json
import uuid


def _post(client, message):
    r = client.post("/api/vapi/webhook", json={"message": message})
    assert r.status_code == 200
    return r.json()


def _start_call(client, vapi_call_id):
    _post(client, {
        "type": "status-update",
        "status": "in-progress",
        "call": {"id": vapi_call_id, "status": "in-progress"},
    })


def _nested_tool_call(vapi_call_id, tool_call_id, name, arguments):
    return {
        "type": "tool-calls",
        "call": {"id": vapi_call_id},
        "toolCallList": [
            {
                "id": tool_call_id,
                "type": "function",
                "function": {"name": name, "arguments": arguments},
            }
        ],
    }


def _run_tool(client, vapi_call_id, tool_call_id, name, arguments):
    body = _post(client, _nested_tool_call(vapi_call_id, tool_call_id, name, arguments))
    results = body["results"]
    assert len(results) == 1
    assert results[0]["toolCallId"] == tool_call_id
    result = json.loads(results[0]["result"])
    assert "error" not in result
    return result


def _pending_dispatches(client, incident_id):
    inc = client.get(f"/api/incidents/{incident_id}").json()
    return [d for d in inc["dispatches"] if d["status"] == "pending"]


def test_create_incident_dispatch_approve_flow(client):
    vapi_call_id = f"call-{uuid.uuid4().hex[:8]}"
    address = f"{uuid.uuid4().hex[:6]} Ember Court"
    _start_call(client, vapi_call_id)

    created = _run_tool(
        client, vapi_call_id, "tc-create", "create_incident",
        json.dumps({
            "classification": "structure_fire",
            "priority": "P1",
            "address": address,
        }),
    )
    assert created["matched_existing"] is False
    incident_id = created["incident_id"]

    dispatch = created["dispatch"]
    assert "error" not in dispatch
    assert dispatch["status"] == "pending"
    dispatch_id = dispatch["dispatch_id"]

    inc = client.get(f"/api/incidents/{incident_id}").json()
    assert inc["id"] == incident_id
    assert inc["address"] == address
    assert any(c["vapi_call_id"] == vapi_call_id for c in inc["calls"])

    pending = _pending_dispatches(client, incident_id)
    assert len(pending) == 1
    assert pending[0]["id"] == dispatch_id
    assert pending[0]["vehicle_ids"] or pending[0]["personnel_ids"]

    reused = _run_tool(
        client, vapi_call_id, "tc-dispatch", "dispatch_units",
        json.dumps({"incident_id": incident_id}),
    )
    assert reused["dispatch_id"] == dispatch_id
    assert reused["reused_pending"] is True
    assert len(_pending_dispatches(client, incident_id)) == 1

    r = client.post(f"/api/dispatches/{dispatch_id}/approve")
    assert r.status_code == 200
    approved = r.json()
    assert approved["status"] == "approved"

    for vid in approved["vehicle_ids"]:
        v = client.get(f"/api/vehicles/{vid}").json()
        assert v["status"] == "dispatched"
        assert v["incident_id"] == incident_id
    for pid in approved["personnel_ids"]:
        p = client.get(f"/api/personnel/{pid}").json()
        assert p["status"] == "dispatched"
        assert p["incident_id"] == incident_id
    for eid in approved["equipment_ids"]:
        e = client.get(f"/api/equipment/{eid}").json()
        assert e["status"] == "in_use"

    events = client.get("/api/events", params={"limit": 200}).json()
    assert any(
        e["tag"] == "DISPATCH" and "approved" in e["message"] and dispatch_id in e["message"]
        for e in events
    )


def test_existing_address_reuses_pending_dispatch(client):
    vapi_call_id = f"call-{uuid.uuid4().hex[:8]}"
    address = f"{uuid.uuid4().hex[:6]} Cinder Way"
    _start_call(client, vapi_call_id)

    first = _run_tool(
        client, vapi_call_id, "tc-c1", "create_incident",
        json.dumps({"classification": "medical", "priority": "P2", "address": address}),
    )
    dispatch_id = first["dispatch"]["dispatch_id"]

    second = _run_tool(
        client, vapi_call_id, "tc-c2", "create_incident",
        json.dumps({"classification": "medical", "priority": "P2", "address": address}),
    )
    assert second["incident_id"] == first["incident_id"]
    assert second["matched_existing"] is True
    assert second["dispatch"]["dispatch_id"] == dispatch_id
    assert second["dispatch"]["reused_pending"] is True
    assert len(_pending_dispatches(client, first["incident_id"])) == 1


def test_legacy_toplevel_tool_call_shape(client):
    vapi_call_id = f"call-{uuid.uuid4().hex[:8]}"
    address = f"{uuid.uuid4().hex[:6]} Legacy Road"
    _start_call(client, vapi_call_id)

    body = _post(client, {
        "type": "tool-calls",
        "call": {"id": vapi_call_id},
        "toolCallList": [
            {
                "id": "tc-legacy",
                "name": "create_incident",
                "arguments": json.dumps({
                    "classification": "alarm",
                    "priority": "P3",
                    "address": address,
                }),
            }
        ],
    })
    result = json.loads(body["results"][0]["result"])
    assert "error" not in result
    assert result["incident_id"].startswith("INC-")
    assert client.get(f"/api/incidents/{result['incident_id']}").status_code == 200
