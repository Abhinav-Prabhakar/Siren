"""Telemetry simulator — asyncio background task.

Ticks every ~4s: drifts vehicle fuel/water/battery/speed, personnel heart rate
and SCBA, equipment battery; jitters lat/lng for moving units; appends
telemetry rows; prunes history to ~500 rows per entity+metric.
"""
import asyncio
import random

from db import get_conn, now_iso

TICK_S = 4.0
KEEP_PER_METRIC = 500
MOVING = ("dispatched", "en_route", "returning")


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _tick(conn) -> None:
    now = now_iso()
    tele = []          # (entity_type, entity_id, metric, value)
    touched = set()    # (entity_type, entity_id, metric) for pruning

    # ---- vehicles --------------------------------------------------------
    for v in conn.execute("SELECT * FROM vehicles").fetchall():
        status = v["status"]
        moving = status in MOVING
        working = moving or status == "on_scene"

        fuel = _clamp(v["fuel_pct"] - random.uniform(0.005, 0.05 if working else 0.01), 2.0, 100.0)
        water = v["water_pct"]
        if status == "on_scene" and water:
            water = _clamp(water - random.uniform(0.2, 1.0), 0.0, 100.0)
        batt = _clamp(v["battery_v"] + random.uniform(-0.06, 0.06), 11.8, 14.4)

        if status == "en_route":
            target = 58.0
        elif status == "returning":
            target = 42.0
        elif status == "dispatched":
            target = 50.0
        else:
            target = 0.0
        speed = _clamp(v["speed_kmh"] + (target - v["speed_kmh"]) * 0.15 + random.uniform(-4, 4),
                       0.0, 85.0)
        if target == 0.0 and speed < 2.0:
            speed = 0.0

        lat, lng = v["lat"], v["lng"]
        if moving and lat is not None and lng is not None:
            # jitter plus slow drift back toward the station for returning units
            lat += random.uniform(-0.0007, 0.0007)
            lng += random.uniform(-0.0007, 0.0007)

        mileage = v["mileage_km"] + speed * (TICK_S / 3600.0)

        conn.execute(
            """UPDATE vehicles SET fuel_pct=?, water_pct=?, battery_v=?, speed_kmh=?,
               lat=?, lng=?, mileage_km=?, updated_at=? WHERE id=?""",
            (round(fuel, 1), round(water, 1), round(batt, 2), round(speed, 1),
             lat, lng, round(mileage, 2), now, v["id"]),
        )
        for metric, val in (("fuel_pct", fuel), ("water_pct", water),
                            ("battery_v", batt), ("speed_kmh", speed)):
            tele.append(("vehicle", v["id"], metric, round(val, 2)))
            touched.add(("vehicle", v["id"], metric))

    # ---- personnel -------------------------------------------------------
    for p in conn.execute("SELECT * FROM personnel").fetchall():
        status = p["status"]
        if status == "on_scene":
            hr_target = 135.0
        elif status in MOVING:
            hr_target = 105.0
        elif status == "resting":
            hr_target = 62.0
        else:
            hr_target = 74.0
        hr = _clamp(p["heart_rate"] + (hr_target - p["heart_rate"]) * 0.08
                    + random.uniform(-2.5, 2.5), 55.0, 170.0)

        scba = p["scba_pct"]
        if status == "on_scene":
            scba = _clamp(scba - random.uniform(0.3, 0.9), 0.0, 100.0)
        else:
            scba = _clamp(scba + random.uniform(0.0, 0.3), 0.0, 100.0)

        lat, lng = p["lat"], p["lng"]
        if status in MOVING and lat is not None and lng is not None:
            lat += random.uniform(-0.0006, 0.0006)
            lng += random.uniform(-0.0006, 0.0006)

        conn.execute(
            """UPDATE personnel SET heart_rate=?, scba_pct=?, lat=?, lng=?, updated_at=?
               WHERE id=?""",
            (int(round(hr)), round(scba, 1), lat, lng, now, p["id"]),
        )
        for metric, val in (("heart_rate", hr), ("scba_pct", scba)):
            tele.append(("personnel", p["id"], metric, round(val, 2)))
            touched.add(("personnel", p["id"], metric))

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
