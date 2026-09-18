"""Pytest fixtures — FastAPI TestClient against a throwaway SQLite DB."""
import os
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

# Keep the world frozen during tests (no 4s simulator ticks mutating state).
os.environ["SIREN_DISABLE_SIM"] = "1"

# Pull VOIDAI_* from server/.env at collection time so the real-LLM test's
# skipif sees the key.
import env

env.load()


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    db_dir = tmp_path_factory.mktemp("sirendb")
    os.environ["SIREN_DB"] = str(db_dir / "siren_test.db")

    from db import init_db
    from seed import seed_if_empty

    init_db()
    seed_if_empty()

    from app import app
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def make_incident(client):
    """Create an incident via the real tool path; returns its INC-### id."""
    from chat_tools import create_incident
    from db import get_conn

    def _make(**overrides):
        args = {
            "classification": "Structure Fire — Test",
            "priority": "P1",
            "address": "1 Test Lane",
            **overrides,
        }
        conn = get_conn()
        try:
            result, _ = create_incident(conn, args)
            conn.commit()
            return result["incident_id"]
        finally:
            conn.close()

    return _make


@pytest.fixture()
def make_pending_dispatch(client):
    """Insert a pending dispatch + join rows; returns the dispatch id."""
    from db import get_conn, now_iso

    def _make(incident_id, dispatch_id="DSP-900",
              vehicles=(), personnel=(), equipment=()):
        conn = get_conn()
        try:
            conn.execute(
                """INSERT INTO dispatches(id,incident_id,status,proposed_by,
                   notes,created_at,decided_at)
                   VALUES(?,?,'pending','agent','test dispatch',?,NULL)""",
                (dispatch_id, incident_id, now_iso()),
            )
            for vid in vehicles:
                conn.execute(
                    "INSERT INTO dispatch_vehicles(dispatch_id,vehicle_id) VALUES(?,?)",
                    (dispatch_id, vid))
            for pid in personnel:
                conn.execute(
                    "INSERT INTO dispatch_personnel(dispatch_id,personnel_id) VALUES(?,?)",
                    (dispatch_id, pid))
            for eid in equipment:
                conn.execute(
                    "INSERT INTO dispatch_equipment(dispatch_id,equipment_id) VALUES(?,?)",
                    (dispatch_id, eid))
            conn.commit()
            return dispatch_id
        finally:
            conn.close()

    return _make
