"""Telemetry + dispatch-lifecycle simulator — asyncio background task.

Ticks every ~4s. Responsibilities:
  - drift fuel/water/battery/speed, heart rate, SCBA, equipment battery
  - drive the dispatch lifecycle: dispatched -> en_route (interpolate coords
    toward the incident, 40-70 km/h, free_at = ETA) -> on_scene (speed 0,
    pumper pump pressure rises) -> returning -> available
  - progress incidents: active -> contained (~90s after first unit on scene)
    -> resolved (~60s later, stamps resolved_at)
  - personnel mirror their vehicle's phase
  - drift weather on unresolved incidents
  - night mode: auto-approve any pending dispatch each tick
  - append telemetry rows; prune history to ~500 rows per entity+metric
"""
import asyncio
import math
import random
import re
from datetime import datetime, timedelta, timezone

from db import get_conn, now_iso

try:
    from routers.dispatches import apply_approval
except ImportError:  # imported as server.simulator in some contexts
    from server.routers.dispatches import apply_approval

try:
    from chat_tools import create_incident, propose_dispatch
except ImportError:
    from server.chat_tools import create_incident, propose_dispatch

TICK_S = 4.0
KEEP_PER_METRIC = 500
MOVING = ("dispatched", "en_route", "returning")
KM_PER_DEG = 111.0
ARRIVE_DEG = 0.0009            # ~100 m — close enough to count as arrived
CONTAINED_AFTER_S = 90.0       # first unit on scene -> contained
RESOLVE_AFTER_S = 60.0         # contained -> resolved
WIND_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# Auto-intake — without Vapi traffic nothing else creates incidents, and the
# board would go permanently quiet once the seed set resolves. When the board
# has been empty of open incidents for a while, SIREN-1 takes a call: spawn a
# scenario and let the agent propose the dispatch (pending -> operator
# approves, or auto-approved under night watch). The full loop stays alive.
SPAWN_QUIET_S = 75.0           # quiet board required before a new call comes in
SPAWN_CHANCE = 0.05            # per tick once eligible (~every 80 s)
SPAWN_CONCURRENT_CHANCE = 0.004  # rare second/third concurrent incident
MAX_OPEN_INCIDENTS = 3

# (classification, priority, address, preferred vehicle types, preferred kit)
SPAWN_SCENARIOS = [
    ("Structure fire — residential", "P1", "1420 Ashford Row",
     ("pumper", "ladder", "tender"), ("scba", "thermal", "hose")),
    ("Structure fire — commercial", "P1", "77 Foundry Blvd",
     ("pumper", "ladder", "command"), ("scba", "thermal", "fan")),
    ("Motor vehicle accident — multi-car", "P2", "Route 9 & Kellerman Ave",
     ("rescue", "ambulance", "pumper"), ("hydraulic", "medical")),
    ("Vehicle fire — highway shoulder", "P3", "Hwy 12, mile 34",
     ("pumper", "tender"), ("hose", "foam")),
    ("Hazmat spill — truck rollover", "P1", "Industrial Pkwy & Dock 4",
     ("hazmat", "pumper", "command"), ("hazmat", "ppe")),
    ("Electrical fire — transformer vault", "P2", "88 Juniper St",
     ("pumper", "command"), ("thermal", "ppe")),
    ("Gas leak — residential block", "P2", "312 Maple Ct",
     ("pumper", "hazmat"), ("hazmat", "ppe")),
    ("Wildland/brush fire", "P2", "North Ridge Trail",
     ("tender", "pumper", "special"), ("hose", "fan")),
    ("Elevator rescue — trapped occupants", "P3", "Union Tower, 5 Grand Plaza",
     ("rescue", "ladder"), ("rope", "breaching")),
    ("Flooding — basement rescue", "P3", "19 Canal St",
     ("rescue", "tender"), ("pump", "rope", "lighting")),
]

_quiet_since = None  # datetime the board last became empty of open incidents

# vehicle status -> personnel status (personnel has no 'returning' phase)
PERSONNEL_PHASE = {
    "dispatched": "dispatched",
    "en_route": "en_route",
    "on_scene": "on_scene",
    "returning": "en_route",
}

# Fallback first-on-scene timestamps for incidents whose on-scene event rows
# predate the simulator (e.g. seeded history) — keyed by incident id.
_on_scene_since: dict = {}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _event(conn, tag: str, message: str, tone: str, ts: str) -> None:
    conn.execute(
        "INSERT INTO events(ts,tag,message,tone) VALUES(?,?,?,?)",
        (ts, tag, message, tone),
    )


