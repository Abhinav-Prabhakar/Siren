# SIREN — Technical Briefing

Everything you need to answer "how was this built?" at judging.
One-line pitch: **an AI dispatch agent (SIREN-1) that takes emergency calls by
voice, opens incidents, proposes which vehicles/crew/equipment to send — and a
human operator approves before anything rolls.**

---

## 1. System architecture

```
        emergency call                                operator
              │                                          │
              ▼                                          ▼
   ┌────────────────────┐                     ┌───────────────────────┐
   │ Vapi voice agent   │  server messages    │ Next.js 16 frontend   │
   │ (gpt-4o + Deepgram │ ──────────────────► │ :3000 — control room  │
   │  + ElevenLabs)     │  POST /api/vapi/    │ React 19 · Tailwind 4 │
   └─────────┬──────────┘       webhook       └───────────┬───────────┘
             │                                            │ REST poll 4s
             │                                            │ + SSE chat
             ▼                                            ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  FastAPI backend :8000  (uvicorn, stdlib sqlite3)             │
   │  · /api/* REST routers (auto-discovered)                      │
   │  · SIREN-1 chat agent — OpenAI-compatible LLM + function      │
   │    calling tool belt (11 tools, ~8 iteration cap)             │
   │  · asyncio simulator — 4s tick drives the whole world         │
   └───────────────────────────────┬───────────────────────────────┘
                                   │
                            SQLite — server/siren.db
                            14 tables, JSON columns for
                            extracted intel + contacts
```

Two LLM surfaces, two different roles:

| Surface | Model path | Job |
|---|---|---|
| **Voice intake** | Vapi assistant (`server/vapi/assistant.json`) — gpt-4o, Deepgram nova-3 STT, ElevenLabs TTS | Answers the phone, gathers classification/address/hazards/casualties, calls `create_incident` / `update_incident` / `dispatch_units` tools |
| **Control-room copilot** | OpenAI-compatible endpoint (`VOIDAI_*` env, default `gpt-5-nano`) | SIREN-1 chat — answers operator questions and acts through 11 function-calling tools against the live DB |

Everything runs on localhost. No deployment, no external DB.

---

## 2. Tech stack — and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind v4 | Component-driven dashboard, fast iteration, generated-route typing (`PageProps<'/resources'>`) |
| Backend | Python FastAPI + uvicorn | Typed REST for free, async lifespan for the simulator task, `StreamingResponse` for SSE |
| DB | SQLite via **stdlib `sqlite3`** | Zero infra; the whole world state lives in one file (`server/siren.db`). Per-request connections, `PRAGMA foreign_keys` |
| Voice | Vapi.ai | Managed telephony + STT + TTS + LLM turn-taking; we just implement one webhook |
| Agent LLM | `openai` python SDK, OpenAI-compatible `base_url` | Provider-agnostic — any compatible endpoint works via env |
| Reports | fpdf2 | Dependency-light server-side PDF generation |
| Design | Custom component library (`src/components/ui/`, 30+ components) | Gamified emergency-dispatch HUD: red-on-near-black, **zero border radius enforced globally** |

---

## 3. Data model (SQLite)

Schema lives in `server/db.py` (`SCHEMA`) — created idempotently, with
`ALTER TABLE` try/except migrations so an existing DB upgrades in place.

Core entities:

