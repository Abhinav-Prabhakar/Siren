# SIREN × Vapi — voice intake integration

`server/routers/vapi.py` implements `POST /api/vapi/webhook`, the Server URL
endpoint that Vapi POSTs [server messages](https://docs.vapi.ai/server-url/events)
to during a live call. `server/vapi/assistant.json` is the assistant spec that
powers the emergency-intake agent.

## What the webhook handles

| Vapi message type       | Behaviour |
|-------------------------|-----------|
| `assistant-request`     | Returns the transient assistant from `assistant.json` (with `VAPI_SERVER_URL` substituted into `serverUrl`/tool `server.url` if set). Must answer within 7.5 s — keep the tunnel close/fast. |
| `tool-calls`            | Runs `create_incident` / `update_incident` / `dispatch_units`; replies `{"results":[{"toolCallId","result"}]}`. |
| `function-call`         | Legacy single-tool variant; replies `{"result": ...}`. |
| `transcript`            | Appends **final** transcripts to `calls.transcript` (partials ignored). |
| `status-update`         | `in-progress` → `calls.live=1`, `started_at`, caller number, `VAPI` event. `ended` → `ended_at`, `duration_s`, `live=0`. |
| `end-of-call-report`    | Persists `artifact.transcript`, `analysis.summary`, duration, and appends `analysis.structuredData` / recording URL to `calls.extracted`. |
| `hang`                  | Logs a `VAPI` event (assistant stalled). |
| everything else         | `200 {}` ack (`conversation-update`, `speech-update`, `model-output`, `transfer-*`, …). |

Incident grouping: `create_incident` first matches an explicit `incident_id`,
then a normalized address (lowercase, punctuation stripped) among unresolved
incidents — repeat callers link onto the same incident via `calls.incident_id`.

`dispatch_units` always writes `dispatches` rows with `status='pending'` and
`proposed_by='agent'`, plus `dispatch_vehicles` / `dispatch_personnel` /
`dispatch_equipment` junction rows. A human approves via
`POST /api/dispatches/{id}/approve`. The agent never dispatches directly.

## Setup

### 1. Environment

Copy `server/.env.example` → `server/.env` (or export in your shell):

```bash
VAPI_API_KEY=...            # private key from https://dashboard.vapi.ai → API Keys
VAPI_SERVER_URL=https://<your-tunnel>/api/vapi/webhook
VAPI_WEBHOOK_SECRET=...     # optional shared secret (see "Webhook auth" below)
```

`VAPI_SERVER_URL` is only used when the webhook answers an
`assistant-request` — it is substituted into the returned assistant spec in
place of the `https://<your-tunnel>/...` placeholders.

### 2. Create the assistant

```bash
curl --request POST \
  --url https://api.vapi.ai/assistant \
  --header "Authorization: Bearer $VAPI_API_KEY" \
  --header "Content-Type: application/json" \
  --data @server/vapi/assistant.json
```

Or in the Dashboard: **Assistants → Create Assistant**, paste the
`model.messages[0]` system prompt, add the three function tools
(`create_incident`, `update_incident`, `dispatch_units`), set the Server URL,
and publish.

### 3. Point Vapi at localhost

Vapi needs a public URL. Either tunnel directly:

```bash
ngrok http 8000
# → set serverUrl to https://<id>.ngrok.app/api/vapi/webhook
```

…or use the Vapi CLI forwarder (still needs a tunnel for the public URL):

```bash
ngrok http 4242
vapi listen --forward-to localhost:8000/api/vapi/webhook
```

Update `serverUrl` on the assistant (and each tool's `server.url`) via
`PATCH https://api.vapi.ai/assistant/<id>`, or set `VAPI_SERVER_URL` and rely
on `assistant-request` substitution. Server URLs can also live on the phone
number or account — priority order is: tool → assistant → phone number →
account.

### 4. Attach a phone number

Dashboard → **Phone Numbers → Create Phone Number → Free Vapi Number**, then
under Inbound Settings choose the assistant. Leave the assistant unassigned to
exercise the `assistant-request` path (the webhook returns the transient
assistant from `assistant.json`).

### Webhook auth

If `VAPI_WEBHOOK_SECRET` is set, the endpoint requires the secret as either:

- `x-vapi-secret: <secret>` — set `serverUrlSecret` on the assistant
  (legacy/simplest for tunnels), or
- `Authorization: Bearer <secret>` — create a **Custom Credential** in the
  dashboard and reference it via `server.credentialId` / tool `server.credentialId`.

Unset the variable to disable verification (local dev default).

## Local smoke test

```bash
cd server && uvicorn app:app --port 8000

curl -X POST http://localhost:8000/api/vapi/webhook \
  -H 'Content-Type: application/json' \
  -d '{"message":{"type":"tool-calls","call":{"id":"demo-1","customer":{"number":"+15551234567"}},
       "toolCallList":[{"id":"tc-1","name":"create_incident",
         "arguments":{"classification":"structure_fire","priority":"P1","address":"12 Ember St"}}]}}'
# → {"results":[{"toolCallId":"tc-1","name":"create_incident","result":"{...incident_id...}"}]}
```