def _move_toward(lat, lng, tlat, tlng, speed_kmh):
    """Step toward target; returns (lat, lng, arrived)."""
    step_deg = speed_kmh * (TICK_S / 3600.0) / KM_PER_DEG
    dlat, dlng = tlat - lat, tlng - lng
    dist = math.hypot(dlat, dlng)
    if dist <= max(step_deg, ARRIVE_DEG):
        return tlat, tlng, True
    f = step_deg / dist
    return lat + dlat * f, lng + dlng * f, False


def _night_mode_auto_approve(conn) -> None:
    """While night mode is on, every pending dispatch is auto-approved."""
    row = conn.execute(
        "SELECT value FROM settings WHERE key = 'night_mode'"
    ).fetchone()
    if not (row and str(row["value"]).lower() in ("1", "true", "yes", "on")):
        return
    pending = conn.execute(
        "SELECT * FROM dispatches WHERE status = 'pending' ORDER BY created_at"
    ).fetchall()
    for d in pending:
        apply_approval(
            conn, d, tag="NIGHT",
            message=(f"{d['id']} auto-approved — night mode engaged, "
                     f"units rolling to {d['incident_id']}."),
        )


def _tick_vehicles(conn, now: str, now_dt: datetime, tele: list, touched: set) -> None:
    for v in conn.execute("SELECT * FROM vehicles").fetchall():
        status = v["status"]
        incident_id = v["incident_id"]
        free_at = v["free_at"]
        lat, lng = v["lat"], v["lng"]
        speed = v["speed_kmh"] or 0.0
        pump = v["pump_pressure_bar"] or 0.0

        inc = None
        if incident_id:
            inc = conn.execute(
                "SELECT * FROM incidents WHERE id = ?", (incident_id,)
            ).fetchone()

        if status in ("dispatched", "en_route"):
            if inc is None or inc["status"] == "resolved":
                # incident closed under them — cut loose
                status = "returning"
                incident_id = None
                _event(conn, "UNIT",
                       f"{v['name']} released — returning to quarters.", "ash", now)
            else:
                if status == "dispatched":
                    status = "en_route"
                    _event(conn, "UNIT",
                           f"{v['name']} en route to {inc['id']} ({inc['address']}).",
                           "bone", now)
                speed = _clamp(speed + (60.0 - speed) * 0.2
                               + random.uniform(-3.0, 3.0), 40.0, 70.0)
                if lat is not None and lng is not None and inc["lat"] is not None:
                    lat, lng, arrived = _move_toward(
                        lat, lng, inc["lat"], inc["lng"], speed)
                    remaining_km = math.hypot(inc["lat"] - lat,
                                              inc["lng"] - lng) * KM_PER_DEG
                    eta = now_dt + timedelta(
                        seconds=remaining_km / max(speed, 1.0) * 3600.0)
                    free_at = eta.isoformat(timespec="seconds").replace(
                        "+00:00", "Z")
                    if arrived:
                        status = "on_scene"
                        speed = 0.0
                        _event(conn, "UNIT",
                               f"{v['name']} on scene at {inc['id']}.",
                               "flame", now)

        elif status == "returning":
            sta = conn.execute(
                "SELECT lat, lng FROM stations WHERE id = ?", (v["station_id"],)
            ).fetchone()
            speed = _clamp(speed + (45.0 - speed) * 0.2
                           + random.uniform(-3.0, 3.0), 30.0, 60.0)
            arrived = False
            if sta and lat is not None and lng is not None:
                lat, lng, arrived = _move_toward(lat, lng, sta["lat"],
                                               sta["lng"], speed)
            if arrived or sta is None:
                status = "available"
                incident_id = None
                free_at = None
                speed = 0.0
                _event(conn, "UNIT",
                       f"{v['name']} back in quarters — available.", "ash", now)

        elif status == "on_scene":
            speed = 0.0
        else:  # available / refuel / out_of_service
            speed = _clamp(speed - speed * 0.5, 0.0, 85.0)
            if speed < 1.0:
                speed = 0.0

        # pumpers build pressure only while working a scene
        if status == "on_scene" and v["type"] == "pumper":
            pump = _clamp(pump + random.uniform(0.2, 0.8), 0.0, 9.0)
        elif status != "on_scene":
            pump = _clamp(pump - random.uniform(0.5, 1.5), 0.0, 9.0)

        working = status in MOVING or status == "on_scene"
        fuel = _clamp((v["fuel_pct"] if v["fuel_pct"] is not None else 50.0)
                      - random.uniform(0.005, 0.05 if working else 0.01),
                      2.0, 100.0)
        water = v["water_pct"] if v["water_pct"] is not None else 0.0
        if status == "on_scene" and water:
            water = _clamp(water - random.uniform(0.2, 1.0), 0.0, 100.0)
        batt = _clamp(v["battery_v"] + random.uniform(-0.06, 0.06), 11.8, 14.4)
        mileage = (v["mileage_km"] or 0.0) + speed * (TICK_S / 3600.0)

        conn.execute(
            """UPDATE vehicles SET status=?, incident_id=?, free_at=?,
               fuel_pct=?, water_pct=?, battery_v=?, pump_pressure_bar=?,
               speed_kmh=?, lat=?, lng=?, mileage_km=?, updated_at=? WHERE id=?""",
            (status, incident_id, free_at, round(fuel, 1), round(water, 1),
             round(batt, 2), round(pump, 1), round(speed, 1), lat, lng,
             round(mileage, 2), now, v["id"]),
        )
        for metric, val in (("fuel_pct", fuel), ("water_pct", water),
                            ("battery_v", batt), ("speed_kmh", speed),
                            ("pump_pressure_bar", pump)):
            tele.append(("vehicle", v["id"], metric, round(val, 2)))
            touched.add(("vehicle", v["id"], metric))


