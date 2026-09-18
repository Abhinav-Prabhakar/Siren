"""Seed data per PLAN.md §Seed data. Runs at startup only when DB is empty."""
from datetime import datetime, timedelta, timezone

from db import get_conn, now_iso

STA = "STA-01"
BASE_LAT, BASE_LNG = 17.3850, 78.4867  # station position — Abids, Hyderabad


def _ago(minutes: float = 0, hours: float = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(minutes=minutes, hours=hours)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def seed_if_empty() -> bool:
    conn = get_conn()
    try:
        count = conn.execute("SELECT COUNT(*) AS c FROM stations").fetchone()["c"]
        if count:
            return False
        _seed(conn)
        conn.commit()
        return True
    finally:
        conn.close()


def _seed(conn) -> None:
    now = now_iso()

    # ---- station ---------------------------------------------------------
    conn.execute(
        "INSERT INTO stations(id,name,code,address,lat,lng) VALUES(?,?,?,?,?,?)",
        (STA, "Siren Central", "SC-01", "1 Ember Way, Abids, Hyderabad", BASE_LAT, BASE_LNG),
    )

    # ---- vehicles (8, one per type) — all in quarters, available ---------
    vehicles = [
        # id, name, callsign, type, status, fuel, water, foam, batt, km, pump, lat, lng, speed, incident, free_at
        ("VEH-01", "Engine 1",  "E-1", "pumper",    "available",  82.0, 96.0, 90.0, 13.6, 42110.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-02", "Tender 1",  "T-1", "tender",    "available",  76.0, 88.0, 40.0, 13.2, 38920.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-03", "Ladder 1",  "L-1", "ladder",    "available",  91.0, 30.0, 0.0, 12.8, 27450.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-04", "Rescue 1",  "R-1", "rescue",    "available",  68.0, 20.0, 0.0, 13.9, 51230.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-05", "Medic 1",   "M-1", "ambulance", "available",  88.0, 0.0, 0.0, 13.1, 61340.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-06", "Hazmat 1",  "H-1", "hazmat",    "available",  95.0, 45.0, 15.0, 12.9, 19870.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-07", "Command 1", "C-1", "command",   "available",  71.0, 0.0, 0.0, 14.1, 30560.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
        ("VEH-08", "Squad 1",   "S-1", "special",   "available",  58.0, 55.0, 10.0, 13.4, 44780.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, None),
    ]
    conn.executemany(
        """INSERT INTO vehicles(id,station_id,name,callsign,type,status,fuel_pct,water_pct,
           foam_pct,battery_v,mileage_km,pump_pressure_bar,lat,lng,speed_kmh,incident_id,
           free_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(v[0], STA, *v[1:16], now) for v in vehicles],
    )

    # ---- personnel (14 across roles) — on duty at the station ------------
    shift_start = _ago(hours=6)
    shift_end = _ago(hours=-18)
    personnel = [
        # id, name, role, rank, status, vehicle, incident, hr, scba, lat, lng
        ("PER-01", "Dana Reyes",     "incident_commander", "Battalion Chief", "on_duty",  "VEH-07", None, 74, 98.0, BASE_LAT, BASE_LNG),
        ("PER-02", "Tom Okafor",     "chief",              "Station Chief",   "on_duty",  None,     None, 74, 98.0, BASE_LAT, BASE_LNG),
        ("PER-03", "Ilya Sorin",     "driver",             "Engineer",        "on_duty",  "VEH-01", None, 72, 96.0, BASE_LAT, BASE_LNG),
        ("PER-04", "June Park",      "firefighter",        "Firefighter II",  "on_duty",  "VEH-01", None, 76, 95.0, BASE_LAT, BASE_LNG),
        ("PER-05", "Lena Marsh",     "firefighter",        "Firefighter I",   "on_duty",  "VEH-01", None, 75, 97.0, BASE_LAT, BASE_LNG),
        ("PER-06", "Piotr Nowak",    "driver",             "Engineer",        "on_duty",  "VEH-02", None, 71, 97.0, BASE_LAT, BASE_LNG),
        ("PER-07", "Ruth Adler",     "firefighter",        "Firefighter II",  "on_duty",  "VEH-02", None, 73, 96.0, BASE_LAT, BASE_LNG),
        ("PER-08", "Kenji Mori",     "driver",             "Engineer",        "on_duty",  None,     None, 76, 97.0, BASE_LAT, BASE_LNG),
        ("PER-09", "Sofia Lind",     "firefighter",        "Firefighter I",   "on_duty",  None,     None, 79, 96.0, BASE_LAT, BASE_LNG),
        ("PER-10", "Omar Haddad",    "firefighter",        "Rescue Tech",     "on_duty",  "VEH-04", None, 74, 95.0, BASE_LAT, BASE_LNG),
        ("PER-11", "Grace Liu",      "driver",             "Engineer",        "on_duty",  "VEH-04", None, 72, 96.0, BASE_LAT, BASE_LNG),
        ("PER-12", "Nadia Petrov",   "paramedic",          "Paramedic",       "on_duty",  None,     None, 72, 99.0, BASE_LAT, BASE_LNG),
        ("PER-13", "Elliot Brandt",  "paramedic",          "Paramedic",       "on_duty",  None,     None, 70, 99.0, BASE_LAT, BASE_LNG),
        ("PER-14", "Marco Ruiz",     "firefighter",        "Firefighter I",   "resting",  None,     None, 66, 100.0, BASE_LAT, BASE_LNG),
    ]
    conn.executemany(
        """INSERT INTO personnel(id,station_id,name,role,rank,status,vehicle_id,incident_id,
           heart_rate,scba_pct,lat,lng,shift_start,shift_end,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(p[0], STA, *p[1:11], shift_start, shift_end, now) for p in personnel],
    )

    # ---- equipment (30 across categories) --------------------------------
    check = _ago(hours=3)
    equipment = [
        # id, name, category, status, battery, condition, serial, vehicle
        ("EQ-01", "Attack Line 45mm x30m",   "hose",      "ready",      None, 92.0, "HSE-4401", "VEH-01"),
        ("EQ-02", "Supply Line 75mm x100m",  "hose",      "ready",      None, 88.0, "HSE-7502", "VEH-02"),
        ("EQ-03", "Monitor Nozzle",          "nozzle",    "ready",      None, 95.0, "NOZ-1103", "VEH-01"),
        ("EQ-04", "Fog Nozzle",              "nozzle",    "ready",       None, 90.0, "NOZ-1104", "VEH-01"),
        ("EQ-05", "SCBA Set A",              "scba",      "ready",      84.0, 91.0, "SCBA-2201", "VEH-01"),
        ("EQ-06", "SCBA Set B",              "scba",      "ready",      79.0, 89.0, "SCBA-2202", "VEH-01"),
        ("EQ-07", "SCBA Set C",              "scba",      "ready",       96.0, 93.0, "SCBA-2203", "VEH-03"),
        ("EQ-08", "Turnout Set 1",           "ppe",       "ready",       None, 87.0, "PPE-3301", None),
        ("EQ-09", "Turnout Set 2",           "ppe",       "ready",       None, 85.0, "PPE-3302", None),
        ("EQ-10", "Halligan + Flathead",     "breaching", "ready",      None, 94.0, "BRK-5501", "VEH-04"),
        ("EQ-11", "K-12 Rescue Saw",         "breaching", "ready",      62.0, 81.0, "BRK-5502", "VEH-04"),
        ("EQ-12", "Roof Ladder 4m",          "ladder",    "ready",       None, 96.0, "LDR-6601", "VEH-03"),
        ("EQ-13", "Extension Ladder 7m",     "ladder",    "ready",       None, 93.0, "LDR-6602", "VEH-03"),
        ("EQ-14", "Hydraulic Spreader",      "hydraulic", "ready",      71.0, 88.0, "HYD-7701", "VEH-04"),
        ("EQ-15", "Hydraulic Cutter",        "hydraulic", "ready",      68.0, 86.0, "HYD-7702", "VEH-04"),
        ("EQ-16", "Trauma Kit",              "medical",   "ready",       None, 97.0, "MED-8801", "VEH-05"),
        ("EQ-17", "Defibrillator",           "medical",   "ready",       92.0, 95.0, "MED-8802", "VEH-05"),
        ("EQ-18", "Rope Bag 60m",            "rope",      "ready",       None, 90.0, "RPE-9901", "VEH-04"),
        ("EQ-19", "Thermal Camera TIC-1",    "thermal",   "ready",      78.0, 92.0, "THM-1001", "VEH-01"),
        ("EQ-20", "PPV Fan",                 "fan",       "ready",       None, 84.0, "FAN-1101", "VEH-01"),
        ("EQ-21", "Portable Pump",           "pump",      "ready",       None, 89.0, "PMP-1201", "VEH-02"),
        ("EQ-22", "Generator 5kW",           "generator", "ready",      None, 82.0, "GEN-1301", "VEH-07"),
        ("EQ-23", "Scene Light Tower",       "lighting",  "ready",      55.0, 80.0, "LGT-1401", "VEH-07"),
        ("EQ-24", "Foam Concentrate 20L",    "foam",      "ready",       None, 99.0, "FOM-1501", "VEH-02"),
        ("EQ-25", "Hazmat Suit Kit",         "hazmat",    "ready",       None, 91.0, "HZM-1601", "VEH-06"),
        ("EQ-26", "Radio Set 1",             "radio",     "ready",      73.0, 90.0, "RDO-1701", "VEH-07"),
        ("EQ-27", "Radio Set 2",             "radio",     "ready",       88.0, 92.0, "RDO-1702", "VEH-01"),
        ("EQ-28", "Spare Cylinder A",        "cylinder",  "ready",       None, 97.0, "CYL-1801", None),
        ("EQ-29", "Spare Cylinder B",        "cylinder",  "maintenance", None, 64.0, "CYL-1802", None),
        ("EQ-30", "4-Gas Detector",          "hazmat",    "ready",       81.0, 89.0, "HZM-1602", "VEH-06"),
    ]
    conn.executemany(
        """INSERT INTO equipment(id,station_id,vehicle_id,name,category,status,battery_pct,
           condition_pct,serial,last_check,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        [(e[0], STA, e[7], e[1], e[2], e[3], e[4], e[5], e[6], check, now) for e in equipment],
    )

    # ---- events (station ops only — no fabricated incident history) -------
    ev = [
        # (minutes_ago, tag, message, tone)
        (180, "SYSTEM",   "Siren Central came on shift — 14 personnel, 8 apparatus checked in.", "ash"),
        (170, "UNIT",     "Squad 1 cleared weekly equipment inspection.", "ash"),
        (150, "TELEMETRY","Hazmat 1 fuel at 95% — nominal.", "ash"),
        (140, "UNIT",     "Medic 1 restocked trauma kit after morning call.", "bone"),
        (95,  "PERSONNEL","Spare Cylinder B (EQ-29) flagged for maintenance.", "ash"),
        (60,  "TELEMETRY","Engine 1 pump test — nominal.", "ash"),
    ]
    conn.executemany(
        "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
        [(_ago(minutes=m), tag, msg, tone) for (m, tag, msg, tone) in ev],
    )

    # ---- telemetry history (~30 pts each for a few entities) --------------
    # 30 points over the last hour (every ~2 min) so sparklines render.
    rows = []

    def series(entity_type, entity_id, metric, start, end, wobble=0.0):
        import random
        random.seed(entity_id + metric)
        n = 30
        for i in range(n):
            frac = i / (n - 1)
            val = start + (end - start) * frac
            if wobble:
                val += random.uniform(-wobble, wobble)
            rows.append((entity_type, entity_id, metric, round(val, 2),
                         _ago(minutes=60 - frac * 60)))

    series("vehicle", "VEH-01", "fuel_pct", 84.0, 82.0)
    series("vehicle", "VEH-01", "water_pct", 97.0, 96.0)
    series("vehicle", "VEH-01", "speed_kmh", 0.0, 0.0, wobble=0.2)
    series("vehicle", "VEH-01", "battery_v", 13.8, 13.6, wobble=0.05)
    series("vehicle", "VEH-04", "fuel_pct", 70.0, 68.0)
    series("personnel", "PER-04", "heart_rate", 78.0, 74.0, wobble=2.0)
    series("personnel", "PER-04", "scba_pct", 96.0, 95.0)
    series("equipment", "EQ-19", "battery_pct", 92.0, 78.0)

    conn.executemany(
        "INSERT INTO telemetry(entity_type,entity_id,metric,value,ts) VALUES(?,?,?,?,?)",
        rows,
    )
