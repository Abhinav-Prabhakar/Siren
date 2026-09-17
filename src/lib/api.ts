/**
 * SIREN API contract — mirrors server/ SQLite schema exactly (snake_case).
 * See PLAN.md. Do not rename fields; the FastAPI backend returns these shapes.
 */
import type { BadgeTone } from "@/components/ui/badge";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ---------- entities ---------- */

export interface Station {
  id: string;
  name: string;
  code: string;
  address: string;
  lat: number;
  lng: number;
}

export type VehicleType =
  | "pumper"
  | "tender"
  | "ladder"
  | "rescue"
  | "ambulance"
  | "hazmat"
  | "command"
  | "special";

export type VehicleStatus =
  | "available"
  | "dispatched"
  | "en_route"
  | "on_scene"
  | "returning"
  | "refuel"
  | "out_of_service";

export interface Vehicle {
  id: string;
  station_id: string;
  name: string;
  callsign: string;
  type: VehicleType;
  status: VehicleStatus;
  fuel_pct: number;
  water_pct: number;
  foam_pct: number;
  battery_v: number;
  mileage_km: number;
  pump_pressure_bar: number;
  lat: number;
  lng: number;
  speed_kmh: number;
  incident_id: string | null;
  free_at: string | null;
  updated_at: string;
}

export interface VehicleDetail extends Vehicle {
  crew: Personnel[];
  equipment: Equipment[];
}

export type PersonnelRole =
  | "firefighter"
  | "driver"
  | "chief"
  | "incident_commander"
  | "paramedic";

export type PersonnelStatus =
  | "on_duty"
  | "dispatched"
  | "en_route"
  | "on_scene"
  | "resting"
  | "off_duty";

export interface Personnel {
  id: string;
  station_id: string;
  name: string;
  role: PersonnelRole;
  rank: string;
  status: PersonnelStatus;
  vehicle_id: string | null;
  incident_id: string | null;
  heart_rate: number;
  scba_pct: number;
  lat: number;
  lng: number;
  shift_start: string;
  shift_end: string;
  updated_at: string;
}

export interface PersonnelDetail extends Personnel {
  vehicle_name: string | null;
  incident_address: string | null;
}

export type EquipmentCategory =
  | "hose"
  | "nozzle"
  | "scba"
  | "ppe"
  | "breaching"
  | "ladder"
  | "hydraulic"
  | "medical"
  | "rope"
  | "thermal"
  | "fan"
  | "pump"
  | "generator"
  | "lighting"
  | "foam"
  | "hazmat"
  | "radio"
  | "cylinder";

export type EquipmentStatus = "ready" | "in_use" | "maintenance" | "missing";

export interface Equipment {
  id: string;
  station_id: string;
  vehicle_id: string | null;
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  battery_pct: number | null;
  condition_pct: number;
  serial: string;
  last_check: string;
  updated_at: string;
}

export interface EquipmentDetail extends Equipment {
  vehicle_name: string | null;
  station_name: string | null;
}

export type IncidentPriority = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "active" | "contained" | "monitoring" | "resolved";

export interface Incident {
  id: string;
  classification: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  address: string;
  lat: number;
  lng: number;
  reported_at: string;
  resolved_at: string | null;
  wind: string;
  wind_dir: string;
  temp_c: number;
  humidity_pct: number;
  precip: string;
  notes: string;
  external_contacts?: ExternalContact[];
  call_count?: number;
  unit_count?: number;
}

export interface IncidentDetail extends Incident {
  calls: Call[];
  dispatches: Dispatch[];
  vehicles: Vehicle[];
  personnel: Personnel[];
}

export interface ExternalContact {
  service: string;
  ts: string;
}

export interface Settings {
  night_mode: boolean;
}

export interface Call {
  id: string;
  incident_id: string | null;
  vapi_call_id: string | null;
  /** Nullable — Vapi upserts a bare row before caller metadata arrives. */
  caller_name: string | null;
  caller_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
  transcript: string | null;
  summary: string | null;
  /** JSON array of extracted intel strings */
  extracted: string[];
  live: number;
}

export type DispatchStatus = "pending" | "approved" | "rejected" | "completed";

export interface Dispatch {
  id: string;
  incident_id: string;
  status: DispatchStatus;
  proposed_by: "agent" | "operator";
  notes: string;
  created_at: string;
  decided_at: string | null;
  vehicle_ids: string[];
  personnel_ids: string[];
  equipment_ids: string[];
  incident_address?: string;
  incident_classification?: string;
  incident_priority?: IncidentPriority;
}

export interface Event {
  id: number;
  ts: string;
  tag: string;
  message: string;
  tone: "flame" | "bone" | "ash";
}

export interface TelemetryPoint {
  metric: string;
  value: number;
  ts: string;
}

/** One tool the agent fired while answering — name + args + one-line record. */
export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  ts: string;
  tool_calls?: ChatToolCall[];
}

/** One SSE frame from POST /api/chat/stream. */
export interface ChatStreamEvent {
  type: "delta" | "tool" | "done" | "error";
  /** delta: next chunk of reply text */
  text?: string;
  /** tool: record of a tool the agent just fired */
  name?: string;
  args?: Record<string, unknown>;
  summary?: string;
  /** done/error: server-side ts of the persisted assistant row */
  ts?: string;
  /** done: every tool fired during the turn */
  tool_calls?: ChatToolCall[];
  /** error: what went wrong mid-stream */
  detail?: string;
}