- **`stations`** — one station (`STA-01 "Siren Central"`), lat/lng anchor.
- **`vehicles`** — callsign, type (`pumper|tender|ladder|rescue|ambulance|hazmat|command|special`), status (`available|dispatched|en_route|on_scene|returning|refuel|out_of_service`), telemetry (fuel/water/foam/battery/mileage/pump pressure), live lat/lng/speed, `incident_id`, `free_at` ETA.
- **`personnel`** — role/rank, status, `vehicle_id` (they ride), vitals (`heart_rate`, `scba_pct`), shift window.
- **`equipment`** — 18 categories, status (`ready|in_use|maintenance|missing`), battery + condition %.
- **`incidents`** — classification, priority P1–P4, status (`active|contained|monitoring|resolved`), address + coords, **weather snapshot** (wind, temp, humidity, precip), notes, `external_contacts` JSON.
- **`calls`** — keyed by `vapi_call_id`, transcript, summary, `extracted` JSON intel, `live` flag, `incident_id` link (grouping).
- **`dispatches`** + three junction tables (`dispatch_vehicles`, `dispatch_personnel`, `dispatch_equipment`) — status `pending|approved|rejected|completed`, `proposed_by` `agent|operator`.
- **`events`** — append-only ops log (tag + tone) — everything that happens writes a row; this feeds the ops feed and the incident report timeline.
- **`telemetry`** — time-series points per entity+metric (indexed, pruned to ~500 rows/metric).
- **`chat_messages`** — persisted chat incl. `tool_calls` JSON per assistant turn.
- **`settings`** — key/value; holds `night_mode`.

Conventions: `snake_case` end-to-end (DB → JSON → TypeScript interfaces in
`src/lib/api.ts` mirror it exactly); human-readable IDs (`VEH-03`, `INC-001`,
`DSP-004`); all timestamps ISO-8601 UTC with `Z`.

Seed (`server/seed.py`, runs only when DB is empty): 1 station, 8 vehicles
(one per type, all available in quarters), 14 personnel (on duty), ~30
equipment items (ready, one flagged maintenance), a handful of station-ops
event rows, telemetry history for sparklines. **No incidents, calls or
dispatches are seeded** — every incident on the board comes from a real
intake (Vapi call, SIREN-1 chat, or manual dispatch).

---

## 4. REST API

All under `/api`, routers in `server/routers/*.py` **auto-discovered** at
startup (`pkgutil.iter_modules` — drop a file with a top-level `router` and it
mounts; `server/app.py` never changes).

| Endpoint | What it does |
|---|---|
| `GET /health`, `GET /overview` | Health; station + status counts + latest events |
| `GET /vehicles[/{id}]`, `/personnel`, `/equipment` | Lists (+filters) and hydrated detail views (crew, equipment, names) |
| `GET /incidents[/{id}]` | List w/ call+unit counts; detail = calls + dispatches + vehicles + personnel |
| `GET /calls` | Call records, `?live=` filter |
| `GET /dispatches` | Hydrated with resource id lists + incident context |
| `POST /dispatches` | **Manual dispatch** — operator-created, immediately `approved`, validates every id (404/422) |
| `POST /dispatches/{id}/approve|reject` | Operator decision; approve applies assignment side-effects (vehicles/personnel → `dispatched`, equipment → `in_use`, writes event). 409 if not `pending` |
| `POST /incidents/{id}/contact` | Logs external agency contact (ems/police/utility/…) onto `external_contacts` |
| `GET /incidents/{id}/report` | **Post-incident PDF** (fpdf2): meta, weather, responding units/crew/kit, calls, contacts, full event timeline |
| `GET /events?limit=` | Ops feed, chronological |
| `GET /telemetry/{type}/{id}` | Time series for charts/sparklines |
| `POST /chat`, `POST /chat/stream` | SIREN-1 — buffered or **SSE-streamed** replies (deltas + tool-call records + done/error frames) |
| `GET/DELETE /chat/history` | Persisted uplink log + purge |
| `GET /settings`, `POST /settings/night-mode` | Night watch toggle — enabling auto-approves all pending dispatches |
| `POST /vapi/webhook` | Vapi server-message endpoint |

Frontend polls every **4 s** via `usePolling` (`src/lib/use-polling.ts`) —
deliberately simple, self-healing through backend restarts. Chat uses SSE
because token streaming matters there; dashboards don't need it.

---

## 5. The agent — SIREN-1 (chat copilot)

`server/routers/chat.py` + `server/chat_tools.py`.

