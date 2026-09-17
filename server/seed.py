"""Seed data per PLAN.md §Seed data. Runs at startup only when DB is empty."""
import json
from datetime import datetime, timedelta, timezone

from db import get_conn, now_iso

STA = "STA-01"
BASE_LAT, BASE_LNG = 40.7208, -73.9955  # station position


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
        (STA, "Siren Central", "SC-01", "1 Ember Way, Harbor District", BASE_LAT, BASE_LNG),
    )

    # ---- vehicles (8, one per type) --------------------------------------
    # incident positions: INC-001 ~1.6km NE, INC-002 ~1.1km SW
    i1 = (BASE_LAT + 0.014, BASE_LNG + 0.012)
    i2 = (BASE_LAT - 0.009, BASE_LNG - 0.010)
    vehicles = [
        # id, name, callsign, type, status, fuel, water, foam, batt, km, pump, lat, lng, speed, incident, free_at
        ("VEH-01", "Engine 1",  "E-1", "pumper",    "on_scene",   82.0, 64.0, 90.0, 13.6, 42110.0, 8.2, i1[0], i1[1], 0.0, "INC-001", None),
        ("VEH-02", "Tender 1",  "T-1", "tender",    "on_scene",   76.0, 88.0, 40.0, 13.2, 38920.0, 0.0, i1[0] + 0.0006, i1[1] - 0.0004, 0.0, "INC-001", None),
        ("VEH-03", "Ladder 1",  "L-1", "ladder",    "available",  91.0, 30.0, 0.0, 12.8, 27450.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, now),
        ("VEH-04", "Rescue 1",  "R-1", "rescue",    "on_scene",   68.0, 20.0, 0.0, 13.9, 51230.0, 0.0, i2[0], i2[1], 0.0, "INC-002", None),
        ("VEH-05", "Medic 1",   "M-1", "ambulance", "available",  88.0, 0.0, 0.0, 13.1, 61340.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, now),
        ("VEH-06", "Hazmat 1",  "H-1", "hazmat",    "available",  95.0, 45.0, 15.0, 12.9, 19870.0, 0.0, BASE_LAT, BASE_LNG, 0.0, None, now),
        ("VEH-07", "Command 1", "C-1", "command",   "on_scene",   71.0, 0.0, 0.0, 14.1, 30560.0, 0.0, i1[0] - 0.0005, i1[1] + 0.0005, 0.0, "INC-001", None),
        ("VEH-08", "Squad 1",   "S-1", "special",   "returning",  58.0, 55.0, 10.0, 13.4, 44780.0, 0.0, BASE_LAT - 0.004, BASE_LNG - 0.006, 46.0, None, _ago(minutes=-18)),
    ]
    conn.executemany(
        """INSERT INTO vehicles(id,station_id,name,callsign,type,status,fuel_pct,water_pct,
           foam_pct,battery_v,mileage_km,pump_pressure_bar,lat,lng,speed_kmh,incident_id,
           free_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(v[0], STA, *v[1:16], now) for v in vehicles],
    )

    # ---- personnel (14 across roles) -------------------------------------
    shift_start = _ago(hours=6)
    shift_end = _ago(hours=-18)
    personnel = [
        # id, name, role, rank, status, vehicle, incident, hr, scba, lat, lng
        ("PER-01", "Dana Reyes",     "incident_commander", "Battalion Chief", "on_scene", "VEH-07", "INC-001", 118, 92.0, i1[0], i1[1]),
        ("PER-02", "Tom Okafor",     "chief",              "Station Chief",   "on_duty",  None,     None,      74,  98.0, BASE_LAT, BASE_LNG),
        ("PER-03", "Ilya Sorin",     "driver",             "Engineer",        "on_scene", "VEH-01", "INC-001", 104, 88.0, i1[0], i1[1]),
        ("PER-04", "June Park",      "firefighter",        "Firefighter II",  "on_scene", "VEH-01", "INC-001", 141, 61.0, i1[0], i1[1]),
        ("PER-05", "Lena Marsh",     "firefighter",        "Firefighter I",   "on_scene", "VEH-01", "INC-001", 136, 58.0, i1[0], i1[1]),
        ("PER-06", "Piotr Nowak",    "driver",             "Engineer",        "on_scene", "VEH-02", "INC-001", 98,  90.0, i1[0] + 0.0006, i1[1] - 0.0004),
        ("PER-07", "Ruth Adler",     "firefighter",        "Firefighter II",  "on_scene", "VEH-02", "INC-001", 128, 66.0, i1[0] + 0.0006, i1[1] - 0.0004),
        ("PER-08", "Kenji Mori",     "driver",             "Engineer",        "on_duty",  None,     None,      76,  97.0, BASE_LAT, BASE_LNG),
        ("PER-09", "Sofia Lind",     "firefighter",        "Firefighter I",   "on_duty",  None,     None,      79,  96.0, BASE_LAT, BASE_LNG),
        ("PER-10", "Omar Haddad",    "firefighter",        "Rescue Tech",     "on_scene", "VEH-04", "INC-002", 121, 74.0, i2[0], i2[1]),
        ("PER-11", "Grace Liu",      "driver",             "Engineer",        "on_scene", "VEH-04", "INC-002", 95,  89.0, i2[0], i2[1]),
        ("PER-12", "Nadia Petrov",   "paramedic",          "Paramedic",       "on_duty",  None,     None,      72,  99.0, BASE_LAT, BASE_LNG),
        ("PER-13", "Elliot Brandt",  "paramedic",          "Paramedic",       "on_duty",  None,     None,      70,  99.0, BASE_LAT, BASE_LNG),
        ("PER-14", "Marco Ruiz",     "firefighter",        "Firefighter I",   "resting",  None,     None,      66,  100.0, BASE_LAT, BASE_LNG),
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
        ("EQ-01", "Attack Line 45mm x30m",   "hose",      "in_use",      None, 92.0, "HSE-4401", "VEH-01"),
        ("EQ-02", "Supply Line 75mm x100m",  "hose",      "in_use",      None, 88.0, "HSE-7502", "VEH-02"),
        ("EQ-03", "Monitor Nozzle",          "nozzle",    "in_use",      None, 95.0, "NOZ-1103", "VEH-01"),
        ("EQ-04", "Fog Nozzle",              "nozzle",    "ready",       None, 90.0, "NOZ-1104", "VEH-01"),
        ("EQ-05", "SCBA Set A",              "scba",      "in_use",      84.0, 91.0, "SCBA-2201", "VEH-01"),
        ("EQ-06", "SCBA Set B",              "scba",      "in_use",      79.0, 89.0, "SCBA-2202", "VEH-01"),
        ("EQ-07", "SCBA Set C",              "scba",      "ready",       96.0, 93.0, "SCBA-2203", "VEH-03"),
        ("EQ-08", "Turnout Set 1",           "ppe",       "ready",       None, 87.0, "PPE-3301", None),
        ("EQ-09", "Turnout Set 2",           "ppe",       "ready",       None, 85.0, "PPE-3302", None),
        ("EQ-10", "Halligan + Flathead",     "breaching", "in_use",      None, 94.0, "BRK-5501", "VEH-04"),
        ("EQ-11", "K-12 Rescue Saw",         "breaching", "in_use",      62.0, 81.0, "BRK-5502", "VEH-04"),
        ("EQ-12", "Roof Ladder 4m",          "ladder",    "ready",       None, 96.0, "LDR-6601", "VEH-03"),
        ("EQ-13", "Extension Ladder 7m",     "ladder",    "ready",       None, 93.0, "LDR-6602", "VEH-03"),
        ("EQ-14", "Hydraulic Spreader",      "hydraulic", "in_use",      71.0, 88.0, "HYD-7701", "VEH-04"),
        ("EQ-15", "Hydraulic Cutter",        "hydraulic", "in_use",      68.0, 86.0, "HYD-7702", "VEH-04"),
        ("EQ-16", "Trauma Kit",              "medical",   "ready",       None, 97.0, "MED-8801", "VEH-05"),
        ("EQ-17", "Defibrillator",           "medical",   "ready",       92.0, 95.0, "MED-8802", "VEH-05"),
        ("EQ-18", "Rope Bag 60m",            "rope",      "ready",       None, 90.0, "RPE-9901", "VEH-04"),
        ("EQ-19", "Thermal Camera TIC-1",    "thermal",   "in_use",      78.0, 92.0, "THM-1001", "VEH-01"),
        ("EQ-20", "PPV Fan",                 "fan",       "ready",       None, 84.0, "FAN-1101", "VEH-01"),
        ("EQ-21", "Portable Pump",           "pump",      "ready",       None, 89.0, "PMP-1201", "VEH-02"),
        ("EQ-22", "Generator 5kW",           "generator", "in_use",      None, 82.0, "GEN-1301", "VEH-07"),
        ("EQ-23", "Scene Light Tower",       "lighting",  "in_use",      55.0, 80.0, "LGT-1401", "VEH-07"),
        ("EQ-24", "Foam Concentrate 20L",    "foam",      "ready",       None, 99.0, "FOM-1501", "VEH-02"),
        ("EQ-25", "Hazmat Suit Kit",         "hazmat",    "ready",       None, 91.0, "HZM-1601", "VEH-06"),
        ("EQ-26", "Radio Set 1",             "radio",     "in_use",      73.0, 90.0, "RDO-1701", "VEH-07"),
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

    # ---- incidents (2 active + 1 resolved) --------------------------------
    conn.executemany(
        """INSERT INTO incidents(id,classification,priority,status,address,lat,lng,
           reported_at,resolved_at,wind,wind_dir,temp_c,humidity_pct,precip,notes)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [
            ("INC-001", "Structure Fire — Residential", "P1", "active",
             "812 Ashgrove Lane", i1[0], i1[1], _ago(minutes=42), None,
             "18 km/h", "NW", 9.5, 42.0, "none",
             "Two-storey detached. Flames venting second floor, exposure risk on B side. All occupants reported out."),
            ("INC-002", "Motor Vehicle Accident — Entrapment", "P2", "active",
             "Harbor Blvd & 9th St", i2[0], i2[1], _ago(minutes=19), None,
             "14 km/h", "N", 10.2, 48.0, "none",
             "Two-vehicle collision, one occupant trapped. Hydraulic rescue in progress."),
            ("INC-003", "Kitchen Fire — Small", "P3", "resolved",
             "44 Foundry Row, Unit 3", BASE_LAT + 0.006, BASE_LNG - 0.004,
             _ago(hours=3), _ago(hours=1, minutes=30),
             "10 km/h", "W", 11.0, 51.0, "none",
             "Stove fire extinguished prior to arrival. Ventilation only. No injuries."),
        ],
    )

    # ---- calls (1 live, 2 ended; two share INC-001) ------------------------
    conn.executemany(
        """INSERT INTO calls(id,incident_id,vapi_call_id,caller_name,caller_number,
           started_at,ended_at,duration_s,transcript,summary,extracted,live)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
        [
            ("CALL-001", "INC-001", "vapi_9f2c71", "Denise Carter", "+1 555-0148",
             _ago(minutes=41), _ago(minutes=37), 214,
             "CALLER: There's fire in the house next door, flames on the second floor.\n"
             "AGENT: Is anyone inside?\n"
             "CALLER: They all got out, I can see them on the lawn.\n"
             "AGENT: Units are being dispatched to 812 Ashgrove Lane.",
             "Reported structure fire at 812 Ashgrove Lane. Occupants evacuated. Flames on second floor.",
             json.dumps(["structure fire", "flames visible second floor", "occupants evacuated", "812 Ashgrove Lane"]),
             0),
            ("CALL-002", "INC-001", "vapi_3aa0e8", "Unknown — cell", "+1 555-0982",
             _ago(minutes=2), None, 137,
             "CALLER: I can see smoke coming off the roof of the house on Ashgrove.\n"
             "AGENT: Crews are on scene. Are you a safe distance away?",
             "Second caller reporting smoke from roof at 812 Ashgrove Lane — grouped with INC-001.",
             json.dumps(["smoke from roof", "same incident as INC-001"]),
             1),
            ("CALL-003", "INC-002", "vapi_71bd44", "Marcus Webb", "+1 555-0311",
             _ago(minutes=18), _ago(minutes=16), 96,
             "CALLER: Two cars crashed at Harbor and 9th, a driver is stuck inside.\n"
             "AGENT: Rescue unit is en route. Is anyone bleeding heavily?\n"
             "CALLER: I can't get close, the door is crushed.",
             "MVA with entrapment at Harbor Blvd & 9th St. Driver trapped, door crushed.",
             json.dumps(["two-vehicle collision", "one entrapped", "Harbor Blvd & 9th St"]),
             0),
        ],
    )

    # ---- dispatches (2 pending, proposed by agent) -------------------------
    conn.executemany(
        """INSERT INTO dispatches(id,incident_id,status,proposed_by,notes,created_at,decided_at)
           VALUES(?,?,?,?,?,?,?)""",
        [
            ("DSP-001", "INC-001", "pending", "agent",
             "Agent recommends aerial support for roof ventilation and elevated master stream on the B side.",
             _ago(minutes=6), None),
            ("DSP-002", "INC-002", "pending", "agent",
             "Agent recommends medic unit for the entrapped driver and a second paramedic for triage.",
             _ago(minutes=4), None),
        ],
    )
    conn.executemany(
        "INSERT INTO dispatch_vehicles(dispatch_id,vehicle_id) VALUES(?,?)",
        [("DSP-001", "VEH-03"), ("DSP-002", "VEH-05")],
    )
    conn.executemany(
        "INSERT INTO dispatch_personnel(dispatch_id,personnel_id) VALUES(?,?)",
        [("DSP-001", "PER-08"), ("DSP-001", "PER-09"), ("DSP-002", "PER-12"), ("DSP-002", "PER-13")],
    )
    conn.executemany(
        "INSERT INTO dispatch_equipment(dispatch_id,equipment_id) VALUES(?,?)",
        [("DSP-001", "EQ-12"), ("DSP-001", "EQ-13"), ("DSP-001", "EQ-07"),
         ("DSP-002", "EQ-16"), ("DSP-002", "EQ-17")],
    )

    # ---- events (~30 rows) -------------------------------------------------
    ev = [
        # (minutes_ago, tag, message, tone)
        (180, "SYSTEM",   "Siren Central came on shift — 14 personnel, 8 apparatus checked in.", "ash"),
        (170, "UNIT",     "Squad 1 cleared weekly equipment inspection.", "ash"),
        (150, "TELEMETRY","Hazmat 1 fuel at 95% — nominal.", "ash"),
        (140, "UNIT",     "Medic 1 restocked trauma kit after morning call.", "bone"),
        (125, "CALL",     "Incoming call — medical assist, 44 Foundry Row.", "bone"),
        (122, "INCIDENT", "INC-003 opened: kitchen fire, 44 Foundry Row.", "bone"),
        (120, "DISPATCH", "Dispatch approved: Squad 1 to INC-003.", "bone"),
        (118, "UNIT",     "Squad 1 en route to INC-003.", "bone"),
        (111, "UNIT",     "Squad 1 on scene at INC-003.", "flame"),
        (96,  "INCIDENT", "INC-003: fire out on arrival, ventilation only.", "bone"),
        (90,  "INCIDENT", "INC-003 resolved — no injuries.", "ash"),
        (88,  "UNIT",     "Squad 1 released, returning to quarters.", "ash"),
        (42,  "CALL",     "Incoming call — structure fire reported, 812 Ashgrove Lane.", "flame"),
        (41,  "INCIDENT", "INC-001 opened: P1 structure fire, 812 Ashgrove Lane.", "flame"),
        (40,  "DISPATCH", "Dispatch approved: Engine 1, Tender 1, Command 1 to INC-001.", "flame"),
        (39,  "UNIT",     "Engine 1 en route to INC-001.", "flame"),
        (39,  "UNIT",     "Tender 1 en route to INC-001.", "bone"),
        (38,  "UNIT",     "Command 1 en route — Battalion Chief Reyes assuming IC.", "bone"),
        (35,  "UNIT",     "Engine 1 on scene at INC-001 — flames venting second floor.", "flame"),
        (34,  "UNIT",     "Command 1 on scene — command post established.", "bone"),
        (33,  "UNIT",     "Tender 1 on scene — supplying Engine 1.", "bone"),
        (28,  "TELEMETRY","Engine 1 water at 64% and dropping.", "flame"),
        (24,  "PERSONNEL","Firefighter Park SCBA at 61%.", "ash"),
        (19,  "CALL",     "Incoming call — MVA with entrapment, Harbor Blvd & 9th St.", "flame"),
        (18,  "INCIDENT", "INC-002 opened: P2 MVA with entrapment.", "flame"),
        (17,  "DISPATCH", "Dispatch approved: Rescue 1 to INC-002.", "bone"),
        (16,  "UNIT",     "Rescue 1 en route to INC-002.", "bone"),
        (12,  "UNIT",     "Rescue 1 on scene — extrication in progress.", "flame"),
        (6,   "DISPATCH", "Agent proposed DSP-001: Ladder 1 to INC-001 — awaiting approval.", "bone"),
        (4,   "DISPATCH", "Agent proposed DSP-002: Medic 1 to INC-002 — awaiting approval.", "bone"),
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

    series("vehicle", "VEH-01", "fuel_pct", 88.0, 82.0)
    series("vehicle", "VEH-01", "water_pct", 100.0, 64.0)
    series("vehicle", "VEH-01", "speed_kmh", 0.0, 0.0, wobble=1.5)
    series("vehicle", "VEH-01", "battery_v", 13.8, 13.6, wobble=0.05)
    series("vehicle", "VEH-04", "fuel_pct", 74.0, 68.0)
    series("personnel", "PER-04", "heart_rate", 82.0, 141.0, wobble=3.0)
    series("personnel", "PER-04", "scba_pct", 100.0, 61.0)
    series("equipment", "EQ-19", "battery_pct", 92.0, 78.0)

    conn.executemany(
        "INSERT INTO telemetry(entity_type,entity_id,metric,value,ts) VALUES(?,?,?,?,?)",
        rows,
    )