export interface Overview {
  station: Station;
  counts: {
    vehicles: Record<string, number>;
    personnel: Record<string, number>;
    equipment: Record<string, number>;
    active_incidents: number;
    pending_dispatches: number;
    live_calls: number;
  };
  latest_events: Event[];
}

/* ---------- helpers ---------- */

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (body?.detail) detail = ` — ${body.detail}`;
    } catch {
      /* non-json error body */
    }
    throw new Error(`${method} ${path} → ${res.status}${detail}`);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const api = {
  health: () => req<{ status: string }>("GET", "/health"),
  overview: () => req<Overview>("GET", "/overview"),
  vehicles: () => req<Vehicle[]>("GET", "/vehicles"),
  vehicle: (id: string) => req<VehicleDetail>("GET", `/vehicles/${id}`),
  equipment: (category?: string, status?: string) =>
    req<Equipment[]>("GET", `/equipment${qs({ category, status })}`),
  equipmentItem: (id: string) =>
    req<EquipmentDetail>("GET", `/equipment/${id}`),
  personnel: (status?: string, role?: string) =>
    req<Personnel[]>("GET", `/personnel${qs({ status, role })}`),
  person: (id: string) => req<PersonnelDetail>("GET", `/personnel/${id}`),
  incidents: (status?: string) =>
    req<Incident[]>("GET", `/incidents${qs({ status })}`),
  incident: (id: string) => req<IncidentDetail>("GET", `/incidents/${id}`),
  calls: (live?: boolean) =>
    req<Call[]>("GET", `/calls${qs({ live: live === undefined ? undefined : String(live) })}`),
  dispatches: (status?: string) =>
    req<Dispatch[]>("GET", `/dispatches${qs({ status })}`),
  createDispatch: (body: {
    incident_id: string;
    vehicle_ids: string[];
    personnel_ids: string[];
    equipment_ids: string[];
    notes?: string;
  }) => req<Dispatch>("POST", "/dispatches", body),
  approveDispatch: (id: string) =>
    req<Dispatch>("POST", `/dispatches/${id}/approve`),
  rejectDispatch: (id: string) =>
    req<Dispatch>("POST", `/dispatches/${id}/reject`),
  settings: () => req<Settings>("GET", "/settings"),
  setNightMode: (enabled: boolean) =>
    req<Settings>("POST", "/settings/night-mode", { enabled }),
  contactService: (incidentId: string, service: string) =>
    req<Incident>("POST", `/incidents/${incidentId}/contact`, { service }),
  /** Direct URL — use as href for PDF download. */
  reportUrl: (incidentId: string) =>
    `${API_URL}/api/incidents/${incidentId}/report`,
  events: (limit = 50) => req<Event[]>("GET", `/events?limit=${limit}`),
  telemetry: (entityType: string, entityId: string, metric?: string, limit = 60) =>
    req<TelemetryPoint[]>(
      "GET",
      `/telemetry/${entityType}/${entityId}${qs({ metric, limit: String(limit) })}`,
    ),
  chat: (message: string) =>
    req<{ reply: string; ts: string; tool_calls?: ChatToolCall[] }>(
      "POST",
      "/chat",
      { message },
    ),
  /** Streamed variant of chat — invokes onEvent per SSE frame. */
  chatStream: async (
    message: string,
    onEvent: (ev: ChatStreamEvent) => void,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok || !res.body) {
      let detail = "";
      try {
        const body = await res.json();
        if (body?.detail) detail = ` — ${body.detail}`;
      } catch {
        /* non-json error body */
      }
      throw new Error(`POST /chat/stream → ${res.status}${detail}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf("\n\n");
      while (idx >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload) onEvent(JSON.parse(payload) as ChatStreamEvent);
        }
        idx = buf.indexOf("\n\n");
      }
    }
  },
  chatHistory: () => req<ChatMessage[]>("GET", "/chat/history"),
  clearChat: () => req<{ cleared: number }>("DELETE", "/chat/history"),
};

/* ---------- presentation helpers ---------- */

/** Any backend status string → design-system BadgeTone. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "on_scene":
    case "active":
    case "in_use":
    case "P1":
      return "hot";
    case "dispatched":
    case "en_route":
    case "contained":
    case "maintenance":
    case "resting":
    case "P2":
      return "warm";
    case "available":
    case "ready":
    case "on_duty":
    case "monitoring":
    case "P3":
      return "cold";
    case "out_of_service":
    case "missing":
    case "off_duty":
    case "resolved":
    case "P4":
      return "dead";
    default:
      return "plain";
  }
}

/** ISO ts → "MM:SS" clock or relative "Xm ago". */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDuration(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** ISO ts → elapsed mission clock "T+MM:SS" / "T+H:MM" / "T+Nd". */
export function fmtElapsed(iso: string | null | undefined): string {
  if (!iso) return "T+--:--";
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `T+${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  const h = Math.floor(s / 3600);
  if (h < 24) {
    return `T+${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  }
  return `T+${Math.floor(h / 24)}d`;
}