- **Real LLM, real tools.** `POST /api/chat` → OpenAI-compatible
  `chat.completions` with a function-calling tool belt. Loop runs until the
  model stops calling tools (cap 8 iterations, then a forced plain answer).
- **11 tools**, two classes:
  - *Act*: `propose_dispatch`, `create_incident`, `update_incident`,
    `contact_external_service` — they write real rows.
  - *Query*: `get_fleet_status`, `get_personnel`, `get_incidents`,
    `get_equipment`, `get_dispatches`, `get_telemetry`, `get_events`.
- **Live snapshot in the system prompt** every turn: night-watch state, units
  by status, on-duty crew, open incidents w/ priority+address, pending
  dispatches, live calls — plus last ~20 chat messages as history.
- **Every tool call returns a one-line operator summary** stored with the
  assistant message (`tool_calls` column) and rendered as `⚙ tool — result`
  lines in the UI, so the operator sees *what the agent did*, not just what it
  said.
- **Honest failure**: no `VOIDAI_API_KEY`, missing `openai` package, or LLM
  error → HTTP 503 with a clear detail. The UI shows `UPLINK LOST`. Nothing is
  ever faked.
- **SSE streaming** (`/chat/stream`): token deltas, then `{type:"tool"}`
  frames as each tool executes, then `done`. The browser drains the stream and
  patches the assistant bubble live.

### Guardrails (the part judges usually probe)

- `propose_dispatch` is the **only** tool that moves resources, and it can
  only ever create `status='pending', proposed_by='agent'` — a human approves
  in the UI. The tool description tells the model this explicitly.
- **Night watch** (`settings.night_mode`): while armed, agent proposals
  auto-approve via the same `apply_approval()` path as a manual click. *The
  model cannot toggle night watch* — it's an operator-only switch, so the
  agent can never self-authorize.
- Validation everywhere: unknown resource ids → tool-level error returned to
  the model (it can recover); resolved incidents refuse dispatch; soft
  warnings when a proposed unit isn't `available`/`on_duty`/`ready`.
- Tool failures roll back the transaction and are reported to the model —
  never silently swallowed.

---

## 6. Voice intake — Vapi

`server/routers/vapi.py` + `server/vapi/assistant.json`.

- `POST /api/vapi/webhook` handles Vapi **server messages**:
  `assistant-request` (returns the transient assistant spec),
  `tool-calls`/`function-call`, `transcript` (finals only), `status-update`,
  `end-of-call-report`, `hang`; everything else acked with `200 {}`. Handler
  errors still return 200 so Vapi never retry-storms.
- **Call lifecycle → DB**: `calls` rows upserted by `vapi_call_id`; caller
  name/number from `call.customer`; transcripts appended line-by-line;
  end-of-call report persists summary, duration, structured data, recording
  URL into `extracted`.
- **Incident grouping** — multiple calls about the same event merge:
  `create_incident` matches an explicit `incident_id` first, then a
  *normalized address* (lowercase, punctuation stripped) across unresolved
  incidents; a match links the call and returns `matched_existing: true`
  instead of duplicating the incident.
- **`dispatch_units` auto-composition**: if the caller never names units, the
  backend picks an appropriate mix by classification
  (`_CLASSIFICATION_UNITS`: structure fire → pumper+ladder+command, MVA →
  rescue+ambulance+pumper, …), fills crew from on-duty personnel, and still
  lands as `pending` for human approval.
- **Assistant spec** (gpt-4o, temp 0.2): emergency-intake system prompt —
  gather classification/address/hazards/casualties/caller info, call tools
  early, give life-safety guidance to callers in immediate danger, read back
  critical facts, never say units are confirmed "on the way" (they're
  *proposed*). ElevenLabs voice, Deepgram nova-3 transcription, end-call
  phrases, 10-min max, structured-data + success-evaluation analysis plan.