def _tick_incidents(conn, now: str, now_dt: datetime) -> None:
    """Incident progression: active -> contained -> resolved; weather drift."""
    rows = conn.execute(
        "SELECT * FROM incidents WHERE status != 'resolved'"
    ).fetchall()
    for inc in rows:
        iid = inc["id"]
        status = inc["status"]

        # ---- weather drift ------------------------------------------------
        temp = _clamp((inc["temp_c"] or 10.0) + random.uniform(-0.3, 0.3), -20.0, 45.0)
        hum = _clamp((inc["humidity_pct"] or 50.0) + random.uniform(-1.5, 1.5), 5.0, 100.0)
        wind_txt = inc["wind"] or "10 km/h"
        m = re.search(r"(\d+(?:\.\d+)?)", wind_txt)
        wind_val = _clamp((float(m.group(1)) if m else 10.0)
                          + random.uniform(-1.5, 1.5), 4.0, 60.0)
        wind_dir = inc["wind_dir"] or "N"
        if random.random() < 0.06:
            wind_dir = random.choice(WIND_DIRS)
        conn.execute(
            """UPDATE incidents SET temp_c=?, humidity_pct=?, wind=?, wind_dir=?
               WHERE id=?""",
            (round(temp, 1), round(hum, 1), f"{wind_val:.0f} km/h", wind_dir, iid),
        )

        # ---- lifecycle -----------------------------------------------------
        if status == "active":
            row = conn.execute(
                """SELECT MIN(ts) AS t FROM events
                   WHERE tag = 'UNIT' AND message LIKE '%on scene at ' || ? || '%'""",
                (iid,),
            ).fetchone()
            first_on_scene = row["t"] if row else None
            if first_on_scene is None:
                on_scene_now = conn.execute(
                    """SELECT COUNT(*) AS c FROM vehicles
                       WHERE incident_id = ? AND status = 'on_scene'""",
                    (iid,),
                ).fetchone()["c"]
                if on_scene_now:
                    first_on_scene = _on_scene_since.setdefault(iid, now)
                else:
                    continue
            else:
                _on_scene_since.pop(iid, None)
            if (now_dt - _parse_ts(first_on_scene)).total_seconds() >= CONTAINED_AFTER_S:
                status = "contained"
                conn.execute(
                    "UPDATE incidents SET status='contained' WHERE id=?", (iid,))
                _event(conn, "INC",
                       f"{iid} contained — crews consolidating.", "bone", now)

        if status == "contained":
            row = conn.execute(
                """SELECT MIN(ts) AS t FROM events
                   WHERE tag = 'INC' AND message LIKE ? || ' contained%'""",
                (iid,),
            ).fetchone()
            contained_ts = row["t"] if row else None
            if contained_ts and (now_dt - _parse_ts(contained_ts)).total_seconds() >= RESOLVE_AFTER_S:
                conn.execute(
                    "UPDATE incidents SET status='resolved', resolved_at=? WHERE id=?",
                    (now, iid),
                )
                _event(conn, "INC",
                       f"{iid} resolved — all units released.", "ash", now)
                for veh in conn.execute(
                    """SELECT id, name, status FROM vehicles
                       WHERE incident_id = ? AND status != 'available'""",
                    (iid,),
                ).fetchall():
                    conn.execute(
                        "UPDATE vehicles SET status='returning', updated_at=? WHERE id=?",
                        (now, veh["id"]),
                    )
                    _event(conn, "UNIT",
                           f"{veh['name']} released from {iid} — returning to quarters.",
                           "ash", now)


