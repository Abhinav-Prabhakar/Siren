"""GET /api/incidents/{id}/report — post-incident PDF report (fpdf2)."""
import json
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from fpdf import FPDF
from fpdf.enums import XPos, YPos

from db import get_conn, now_iso, row_dict, rows_dicts

router = APIRouter(prefix="/api", tags=["reports"])

_REPLACEMENTS = {
    "—": "-", "–": "-", "’": "'", "‘": "'", "“": '"', "”": '"',
    "→": "->", "…": "...", "°": " deg ", "±": "+/-",
}


def _latin(s) -> str:
    """fpdf2 core fonts are latin-1 — fold anything outside down safely."""
    s = "" if s is None else str(s)
    for k, v in _REPLACEMENTS.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def _heading(pdf: FPDF, text: str) -> None:
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(180, 30, 30)
    pdf.cell(0, 8, _latin(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)


def _line(pdf: FPDF, text: str, bold: bool = False) -> None:
    pdf.set_font("courier", "B" if bold else "", 9)
    pdf.multi_cell(0, 4.5, _latin(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def _table(pdf: FPDF, headers, rows) -> None:
    if not rows:
        _line(pdf, "  (none)")
        return
    pdf.set_font("courier", "B", 8)
    pdf.cell(0, 5, _latin("  ".join(h.ljust(14) for h in headers)),
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("courier", "", 8)
    for r in rows:
        pdf.cell(0, 5, _latin("  ".join(str(c)[:14].ljust(14) for c in r)),
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)


@router.get("/incidents/{incident_id}/report")
def incident_report(incident_id: str):
    conn = get_conn()
    try:
        inc = row_dict(conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone())
        if inc is None:
            raise HTTPException(status_code=404, detail="incident not found")

        # Responding resources: currently attached OR dispatched to this incident.
        vehicles = rows_dicts(conn.execute(
            """SELECT DISTINCT v.* FROM vehicles v
               LEFT JOIN dispatch_vehicles dv ON dv.vehicle_id = v.id
               LEFT JOIN dispatches d ON d.id = dv.dispatch_id
               WHERE v.incident_id = ? OR d.incident_id = ?
               ORDER BY v.id""",
            (incident_id, incident_id),
        ).fetchall())
        personnel = rows_dicts(conn.execute(
            """SELECT DISTINCT p.* FROM personnel p
               LEFT JOIN dispatch_personnel dp ON dp.personnel_id = p.id
               LEFT JOIN dispatches d ON d.id = dp.dispatch_id
               WHERE p.incident_id = ? OR d.incident_id = ?
               ORDER BY p.id""",
            (incident_id, incident_id),
        ).fetchall())
        equipment = rows_dicts(conn.execute(
            """SELECT DISTINCT e.* FROM equipment e
               LEFT JOIN dispatch_equipment de ON de.equipment_id = e.id
               LEFT JOIN dispatches d ON d.id = de.dispatch_id
               WHERE d.incident_id = ?
               ORDER BY e.id""",
            (incident_id,),
        ).fetchall())
        calls = rows_dicts(conn.execute(
            "SELECT * FROM calls WHERE incident_id = ? ORDER BY started_at",
            (incident_id,),
        ).fetchall())
        events = rows_dicts(conn.execute(
            "SELECT ts, tag, message FROM events WHERE message LIKE '%' || ? || '%' ORDER BY ts",
            (incident_id,),
        ).fetchall())
        try:
            contacts = json.loads(inc.get("external_contacts") or "[]")
        except (TypeError, json.JSONDecodeError):
            contacts = []
    finally:
        conn.close()

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ---- header ----------------------------------------------------------
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(200, 20, 20)
    pdf.cell(0, 10, "SIREN // POST-INCIDENT REPORT",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("courier", "", 9)
    pdf.cell(0, 5, _latin(f"Incident: {incident_id}    Generated: {now_iso()}"),
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)

    # ---- meta -------------------------------------------------------------
    _heading(pdf, "INCIDENT")
    for label, val in (
        ("Classification", inc["classification"]),
        ("Priority", inc["priority"]),
        ("Status", inc["status"]),
        ("Address", inc["address"]),
        ("Reported", inc["reported_at"]),
        ("Resolved", inc["resolved_at"] or "—"),
        ("Location", f"{inc['lat']}, {inc['lng']}"),
        ("Notes", inc["notes"] or ""),
    ):
        _line(pdf, f"{label:<14}: {val}")
    pdf.ln(3)

    # ---- weather -----------------------------------------------------------
    _heading(pdf, "WEATHER AT SCENE")
    _line(pdf, f"Wind {inc['wind'] or '?'} {inc['wind_dir'] or ''}   "
               f"Temp {inc['temp_c']} C   Humidity {inc['humidity_pct']}%   "
               f"Precip {inc['precip'] or 'none'}")
    pdf.ln(3)

    # ---- responding units ---------------------------------------------------
    _heading(pdf, f"RESPONDING UNITS ({len(vehicles)})")
    _table(pdf, ["ID", "CALLSIGN", "TYPE", "STATUS"],
           [(v["id"], v["callsign"], v["type"], v["status"]) for v in vehicles])
    pdf.ln(3)

    _heading(pdf, f"CREW ({len(personnel)})")
    _table(pdf, ["ID", "NAME", "ROLE", "STATUS"],
           [(p["id"], p["name"], p["role"], p["status"]) for p in personnel])
    pdf.ln(3)

    _heading(pdf, f"EQUIPMENT DEPLOYED ({len(equipment)})")
    _table(pdf, ["ID", "NAME", "CATEGORY", "STATUS"],
           [(e["id"], e["name"], e["category"], e["status"]) for e in equipment])
    pdf.ln(3)

    # ---- calls ----------------------------------------------------------------
    _heading(pdf, f"CALLS ({len(calls)})")
    if not calls:
        _line(pdf, "  (none)")
    for c in calls:
        _line(pdf, f"{c['id']}  {c['caller_name'] or 'unknown'}  {c['caller_number'] or ''}  "
                   f"{c['started_at']}  dur {c['duration_s'] or 0}s", bold=True)
        if c["summary"]:
            _line(pdf, f"  {c['summary']}")
    pdf.ln(3)

    # ---- external contacts ------------------------------------------------------
    _heading(pdf, f"EXTERNAL CONTACTS ({len(contacts)})")
    if not contacts:
        _line(pdf, "  (none)")
    for ct in contacts:
        _line(pdf, f"  {ct.get('service', '?')}  @ {ct.get('ts', '?')}")
    pdf.ln(3)

    # ---- event timeline ------------------------------------------------------------
    _heading(pdf, f"EVENT TIMELINE ({len(events)})")
    if not events:
        _line(pdf, "  (none)")
    for e in events:
        _line(pdf, f"  {e['ts']}  [{e['tag']}]  {e['message']}")

    data = bytes(pdf.output())
    # incident_id comes from the URL path — keep the header value safe.
    safe_id = re.sub(r"[^A-Za-z0-9._-]", "_", incident_id)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_id}-report.pdf"'
        },
    )
