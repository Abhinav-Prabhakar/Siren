# Siren

An AI agent at its core, Siren dispatches fire station vehicles, people and equipment autonomously — and co-ordinates them.

## Dashboard

The main page is a control-room dashboard showing the full fleet: vehicles available, tools and people. For every vehicle or person you can see the task they're performing, check their location, and know when they'll next be free.

## What's in a station

### Apparatus bay

The iconic area with the fire engines. You might see:

- Pumpers / engines
- Water tenders
- Ladder trucks
- Rescue vehicles
- Ambulances
- Hazmat vehicles
- Command vehicles
- Specialized rescue vehicles

The exact inventory depends enormously on the department.

### Equipment / storage

Potentially enormous amounts of equipment:

- Hose
- Nozzles
- SCBA
- PPE
- Breaching tools
- Ladders
- Hydraulic rescue tools
- Medical equipment
- Ropes
- Thermal imaging cameras
- Fans
- Pumps
- Generators
- Lighting
- Foam
- Hazmat equipment
- Radios
- Spare cylinders

### The people

- **Firefighter** — front-line responder
- **Driver/operator** — responsible for the apparatus and often its pump/water systems
- **Battalion/division chief** — supervises multiple companies/stations
- **Incident Commander** — once an incident becomes sufficiently complex, someone assumes overall command

## Call intake & dispatch

Inbound calls are handled by LLMs through [Vapi](https://vapi.ai). The agent takes in all the useful information — incident classification, location determination, information gathering — and then does the dispatching itself.

Multiple calls can map to a single event, so the model must distinguish the same and group all data in one place.

The bottom line: we respond to threats and deploy the required personnel and equipment to the disaster location, while prioritising disaster importance.

### Human in the loop

The dashboard shows everything that's going on for the person in the control room, and they can take over for manual control if needed. The control room operator must approve the dispatch — we never hand over full control to the LLM. Except for night duties.

The control room has both an LLM chat and a voice mode to talk to the agent in real time.

## Monitoring

- Equipment telemetry wherever possible: fuel, battery, water remaining, among other things.
- Climate at the destination location factors into decisions: wind, temperature, humidity, precipitation.

## External departments

Don't assume outside departments were contacted — get that from the person calling, and contact external EMS / police as per requirement. We stop there: no monitoring for these external services.

## Reporting

In the end, we build a neat PDF report for anyone to read that includes everything that happened — post-incident analytics.

## Tech

- [Next.js](https://nextjs.org) — dashboard & app (localhost:3000)
- Python [FastAPI](https://fastapi.tiangolo.com) + SQLite — backend API (localhost:8000)
- [Vapi](https://vapi.ai) — LLM call handling

## Getting started

```bash
# backend
cd server && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8000

# frontend (separate terminal)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.