def _tick_personnel(conn, now: str, tele: list, touched: set) -> None:
    """Personnel mirror their vehicle's phase + vitals drift."""
    for p in conn.execute("SELECT * FROM personnel").fetchall():
        status = p["status"]
        incident_id = p["incident_id"]
        lat, lng = p["lat"], p["lng"]

        if p["vehicle_id"]:
            v = conn.execute(
                "SELECT status, incident_id, lat, lng FROM vehicles WHERE id = ?",
                (p["vehicle_id"],),
            ).fetchone()
            if v is not None:
                mapped = PERSONNEL_PHASE.get(v["status"])
                if mapped is not None:
                    if status in ("on_duty", "dispatched", "en_route", "on_scene"):
                        status = mapped
                        incident_id = v["incident_id"]
                        lat, lng = v["lat"], v["lng"]
                elif status in ("dispatched", "en_route", "on_scene"):
                    # vehicle back in service — crew stands down
                    status = "on_duty"
                    incident_id = None
                    lat, lng = v["lat"], v["lng"]

        if status == "on_scene":
            hr_target = 135.0
        elif status in MOVING:
            hr_target = 105.0
        elif status == "resting":
            hr_target = 62.0
        else:
            hr_target = 74.0
        hr0 = p["heart_rate"] if p["heart_rate"] is not None else hr_target
        hr = _clamp(hr0 + (hr_target - hr0) * 0.08
                    + random.uniform(-2.5, 2.5), 55.0, 170.0)

        scba = p["scba_pct"] if p["scba_pct"] is not None else 100.0
        if status == "on_scene":
            scba = _clamp(scba - random.uniform(0.3, 0.9), 0.0, 100.0)
        else:
            scba = _clamp(scba + random.uniform(0.0, 0.3), 0.0, 100.0)

        conn.execute(
            """UPDATE personnel SET status=?, incident_id=?, heart_rate=?,
               scba_pct=?, lat=?, lng=?, updated_at=? WHERE id=?""",
            (status, incident_id, int(round(hr)), round(scba, 1), lat, lng,
             now, p["id"]),
        )
        for metric, val in (("heart_rate", hr), ("scba_pct", scba)):
            tele.append(("personnel", p["id"], metric, round(val, 2)))
            touched.add(("personnel", p["id"], metric))


def _pick_spawn_resources(conn, veh_types, kit_cats):
    """Choose available units/crew/kit for a spawned incident.

    Vehicles prefer the scenario's type list then any available unit; crew
    prefer firefighters already assigned to the chosen vehicles; kit prefers
    the scenario's categories. Returns id lists (may be empty).
    """
    available = conn.execute(
        "SELECT id, type FROM vehicles WHERE status = 'available' ORDER BY id"
    ).fetchall()
    preferred = [v for v in available if v["type"] in veh_types]
    rest = [v for v in available if v["type"] not in veh_types]
    vehicles = [v["id"] for v in (preferred + rest)[:2]]
    veh_set = set(vehicles)

    on_duty = conn.execute(
        """SELECT id, vehicle_id FROM personnel
           WHERE status = 'on_duty' ORDER BY id"""
    ).fetchall()
    riding = [p for p in on_duty if p["vehicle_id"] in veh_set]
    loose = [p for p in on_duty if p["vehicle_id"] not in veh_set]
    personnel = [p["id"] for p in (riding + loose)[:3]]

    cats = ",".join("?" * len(kit_cats))
    ready = conn.execute(
        f"""SELECT id, category FROM equipment
            WHERE status = 'ready' AND category IN ({cats}) ORDER BY id""",
        list(kit_cats),
    ).fetchall()
    equipment = [e["id"] for e in ready[:2]]
    return vehicles, personnel, equipment


