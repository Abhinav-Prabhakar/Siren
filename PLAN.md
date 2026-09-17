# SIREN — Master Implementation Plan

**This file is the contract. Every agent must read it fully before writing code. UI and backend must match this schema exactly — field names are `snake_case` in JSON and TypeScript.**

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Next.js 16 frontend        │  HTTP  │  Python FastAPI backend      │
│  http://localhost:3000      │ ─────► │  http://localhost:8000/api   │
│  src/app, src/components    │  poll  │  server/ (SQLite siren.db)   │
└─────────────────────────────┘  4s    └──────────────────────────────┘
         ▲                                        ▲
         │ LlmChat component                      │ POST /api/vapi/webhook
         │ POST /api/chat                         │ (Vapi server events)
```

- **No Vercel. No deployment.** Everything runs on localhost.
- Backend: Python 3, FastAPI + uvicorn, SQLite via stdlib `sqlite3`. Deps: `fastapi`, `uvicorn[standard]`. Nothing else unless essential.
- Frontend: Next.js 16 App Router, Tailwind v4, React 19. All data via `src/lib/api.ts`.
- CORS: allow `http://localhost:3000` (and `http://127.0.0.1:3000`).

## Hard rules

- **NEVER run `next dev`, `next start`, or any long-running frontend server.** Verify with `npx tsc --noEmit` and `npx eslint <your files>` only — do NOT run `npm run build` (other agents are building concurrently; the orchestrator runs the final build). Backend agent may briefly run uvicorn + curl to smoke-test, then kill it.
- Use the design system in `src/components/ui/` for EVERYTHING. No raw divs-as-cards when a `Panel` exists. No border radius anywhere. Palette: ink/coal/smoke backgrounds, `flame`/`blaze`/`blood` accents, `bone` text, `ash` muted. Utilities available: `clip-chamfer`, `clip-tag`, `bg-grid`, `bg-scanlines`, `text-glow`, `bg-hazard-tight`. Fonts: `font-display`, `font-sans`, `font-mono`.
- **Next.js 16 breaking changes**: `params`/`searchParams` are async — `await` them. Use the generated helpers: `PageProps<'/route'>`, `LayoutProps<'/'>`. `middleware.ts` is now `proxy.ts` (we don't need either). Client components need `"use client"` at the top. `next/font/google` is already wired in the root layout.
- JSON is `snake_case` end-to-end. TypeScript interfaces in `src/lib/api.ts` already mirror it — do not rename fields, do not create parallel type definitions.
- Poll backend every **4 s** via `usePolling` from `src/lib/use-polling.ts`.

## Database schema (SQLite, `server/siren.db`)

All timestamps ISO-8601 UTC strings. IDs are human-readable text.

```sql
stations(id TEXT PK, name TEXT, code TEXT, address TEXT, lat REAL, lng REAL);

vehicles(id TEXT PK, station_id TEXT REFERENCES stations(id),
  name TEXT, callsign TEXT, type TEXT, status TEXT,
  fuel_pct REAL, water_pct REAL, foam_pct REAL, battery_v REAL,
  mileage_km REAL, pump_pressure_bar REAL,
  lat REAL, lng REAL, speed_kmh REAL,
  incident_id TEXT, free_at TEXT, updated_at TEXT);
-- type:    pumper|tender|ladder|rescue|ambulance|hazmat|command|special
-- status:  available|dispatched|en_route|on_scene|returning|refuel|out_of_service

personnel(id TEXT PK, station_id TEXT REFERENCES stations(id),
  name TEXT, role TEXT, rank TEXT, status TEXT,
  vehicle_id TEXT, incident_id TEXT,
  heart_rate INT, scba_pct REAL, lat REAL, lng REAL,
  shift_start TEXT, shift_end TEXT, updated_at TEXT);
-- role:    firefighter|driver|chief|incident_commander|paramedic
-- status:  on_duty|dispatched|en_route|on_scene|resting|off_duty

equipment(id TEXT PK, station_id TEXT REFERENCES stations(id),
  vehicle_id TEXT, name TEXT, category TEXT, status TEXT,
  battery_pct REAL, condition_pct REAL, serial TEXT,
  last_check TEXT, updated_at TEXT);
-- category: hose|nozzle|scba|ppe|breaching|ladder|hydraulic|medical|rope|
--           thermal|fan|pump|generator|lighting|foam|hazmat|radio|cylinder
-- status:   ready|in_use|maintenance|missing

incidents(id TEXT PK, classification TEXT, priority TEXT, status TEXT,
  address TEXT, lat REAL, lng REAL,
  reported_at TEXT, resolved_at TEXT,
  wind TEXT, wind_dir TEXT, temp_c REAL, humidity_pct REAL, precip TEXT,
  notes TEXT);
-- priority: P1|P2|P3|P4     status: active|contained|monitoring|resolved

calls(id TEXT PK, incident_id TEXT, vapi_call_id TEXT,
  caller_name TEXT, caller_number TEXT,
  started_at TEXT, ended_at TEXT, duration_s INT,
  transcript TEXT, summary TEXT, extracted TEXT /* json array */, live INT);

dispatches(id TEXT PK, incident_id TEXT REFERENCES incidents(id),
  status TEXT, proposed_by TEXT, notes TEXT,
  created_at TEXT, decided_at TEXT);
-- status: pending|approved|rejected|completed   proposed_by: agent|operator
dispatch_vehicles(dispatch_id TEXT, vehicle_id TEXT);
dispatch_personnel(dispatch_id TEXT, personnel_id TEXT);
dispatch_equipment(dispatch_id TEXT, equipment_id TEXT);

events(id INTEGER PK AUTOINCREMENT, ts TEXT, tag TEXT, message TEXT, tone TEXT);
-- tone: flame|bone|ash

telemetry(id INTEGER PK AUTOINCREMENT, entity_type TEXT, entity_id TEXT,
  metric TEXT, value REAL, ts TEXT);
-- entity_type: vehicle|personnel|equipment
-- metrics: fuel_pct|water_pct|battery_v|speed_kmh|heart_rate|scba_pct|battery_pct

chat_messages(id INTEGER PK AUTOINCREMENT, role TEXT, content TEXT, ts TEXT);
-- role: user|assistant
```

## REST API — FastAPI, base `http://localhost:8000`, all under `/api`

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{status:"ok"}` |
| GET | `/api/overview` | `Overview` (below) |
| GET | `/api/vehicles` | `Vehicle[]` |
| GET | `/api/vehicles/{id}` | `VehicleDetail` = Vehicle + `crew: Personnel[]` + `equipment: Equipment[]` |
| GET | `/api/equipment?category=&status=` | `Equipment[]` |
| GET | `/api/equipment/{id}` | `EquipmentDetail` = Equipment + `vehicle_name`, `station_name` |
| GET | `/api/personnel?status=&role=` | `Personnel[]` |
| GET | `/api/personnel/{id}` | `PersonnelDetail` = Personnel + `vehicle_name`, `incident_address` |
| GET | `/api/incidents?status=` | `Incident[]` (+ `call_count`, `unit_count` on each) |
| GET | `/api/incidents/{id}` | `IncidentDetail` = Incident + `calls`, `dispatches`, `vehicles`, `personnel` |
| GET | `/api/calls?live=` | `Call[]` |
| GET | `/api/dispatches?status=` | `Dispatch[]` (+ `vehicle_ids`, `personnel_ids`, `equipment_ids`, `incident_address`, `incident_classification`, `incident_priority`) |
| POST | `/api/dispatches/{id}/approve` | updated `Dispatch`; sets status `approved`, stamps `decided_at`, marks assigned vehicles/personnel `dispatched`, writes an `events` row |
| POST | `/api/dispatches/{id}/reject` | updated `Dispatch`; status `rejected`, writes an `events` row |
| GET | `/api/events?limit=50` | `Event[]` newest-last |
| GET | `/api/telemetry/{entity_type}/{entity_id}?metric=&limit=60` | `TelemetryPoint[]` `{metric,value,ts}` chronological |
| POST | `/api/chat` body `{message}` | `{reply, ts}` — rule-based stub answering from live DB state (counts, statuses). No real LLM. Persist both messages to `chat_messages`. |
| GET | `/api/chat/history` | `ChatMessage[]` |
| POST | `/api/vapi/webhook` | **Owned by Vapi agent** — receives Vapi server messages, upserts `calls`/`incidents`, writes `events`. |

`Overview` = `{ station: Station, counts: { vehicles: Record<status,int>, personnel: Record<status,int>, equipment: Record<status,int>, active_incidents: int, pending_dispatches: int, live_calls: int }, latest_events: Event[] }`.

**Telemetry simulator**: backend runs an asyncio background task (~4 s tick) that drifts `fuel_pct`, `water_pct`, `speed_kmh`, `battery_v`, `heart_rate`, `scba_pct`, equipment `battery_pct`, jitter `lat/lng` for en-route units, and appends `telemetry` rows (cap history, keep last ~500/entity). This makes the monitoring UI live.

**Seed data** (`server/seed.py`, run at startup if DB empty): one station `STA-01 "Siren Central"`; ~8 vehicles across types; ~14 personnel across roles; ~30 equipment items across categories; 2 active incidents (one P1 structure fire, one P2 MVA) + 1 resolved; 3 calls (1 live, 2 ended, one sharing the P1 incident to show grouping); 2 pending dispatches proposed by `agent`; ~30 event rows; telemetry history for charts.

## File ownership — do NOT edit files outside your lane

| Agent | Owns |
|---|---|
| Orchestrator (done) | `PLAN.md`, `src/lib/api.ts`, `src/lib/use-polling.ts`, `src/components/console-nav.tsx`, `src/components/chat/llm-chat.tsx` (stub), `.gitignore`, `README.md` |
| Backend | `server/**` EXCEPT `server/routers/vapi.py` and `server/vapi/**` — auto-discover routers: `app.py` must import every `server/routers/*.py` module and include its `router` if present (use `pkgutil.iter_modules` or explicit try/import). Also updates `README.md` getting-started. |
| Vapi | `server/routers/vapi.py`, `server/vapi/**` (assistant spec, docs), `.env.example` additions at `server/.env.example` |
| Vehicles UI | `src/app/vehicles/**`, `src/components/vehicles/**` |
| Equipment UI | `src/app/equipment/**`, `src/components/equipment/**` |
| People UI | `src/app/people/**`, `src/components/people/**` |
| Chat | `src/components/chat/llm-chat.tsx` (replace stub completely) |
| Home | `src/app/page.tsx` only (imports `<LlmChat/>`, `<ConsoleNav/>`, `api` — they exist per this spec) |

If you need a shared helper that doesn't exist, put it inside your own folder — never edit `src/lib/api.ts`, `src/components/ui/*`, or another agent's files.

## Frontend conventions

- Fetch via `api.*` from `src/lib/api.ts` + `usePolling(fetcher, 4000)`. Pages are `"use client"` components.
- Page shell: `<ConsoleNav/>` at top, then a `PageHeader` (`back={{href:"/",label:"Console"}}`, `title`, `sub`, `status` slot for a `Badge`/live `Led`, `actions` for Buttons), then Panel grids.
- `statusTone(status)` in `api.ts` maps any status string → `BadgeTone`. Use it everywhere.
- Numbers/telemetry: `Meter` for 0–100 levels (fuel, water, SCBA, battery), `RadialGauge` for hero metrics, `Sparkline` for history (from `/api/telemetry`), `BarChart` for distributions, `Stat` for counts, `DataTable` for dense lists, `Timeline` for events/shift history, `LogFeed` for the event stream, `WeatherStrip` for incident weather, `CrewChip`/`UnitCard`/`IncidentCard`/`CallCard` for entity cards, `Modal` for detail/approve dialogs, `Tabs`/`Select`/`Checkbox`/`Switch`/`Slider` for filters, `Skeleton` while loading, `Alert` for API-down state.
- Loading state: `Skeleton` blocks. Error state: `Alert tone="critical"` saying backend unreachable at `localhost:8000`.
- Empty-ish decorative map allowed: a `bg-grid` panel with positioned unit markers is in-theme; no map library.

## Design-system quick reference (props)

- `Panel{title?, right?, led?:"off"|"on"|"pulse", chamfered?, bodyClassName?}`
- `PageHeader{title, sub?, back?:{href,label}, status?, actions?}`
- `Stat{label, value, sub?}` · `Meter{label, value:0-100, segments?, lowAt?}` · `RadialGauge{value:0-100, size?, variant?:"gauge"|"ring", label?, sub?}` · `Sparkline{data:number[], width?, height?, fill?, marker?}` · `BarChart{data:{label,value,muted?}[], height?, grid?}`
- `Badge{tone?:BadgeTone}` — `hot|warm|cold|dead|plain` · `Led{tone?:"flame"|"blaze"|"bone"|"off", pulse?, size?}` · `Alert{tone?:"critical"|"warning"|"info"|"ok", title?}`
- `DataTable{columns:{key,label,align?,className?}[], rows:Record<string,ReactNode>[], dense?}` · `Tabs{tabs:{id,label,led?,count?}[], activeId?, defaultId?, onChange?}`
- `Button{variant?:"solid"|"outline"|"ghost", size?:"sm"|"md"|"lg", led?:"off"|"on"|"pulse", block?, href?}` · `Modal{open,onClose,title?,led?,footer?}` — dispatch approvals live here
- `Input{label?,glyph?}` · `Textarea{label?}` · `Select{label?}` · `Switch{label?,checked?,onCheckedChange?}` · `Checkbox{label?,checked?,onCheckedChange?}` · `Slider` · `Divider{label?}` · `Kbd` · `Skeleton{className?}`
- `UnitCard{unit:{id,name,role,status,statusTone,location,freeAt,fuel,water}}` · `CrewChip{member:{name,role,status?,freeAt?,onDuty?}}` · `IncidentCard{incident:{id,priority,classification,address,reportedAgo,status?,statusTone?,calls?,units?[]}, actions?}` · `CallCard{call:{caller,number,duration,transcript,extracted?[],live?}, actions?}` · `LogFeed{lines:{time,tag?,text,tone?}[]}` · `Timeline{items:{time,title,detail?,tone?,node?}[]}` · `WeatherStrip{wind,windDir?,temp,humidity,precip}`

## Vapi scope (Vapi agent)

Read real docs (docs.vapi.ai) via webfetch. Deliver:

1. `server/routers/vapi.py` — `router = APIRouter()` (auto-mounted). `POST /api/vapi/webhook` handling Vapi **server messages**: `assistant-request`, `function-call`, `transcript`, `end-of-call-report`, `status-update`. Upsert `calls` rows keyed by `vapi_call_id`; on `function-call` `create_incident`/`update_incident`/`dispatch_units`, write incidents/dispatches (`proposed_by="agent"`, status `pending` — human approves). Multiple calls may map to one incident — match on normalized address or explicit incident id returned to the assistant. Write `events` rows for each call lifecycle.
2. `server/vapi/assistant.json` + `server/vapi/README.md` — the intake assistant spec: system prompt, model, voice, `serverUrl`, tool definitions matching the webhook handlers, setup instructions (env vars `VAPI_API_KEY`, `VAPI_SERVER_URL`/`VAPI_WEBHOOK_SECRET`).

Do NOT touch `server/app.py`, `server/db.py`, or other routers — the auto-loader picks up your router.

## LLM chat scope (Chat agent)

`src/components/chat/llm-chat.tsx` exports `LlmChat({className?: string})`, `"use client"`. A `Panel` (title `"AGENT LINK // SIREN-1"`, `led="pulse"`) containing: scrollable message history (user right/flame accent, agent left/bone), `POST /api/chat` via `api.chat(message)` on submit, typing/pending state (animated Led or Skeleton), loads `api.chatHistory()` on mount, Input + solid Button send, `Kbd` hint for Enter. Red-on-black, zero radius, monospace timestamps. No real LLM calls — backend stub replies. No other files.

## Definition of done

- `server/` runs: `cd server && uvicorn app:app --port 8000` serves all endpoints with seed data.
- Frontend pages render from live API with polling, loading + error states, all design-system.
- Orchestrator runs `npm run build` + `npm run lint` at the end.

---

# Phase 2 — make it fully functional

**No mocks, no fabricated data, no silent fallbacks.** Every number on screen comes from the API. Errors get real error UI. If a subsystem is down, say so — never fake it.

## New/changed backend contract (backend agent implements; api.ts already updated)

- **Real LLM chat.** `POST /api/chat` now calls the OpenAI-compatible endpoint: `POST {VOIDAI_BASE_URL}/chat/completions`, env `VOIDAI_API_KEY`, `VOIDAI_BASE_URL`, `VOIDAI_MODEL` (default `gpt-5-nano`). Use the `openai` pip package (`openai>=1.0` in requirements.txt) with `base_url`. System prompt: SIREN-1 dispatch copilot + a compact live snapshot built from the DB at call time (units by status, personnel on duty, active incidents w/ priority+address, pending dispatches, live calls). Keep history: load last ~20 `chat_messages` as context. On LLM/network failure → HTTP 503 `{"detail": "..."}` — do NOT fake a reply. Load env from `server/.env` with a tiny stdlib parser in `server/env.py` (split on first `=`, strip, skip blanks/comments); if `VOIDAI_API_KEY` missing → 503 with clear detail.
- **Settings + night mode.** New table `settings(key TEXT PK, value TEXT)`. `GET /api/settings` → `{night_mode: bool}`. `POST /api/settings/night-mode {enabled: bool}` → flips flag; when enabling, auto-approve ALL currently-pending dispatches (same side-effects as manual approve). Simulator tick also auto-approves any `pending` dispatch while night_mode=on (covers agent/vapi proposals arriving later). Event rows for every auto-approval (tag `NIGHT`).
- **Manual dispatch.** `POST /api/dispatches {incident_id, vehicle_ids[], personnel_ids[], equipment_ids[], notes?}` → creates dispatch `proposed_by='operator'`, `status='approved'` immediately, applies assignment side-effects (vehicles/personnel → `dispatched`, `incident_id` set, equipment → `in_use`), writes event (tag `OPS`). Validate ids exist; 404/422 on bad ids. Also `GET /api/dispatches` gains no filter change — keep.
- **External contacts.** `incidents` gains column `external_contacts TEXT` (JSON array `[{service, ts}]`). `POST /api/incidents/{id}/contact {service}` (ems|police|utility|gas|other string) → appends, writes event (tag `EXT`), returns updated `Incident`. Include `external_contacts` parsed as array in incident responses.
- **Incident report PDF.** `GET /api/incidents/{id}/report` → `application/pdf` download (`Content-Disposition: attachment; filename=<id>-report.pdf`). Use `fpdf2` (add to requirements). Contents: header (SIREN post-incident report, generated ts), incident meta (id, classification, priority, status, address, reported/resolved, weather snapshot), responding units/crew/equipment tables, calls w/ summaries, external contacts, event timeline for that incident. 404 if incident missing.
- **Dispatch lifecycle in simulator.** Approved dispatches progress: assigned vehicles `dispatched`→`en_route` (coords interpolate toward incident, speed 40–70, set `free_at` ETA) → `on_scene` (speed 0, pump_pressure rises on pumpers) → when incident hits `resolved`: units `returning` (move back to station) → `available` (clear incident_id/free_at, speed 0). Personnel mirror their vehicle's phase. Incidents: `active`→(after units on_scene ~90s)`contained`→(~60s)`resolved` (stamp `resolved_at`). Events at every transition (tag `INC`/`UNIT`). Weather drifts on active incidents (temp ±, wind, humidity). Keep tick ~4s; make movement believable (km-scale steps).
- **Schema migration**: `init_db` must add `settings` table + `incidents.external_contacts` column to an EXISTING siren.db (PRAGMA user_version or try/except ALTER + INSERT OR IGNORE). Don't break the seeded DB.
- **Seed add-ons**: one incident with `external_contacts` already populated; ensure telemetry history exists for enough entities.

## New endpoints summary (api.ts already has these)

`api.createDispatch`, `api.settings`, `api.setNightMode`, `api.contactService`, `api.reportUrl(id)` — plus `Incident.external_contacts?: {service,ts}[]`, `Settings{night_mode}` types. UI agents: use these; do not edit api.ts.

## Phase-2 file ownership

| Agent | Owns |
|---|---|
| Backend-2 | `server/**` except `server/routers/vapi.py`, `server/vapi/**` (may add `routers/settings.py`, `routers/reports.py`, `env.py`, `llm.py`, `tests/**`) |
| Incidents UI | `src/app/incidents/**`, `src/components/incidents/**` |
| Console-2 | `src/app/page.tsx`, `src/components/console/**` (add night-mode Switch, manual-dispatch Modal, decided-dispatch visibility, external-contact buttons in incident modal) |
| De-mock | `src/components/equipment/**`, `src/components/people/**`, `src/components/vehicles/**` — remove fabricated/reconstructed data, make every state honest; also fix any mock found in `src/app/equipment|people|vehicles/**` |

## Testing

- Backend-2 writes `server/tests/` (pytest, FastAPI TestClient on a temp DB — `tmp_path`/`SIREN_DB` env override or app factory param): health, overview shape, each list+detail endpoint, dispatch approve/reject side-effects, manual dispatch, night-mode auto-approve, contact endpoint, report returns `application/pdf`, telemetry, chat 503-without-key vs real-reply-with-key (call the real endpoint ONCE — it's cheap; no mocking of the LLM, we want proof it works). Keep total real LLM calls ≤2.
- `server/tests/` runnable via `cd server && .venv/bin/python -m pytest tests/ -q` (add `pytest`, `httpx` to requirements.txt).
- Orchestrator runs `npm run build` + `eslint` at the end.

## Robustness review (final agent, after wave 1)

Read-only review across `server/` + `src/`: contract drift vs PLAN.md, error paths, SQL injection (all queries parameterized), leaked secrets, unhandled promise rejections, race conditions in simulator, dead UI controls (buttons that do nothing = bug). Fixes small things directly; reports anything structural.
