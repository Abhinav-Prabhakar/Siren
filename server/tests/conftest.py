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