def _tick_spawner(conn, now: str, now_dt: datetime) -> None:
    """Auto-intake: keep the board alive when no calls are coming in."""
    global _quiet_since
    open_count = conn.execute(
        "SELECT COUNT(*) AS c FROM incidents WHERE status != 'resolved'"
    ).fetchone()["c"]
    if open_count >= MAX_OPEN_INCIDENTS:
        return

    if open_count == 0:
        if _quiet_since is None:
            _quiet_since = now_dt
            return
        quiet_s = (now_dt - _quiet_since).total_seconds()
        if quiet_s < SPAWN_QUIET_S or random.random() >= SPAWN_CHANCE:
            return
    else:
        _quiet_since = None
        if random.random() >= SPAWN_CONCURRENT_CHANCE:
            return

    cls, prio, addr, veh_types, kit_cats = random.choice(SPAWN_SCENARIOS)
    sta = conn.execute(
        "SELECT lat, lng FROM stations ORDER BY id LIMIT 1"
    ).fetchone()
    lat = lng = None
    if sta and sta["lat"] is not None and sta["lng"] is not None:
        lat = sta["lat"] + random.uniform(-0.045, 0.045)
        lng = sta["lng"] + random.uniform(-0.045, 0.045)

    result, _ = create_incident(conn, {
        "classification": cls, "priority": prio, "address": addr,
        "lat": lat, "lng": lng,
        "wind": f"{random.randint(5, 35)} km/h",
        "wind_dir": random.choice(WIND_DIRS),
        "temp_c": round(random.uniform(-5.0, 32.0), 1),
        "humidity_pct": round(random.uniform(15.0, 95.0), 1),
        "precip": random.choice(["none", "none", "none", "light rain", "rain"]),
        "notes": "Auto-intake — simulated inbound call.",
    })
    if "error" in result:
        _quiet_since = now_dt
        return

    vehicles, personnel, equipment = _pick_spawn_resources(
        conn, veh_types, kit_cats)
    if vehicles or personnel:
        propose_dispatch(conn, {
            "incident_id": result["incident_id"],
            "vehicle_ids": vehicles,
            "personnel_ids": personnel,
            "equipment_ids": equipment,
            "notes": f"SIREN-1 intake proposal for {cls.lower()}.",
        })
    _quiet_since = now_dt


def _tick(conn) -> None:
    now = now_iso()
    now_dt = datetime.now(timezone.utc)
    tele = []          # (entity_type, entity_id, metric, value)
    touched = set()    # (entity_type, entity_id, metric) for pruning

    _night_mode_auto_approve(conn)
    _tick_vehicles(conn, now, now_dt, tele, touched)
    _tick_incidents(conn, now, now_dt)
    _tick_spawner(conn, now, now_dt)
    _tick_personnel(conn, now, tele, touched)

    # ---- equipment battery ----------------------------------------------
    for e in conn.execute(
        "SELECT id, battery_pct, status FROM equipment WHERE battery_pct IS NOT NULL"
    ).fetchall():
        drain = 0.15 if e["status"] == "in_use" else 0.03
        batt = _clamp(e["battery_pct"] - random.uniform(0.0, drain), 0.0, 100.0)
        conn.execute(
            "UPDATE equipment SET battery_pct=?, updated_at=? WHERE id=?",
            (round(batt, 1), now, e["id"]),
        )
        tele.append(("equipment", e["id"], "battery_pct", round(batt, 2)))
        touched.add(("equipment", e["id"], "battery_pct"))

    # ---- telemetry insert + prune ---------------------------------------
    conn.executemany(
        "INSERT INTO telemetry(entity_type,entity_id,metric,value,ts) VALUES(?,?,?,?,?)",
        [(et, eid, m, val, now) for (et, eid, m, val) in tele],
    )
    for et, eid, m in touched:
        conn.execute(
            """DELETE FROM telemetry
               WHERE entity_type=? AND entity_id=? AND metric=? AND id NOT IN (
                 SELECT id FROM telemetry
                 WHERE entity_type=? AND entity_id=? AND metric=?
                 ORDER BY id DESC LIMIT ?)""",
            (et, eid, m, et, eid, m, KEEP_PER_METRIC),
        )

    conn.commit()


async def telemetry_loop() -> None:
    """Run forever; intended to be launched as an asyncio task."""
    while True:
        try:
            conn = get_conn()
            try:
                _tick(conn)
            finally:
                conn.close()
        except Exception as exc:  # keep the loop alive on any failure
            print(f"[simulator] tick failed: {exc}")
        await asyncio.sleep(TICK_S)