- **Auth**: optional `VAPI_WEBHOOK_SECRET` checked with `hmac.compare_digest`
  against `x-vapi-secret` or `Authorization: Bearer`.
- Setup: `assistant.json` POSTs to `api.vapi.ai/assistant`; an ngrok tunnel
  exposes the local webhook; `VAPI_SERVER_URL` substitutes the tunnel URL into
  the spec at `assistant-request` time.

---

## 7. The world simulator

`server/simulator.py` — one asyncio task, **4 s tick**, single transaction per
tick. This is what makes the dashboard a *living* system rather than a static
demo:

- **Telemetry drift**: fuel/water/battery/speed, heart rate (targets by phase:
  ~74 on duty, ~105 en route, ~135 on scene, ~62 resting), SCBA drawdown on
  scene, equipment battery. Every metric appends `telemetry` rows, pruned to
  500/entity+metric.
- **Dispatch lifecycle**: `dispatched → en_route` (coordinates interpolated
  toward the incident at 40–70 km/h in real degree steps, `free_at` = ETA) →
  `on_scene` (speed 0, pumpers build pump pressure, water drops) → incident
  resolves → `returning` (back to station) → `available`.
- **Incident lifecycle**: `active` → `contained` 90 s after first unit on
  scene → `resolved` 60 s later (stamps `resolved_at`, releases all units).
- **Personnel mirror their vehicle's phase** — crew riding a truck inherit its
  position/status automatically.
- **Weather drifts** on unresolved incidents (temp, humidity, wind speed/dir).
- **Night watch check each tick** — any `pending` dispatch auto-approves while
  armed (covers proposals arriving between ticks).
- Failure-tolerant: a tick exception is logged and the loop continues;
  `SIREN_DISABLE_SIM=1` freezes the world for tests.

---

## 8. Frontend

Routes (App Router):

| Route | What |
|---|---|
| `/` | **Control room** — station vitals, weather at the hottest incident, active incidents, inbound calls, pending dispatch approvals (approve/reject), decided-dispatch log, night-watch switch, manual "New dispatch" modal, AGENT LINK chat |
| `/resources` | Consolidated deck — vehicles/equipment/people behind a vertical tab rail (`?tab=` deep-links; old `/vehicles` `/equipment` `/people` redirect). Fleet-readiness panel, resource alerts (flagged kit, vitals-critical crew), ops feed, station render background |
| `/incidents` | Incident board by status, icon-driven cards, detail panel with units/calls/contacts + PDF report download |
| `/components` | Full design-system showcase (every component, live) |
| `/presentation` | Built-in pitch deck — cover, solution, architecture, feasibility, impact slides |

Conventions:

- All data flows through the typed client `src/lib/api.ts` + `usePolling(…, 4000)`.
- **Honest states**: `Skeleton` while loading; `Alert tone="critical"` when the
  backend is unreachable, `warning` when a feed degrades but stale data is on
  screen; polling keeps retrying and self-heals. No fabricated numbers — every
  figure on screen came from the API.
- **Design language**: gamified emergency-dispatch HUD. Custom 30+ component
  library (`Panel`, `Led`, `Meter`, `RadialGauge`, `Sparkline`, `DataTable`,
  `LogFeed`, `Timeline`, `WeatherStrip`, `UnitCard`, `IncidentCard`, `Modal`…).
  Palette is all red-spectrum on near-black (`flame/blaze/blood` accents,
  `ink/coal/smoke` backgrounds); **border-radius is forced to 0 globally** and
  signature `clip-chamfer`/`clip-tag` corner cuts replace rounding. Scanlines,
  grid backgrounds, hazard stripes, glow. Fonts: Barlow Semi Condensed
  (display), Barlow (body), IBM Plex Mono (data).
- `statusTone()` maps any backend status → badge tone, one place.
- `station-bg.png` (the resources-page hero) was rendered from `draft/` — a
  Three.js isometric fire-station scene (orthographic camera, bloom pass,
  hand-built station/engine/prop geometry) screenshotted to a static asset.

