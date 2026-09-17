"""SQLite access layer for SIREN.

stdlib sqlite3 only. DB lives at server/siren.db. Timestamps are ISO-8601 UTC
strings with a trailing Z (parseable by Date.parse in the frontend).
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "siren.db"


def now_iso() -> str:
    """Current UTC time as ISO-8601 with Z suffix."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def row_dict(row):
    return dict(row) if row is not None else None


def rows_dicts(rows):
    return [dict(r) for r in rows]


SCHEMA = """
CREATE TABLE IF NOT EXISTS stations(
  id TEXT PRIMARY KEY,
  name TEXT,
  code TEXT,
  address TEXT,
  lat REAL,
  lng REAL
);

CREATE TABLE IF NOT EXISTS vehicles(
  id TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id),
  name TEXT,
  callsign TEXT,
  type TEXT,
  status TEXT,
  fuel_pct REAL,
  water_pct REAL,
  foam_pct REAL,
  battery_v REAL,
  mileage_km REAL,
  pump_pressure_bar REAL,
  lat REAL,
  lng REAL,
  speed_kmh REAL,
  incident_id TEXT,
  free_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS personnel(
  id TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id),
  name TEXT,
  role TEXT,
  rank TEXT,
  status TEXT,
  vehicle_id TEXT,
  incident_id TEXT,
  heart_rate INT,
  scba_pct REAL,
  lat REAL,
  lng REAL,
  shift_start TEXT,
  shift_end TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS equipment(
  id TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id),
  vehicle_id TEXT,
  name TEXT,
  category TEXT,
  status TEXT,
  battery_pct REAL,
  condition_pct REAL,
  serial TEXT,
  last_check TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS incidents(
  id TEXT PRIMARY KEY,
  classification TEXT,
  priority TEXT,
  status TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  reported_at TEXT,
  resolved_at TEXT,
  wind TEXT,
  wind_dir TEXT,
  temp_c REAL,
  humidity_pct REAL,
  precip TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS calls(
  id TEXT PRIMARY KEY,
  incident_id TEXT,
  vapi_call_id TEXT,
  caller_name TEXT,
  caller_number TEXT,
  started_at TEXT,
  ended_at TEXT,
  duration_s INT,
  transcript TEXT,
  summary TEXT,
  extracted TEXT,
  live INT
);

CREATE TABLE IF NOT EXISTS dispatches(
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id),
  status TEXT,
  proposed_by TEXT,
  notes TEXT,
  created_at TEXT,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS dispatch_vehicles(
  dispatch_id TEXT,
  vehicle_id TEXT
);

CREATE TABLE IF NOT EXISTS dispatch_personnel(
  dispatch_id TEXT,
  personnel_id TEXT
);

CREATE TABLE IF NOT EXISTS dispatch_equipment(
  dispatch_id TEXT,
  equipment_id TEXT
);

CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  tag TEXT,
  message TEXT,
  tone TEXT
);

CREATE TABLE IF NOT EXISTS telemetry(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT,
  entity_id TEXT,
  metric TEXT,
  value REAL,
  ts TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_entity
  ON telemetry(entity_type, entity_id, metric, id);

CREATE TABLE IF NOT EXISTS chat_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT,
  content TEXT,
  ts TEXT
);
"""


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