---

## 9. Testing & verification

- `server/tests/` — pytest + FastAPI `TestClient` against a **throwaway seeded
  SQLite DB** (`SIREN_DB` env override, `SIREN_DISABLE_SIM=1`): health,
  overview shape, every list+detail endpoint, approve/reject side-effects,
  manual-dispatch validation, night-mode auto-approve, contact logging, PDF
  returns `application/pdf`, chat 503-without-key, plus a real-LLM smoke test
  (skipped without a key — proof it works, ≤2 live calls).
- `test_chat_tools.py` — every tool handler directly: validation errors,
  resolved-incident refusal, busy-resource warnings, unit release on resolve,
  night-mode auto-approval.
- Frontend: `npm run build` + `npm run lint` (Next.js 16 / eslint).
- Run: `cd server && .venv/bin/python -m pytest tests/ -q`.

---

## 10. How it was built

The repo was built in agent-driven phases coordinated by `PLAN.md` — a written
contract fixing the schema, API surface, file ownership per agent, design
rules and definition of done. Phase 1: schema + backend + design system +
dashboard. Phase 2: real LLM chat, dispatch lifecycle, night mode, external
contacts, PDF reports, test suite. Phase 3: resources consolidation, then
hardening (SSE chat, auto-intake, icon-driven incidents). `git log` tells the
same story.

This is why the codebase is unusually contract-clean: `snake_case` everywhere,
one API client, one polling hook, one design system.

---

## 11. Likely judge questions — quick answers

**"Where does the AI actually act vs. assist?"**
Two bounded surfaces: the Vapi agent only *proposes* (incidents + pending
dispatches); the chat agent has 11 tools but `propose_dispatch` is its only
lever — also pending-only. Humans hold the approve/reject keys. Night watch is
the documented exception, and the model can't arm it.

**"What stops hallucinated dispatches?"**
Tool-layer validation: ids must exist, resolved incidents refuse, non-ready
resources generate warnings, and the agent only ever writes a `pending`
proposal — the DB state machine (`pending → approved`) is enforced server-side,
not by the prompt.

**"Is the data real?"**
Seeded, then continuously evolved by the simulator (telemetry, movement,
lifecycle, weather). Every number on screen traces to a DB row — no mocks, and
failures render as error UI, not fake data.

**"Why SQLite / why polling?"**
Zero-infrastructure demo that's still a real, transactional system of record.
4 s polling matches the 4 s simulation tick and self-heals; SSE is used where
latency matters (chat tokens). Both are honest trade-offs for a control-room
refresh rate.

**"How do multiple calls about one fire merge?"**
Normalized-address matching across unresolved incidents (explicit incident id
wins first). The seed even ships two calls on one incident to show it.

**"What happens when the LLM or backend is down?"**
503 with a clear `detail` — the UI shows `UPLINK LOST` / `Backend unreachable`
banners and keeps polling. The world simulator, telemetry and dispatch
lifecycle keep running without any LLM.

**"Can the agent escalate privileges?"**
No write path bypasses `pending` except the operator-controlled night-mode
switch — enforced in `chat_tools.propose_dispatch`, not in the prompt.

**"Scaling to a real deployment?"**
The seams are explicit: swap SQLite for Postgres (single connection layer in
`db.py`), swap the simulator for real CAD/telematics feeds (telemetry schema
already time-series), keep the same API contract. Vapi is already a hosted
service.

**"What about external agencies?"**
Logged, not tracked — `POST /incidents/{id}/contact` records that EMS/police/
utility was notified (the agent can do this via `contact_external_service`);
Siren deliberately doesn't monitor external services.

**"Post-incident accountability?"**
Every state change writes an `events` row; `GET /incidents/{id}/report`
compiles incident meta, weather, responding units/crew/equipment, calls,
external contacts and the full timeline into a downloadable PDF.
