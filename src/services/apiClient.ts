/**
 * ZIRO Digital Internship — Typed API Client & Data Adapter
 * Communicates with Python FastAPI backend (VITE_API_BASE_URL)
 * or provides persistent local operational store for interactive review.
 */

import {
  UserProfile,
  Machine,
  Incident,
  MaintenanceWorkOrder,
  TelemetryReading,
  AIDiagnosisResult,
  VerifiedSensorReading,
  DiagnosticHypothesis,
  Dataset1ToolWearSummary,
  Dataset2RoughnessSummary,
  Dataset3TelemetrySummary,
  Dataset4CycleToFailureSummary,
  PipelineHealthAudit,
  UserRole,
} from '../types';

import {
  SEED_MACHINES,
  SEED_INCIDENTS,
  SEED_WORK_ORDERS,
  DATASET_1_SUMMARY,
  DATASET_2_SUMMARY,
  DATASET_3_SUMMARY,
  DATASET_4_SUMMARY,
  PIPELINE_AUDIT,
} from '../data/seedData';
import { notificationService } from './notificationService';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'factorypulse_auth_token',
  INCIDENTS: 'ziro_incidents_store',
  WORK_ORDERS: 'ziro_work_orders_store',
  SIM_EVENTS: 'ziro_sim_telemetry_events',
};

export interface PersistedSimulatorReading {
  reading_id: string;
  machine_id: string;
  machine_code: string;
  display_name: string;
  timestamp: string;
  machine_type: string;
  department: string;
  production_line: string;
  sensor_name: string;
  sensor_unit: string;
  sensor_value: number | string | null;
  expected_min: number;
  expected_max: number;
  machine_status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE' | 'STOPPED';
  data_quality: 'GOOD' | 'NOISY';
  fault_mode?: string | null;
  data_provenance: 'SIMULATED';
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

// Resilient in-memory fallback store when localStorage is restricted in iframes / tests
const memoryStore: Record<string, string> = {
  [STORAGE_KEYS.INCIDENTS]: JSON.stringify(SEED_INCIDENTS),
  [STORAGE_KEYS.WORK_ORDERS]: JSON.stringify(SEED_WORK_ORDERS),
};

function getSessionToken(): string | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null; }
  catch { return null; }
}

function setSessionToken(token: string | null): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) window.sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      else window.sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  } catch { /* session storage may be blocked by an embedded browser */ }
}

function authHeaders(): HeadersInit {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toUserProfile(user: any): UserProfile {
  return {
    id: user.id,
    workId: user.work_id,
    fullName: user.full_name,
    role: user.role,
    assignedMachine: user.assigned_machine || undefined,
    email: user.email,
    department: user.department || undefined,
    shift: user.shift || undefined,
    status: user.is_active === false ? 'Offline' : 'Active',
  };
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Sandboxed iframe / private window fallback
  }
  return memoryStore[key] || null;
}

function safeSetItem(key: string, val: string): void {
  memoryStore[key] = val;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, val);
    }
  } catch {
    // Sandboxed iframe / private window fallback
  }
}

// Synchronize memory store with localStorage if present
function initializePersistence() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!window.localStorage.getItem(STORAGE_KEYS.INCIDENTS)) {
        window.localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(SEED_INCIDENTS));
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.WORK_ORDERS)) {
        window.localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(SEED_WORK_ORDERS));
      }
    }
  } catch {
    // Ignore iframe security error
  }
}

initializePersistence();

// -------------------------------------------------------------
// AI Simulator Live Data Receiver & Cache
// -------------------------------------------------------------
const simulatorTelemetryCache: Record<string, Partial<TelemetryReading> & { receivedAt: number }> = {};

export function updateSimulatorTelemetry(machineCode: string, data: Partial<TelemetryReading>) {
  if (!machineCode) return;
  simulatorTelemetryCache[machineCode] = {
    ...(simulatorTelemetryCache[machineCode] || {}),
    ...data,
    receivedAt: Date.now(),
  };
}

export function getSimulatorTelemetry(machineCode: string): (Partial<TelemetryReading> & { receivedAt: number }) | null {
  const item = simulatorTelemetryCache[machineCode];
  // Valid within 45 seconds of last telemetry broadcast
  if (item && Date.now() - item.receivedAt < 45000) {
    return item;
  }
  return null;
}

// Global browser listeners for simulator telemetry feeds
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    try {
      const d = event.data;
      if (d && typeof d === 'object') {
        const code = d.machineCode || d.machine_code || d.code;
        if (code && typeof code === 'string') {
          updateSimulatorTelemetry(code, {
            spindleRpm: d.spindleRpm ?? d.spindle_rpm ?? d.rpm,
            coolantTempC: d.coolantTempC ?? d.coolant_temp_c ?? d.temperature,
            motorLoadPct: d.motorLoadPct ?? d.motor_load_pct ?? d.motorLoad,
            motorPowerKw: d.motorPowerKw ?? d.motor_power_kw ?? d.motorPower,
            jobsProduced: d.jobsProduced ?? d.jobs_produced ?? d.partsProduced ?? d.partCount,
            coolantLevelPct: d.coolantLevelPct ?? d.coolant_level_pct ?? d.coolantLevel,
            workingTimeSeconds: d.workingTimeSeconds ?? d.working_time_seconds ?? d.runtimeSeconds,
            machineStatus: d.machineStatus ?? d.status,
            activeAlert: d.activeAlert ?? d.alert,
          });
        }
      }
    } catch {
      // ignore cross-origin/sandbox exceptions
    }
  });

  window.addEventListener('factorypulse:simulator', ((event: CustomEvent) => {
    if (event.detail && (event.detail.machineCode || event.detail.code)) {
      const code = event.detail.machineCode || event.detail.code;
      updateSimulatorTelemetry(code, event.detail);
    }
  }) as EventListener);
}

export const apiClient = {
  async saveMachineRegistration(machineId: string, payload: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/machine-inventory/${encodeURIComponent(machineId)}`, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Machine registration could not be saved');
    return body;
  },
  async getMachineInventory(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/machine-inventory`, { headers: authHeaders(), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Machine inventory is unavailable');
    return body;
  },
  async getMachineDowntime(machineId: string, minutes = 60): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/telemetry/downtime/${encodeURIComponent(machineId)}?minutes=${minutes}`, { headers: authHeaders(), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Recorded downtime is unavailable');
    return body;
  },
  async queryFactoryIntelligence(question: string, machineId?: string, useAi = false, priorQuestions: string[] = []): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/intelligence/query`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ question, machine_id: machineId, use_ai: useAi, prior_questions: priorQuestions }), signal: AbortSignal.timeout(useAi ? 45000 : 20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Factory evidence is unavailable');
    return body;
  },
  async getSystemHealth(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/system-health`, { headers: authHeaders(), signal: AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'System health is unavailable');
    return body;
  },
  async getPersistedSimulatorTelemetry(
    machineId: string,
    workId: string,
    limit = 100,
  ): Promise<PersistedSimulatorReading[]> {
    const query = new URLSearchParams({ limit: String(limit), data_source: 'AI_SIMULATOR' });
    const response = await fetch(`${API_BASE_URL}/api/v1/telemetry/latest/${encodeURIComponent(machineId)}?${query}`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      let detail = `Telemetry API returned ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body.detail === 'string') detail = body.detail;
      } catch { /* keep status-based message */ }
      throw new Error(detail);
    }
    return response.json() as Promise<PersistedSimulatorReading[]>;
  },

  async getLatestSimulatorFleetTelemetry(): Promise<PersistedSimulatorReading[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/telemetry/fleet/latest`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      let detail = `Telemetry API returned ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body.detail === 'string') detail = body.detail;
      } catch { /* keep status-based message */ }
      throw new Error(detail);
    }
    return response.json() as Promise<PersistedSimulatorReading[]>;
  },

  // -------------------------------------------------------------
  // Authentication & Session
  // -------------------------------------------------------------
  async login(workId: string, password: string): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_id: workId.trim().toUpperCase(), password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Sign-in failed (${response.status})`);
    if (!body.access_token || !body.user) throw new Error('Authentication service returned an invalid session.');
    setSessionToken(body.access_token);
    return toUserProfile(body.user);
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    if (!getSessionToken()) return null;
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { headers: authHeaders() });
    if (!response.ok) { setSessionToken(null); return null; }
    return toUserProfile(await response.json());
  },

  async logout(): Promise<void> {
    try {
      if (getSessionToken()) {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST', headers: authHeaders() });
        if (!response.ok) throw new Error(`Sign-out audit could not be confirmed (${response.status}).`);
      }
    }
    finally { setSessionToken(null); }
  },

  async getActivityLog(limit = 250): Promise<{ factory_time_zone: string; events: any[]; demo_mode?: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/activity-log?limit=${limit}`, { headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Activity log request failed (${response.status})`);
    return body;
  },

  // -------------------------------------------------------------
  // User Management & Access Governance
  // -------------------------------------------------------------
  async getUsers(): Promise<UserProfile[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users`, { headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Personnel request failed (${response.status})`);
    return body.map(toUserProfile);
  },

  async createUser(newUser: Omit<UserProfile, 'id'> & { password: string }): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_id: newUser.workId, full_name: newUser.fullName, password: newUser.password, role: newUser.role, assigned_machine: newUser.assignedMachine || null, department: newUser.department || null, shift: newUser.shift || null, email: newUser.email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Personnel create failed (${response.status})`);
    return toUserProfile(body);
  },

  async updateUser(id: number, data: Partial<UserProfile> & { password?: string; isActive?: boolean }): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${id}`, {
      method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_id: data.workId, full_name: data.fullName, role: data.role, assigned_machine: data.assignedMachine ?? null, department: data.department ?? null, shift: data.shift ?? null, email: data.email, ...(data.password ? { password: data.password } : {}), ...(data.isActive === undefined ? {} : { is_active: data.isActive }) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Personnel update failed (${response.status})`);
    return toUserProfile(body);
  },

  async deleteUser(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Personnel deactivation failed (${response.status})`);
  },

  // -------------------------------------------------------------
  // Machines & Floor Status
  // -------------------------------------------------------------
  async getMachines(): Promise<Machine[]> {
    return SEED_MACHINES;
  },

  async getMachineByCode(code: string): Promise<Machine | undefined> {
    if (code === 'CNC-MILL-01') return SEED_MACHINES[0];
    if (code === 'CNC-MILL-02') return SEED_MACHINES[1];
    if (code === 'CNC-LATHE-03') return SEED_MACHINES[2];
    if (code === 'CNC-HEAVY-04') return SEED_MACHINES[3];
    return SEED_MACHINES.find(
      (m) =>
        m.code === code ||
        m.machineCode === code ||
        m.machineId === code ||
        m.telemetryKey === code ||
        m.name === code ||
        m.displayName === code
    );
  },

  // -------------------------------------------------------------
  // Local demo telemetry generation; this client-side action is not a backend database write.
  // -------------------------------------------------------------
  getLiveTelemetrySnapshot(machineCode: string, anomalyType?: string): TelemetryReading {
    const now = new Date().toISOString();
    const matched =
      SEED_MACHINES.find(
        (m) =>
          m.code === machineCode ||
          m.machineCode === machineCode ||
          m.telemetryKey === machineCode ||
          m.machineId === machineCode
      ) || SEED_MACHINES[0];

    const baseRpm = matched?.spindleRpm ?? (machineCode.includes('LATHE') || machineCode.includes('TURN') ? 1800 : 4500);
    const baseKw = matched?.powerKw ?? (machineCode.includes('LATHE') || machineCode.includes('TURN') ? 7.5 : 12.0);

    // Check if live AI simulator telemetry was received
    const cachedSim = getSimulatorTelemetry(machineCode);

    if (anomalyType === 'HIGH_CHATTER') {
      return {
        timestamp: now,
        spindleRpm: cachedSim?.spindleRpm ?? (baseRpm - 180),
        feedRateMmpm: cachedSim?.feedRateMmpm ?? 480,
        vibX: cachedSim?.vibX ?? 4.85,
        vibY: cachedSim?.vibY ?? 5.12,
        vibZ: cachedSim?.vibZ ?? 3.90,
        vibRms: cachedSim?.vibRms ?? 5.45, // High vibration
        motorPowerKw: +(baseKw * 1.35).toFixed(1), // Explicit kW
        motorLoadPct: 91.5,                      // Explicit %
        coolantTempC: cachedSim?.coolantTempC ?? 38.5,
        dataProvenance: 'SIMULATED',
        injectedAnomalyType: 'High Spindle Chatter Resonance',
        jobsProduced: cachedSim?.jobsProduced,
        coolantLevelPct: cachedSim?.coolantLevelPct ?? 92,
        workingTimeSeconds: cachedSim?.workingTimeSeconds,
        machineStatus: 'Warning',
        activeAlert: 'High Spindle Chatter Resonance',
      };
    }

    if (anomalyType === 'THERMAL_OVERLOAD') {
      return {
        timestamp: now,
        spindleRpm: cachedSim?.spindleRpm ?? (baseRpm - 400),
        feedRateMmpm: cachedSim?.feedRateMmpm ?? 320,
        vibX: cachedSim?.vibX ?? 3.20,
        vibY: cachedSim?.vibY ?? 3.80,
        vibZ: cachedSim?.vibZ ?? 6.85,
        vibRms: cachedSim?.vibRms ?? 6.10,
        motorPowerKw: cachedSim?.motorPowerKw ?? +(baseKw * 1.85).toFixed(1),
        motorLoadPct: cachedSim?.motorLoadPct ?? 104.2, // Overloaded
        coolantTempC: cachedSim?.coolantTempC ?? 56.0,
        dataProvenance: 'SIMULATED',
        injectedAnomalyType: 'Z-Axis Servo Thermal Surge',
        jobsProduced: cachedSim?.jobsProduced,
        coolantLevelPct: cachedSim?.coolantLevelPct ?? 88,
        workingTimeSeconds: cachedSim?.workingTimeSeconds,
        machineStatus: 'Critical',
        activeAlert: 'Z-Axis Servo Thermal Surge',
      };
    }

    if (anomalyType === 'FEED_SPIKE') {
      return {
        timestamp: now,
        spindleRpm: cachedSim?.spindleRpm ?? baseRpm,
        feedRateMmpm: cachedSim?.feedRateMmpm ?? 850, // Spike
        vibX: cachedSim?.vibX ?? 3.95,
        vibY: cachedSim?.vibY ?? 4.10,
        vibZ: cachedSim?.vibZ ?? 2.80,
        vibRms: cachedSim?.vibRms ?? 4.25,
        motorPowerKw: cachedSim?.motorPowerKw ?? +(baseKw * 1.4).toFixed(1),
        motorLoadPct: cachedSim?.motorLoadPct ?? 88.0,
        coolantTempC: cachedSim?.coolantTempC ?? 34.0,
        dataProvenance: 'SIMULATED',
        injectedAnomalyType: 'Feed Rate Inrush Surge',
        jobsProduced: cachedSim?.jobsProduced,
        coolantLevelPct: cachedSim?.coolantLevelPct ?? 93,
        workingTimeSeconds: cachedSim?.workingTimeSeconds,
        machineStatus: 'Warning',
        activeAlert: 'Feed Rate Inrush Surge',
      };
    }

    // Nominal empirical baseline / real incoming AI simulator telemetry
    return {
      timestamp: now,
      spindleRpm: cachedSim?.spindleRpm ?? (matched?.spindleRpm || baseRpm),
      feedRateMmpm: cachedSim?.feedRateMmpm ?? (350 + Math.floor(Math.random() * 10 - 5)),
      vibX: cachedSim?.vibX ?? +(1.2 + Math.random() * 0.4).toFixed(2),
      vibY: cachedSim?.vibY ?? +(1.4 + Math.random() * 0.3).toFixed(2),
      vibZ: cachedSim?.vibZ ?? +(0.9 + Math.random() * 0.3).toFixed(2),
      vibRms: cachedSim?.vibRms ?? (matched?.vibrationMmS || +(1.85 + Math.random() * 0.3).toFixed(2)),
      motorPowerKw: cachedSim?.motorPowerKw ?? (matched?.powerKw || +(baseKw * 0.65 + Math.random() * 0.5).toFixed(1)),
      motorLoadPct: cachedSim?.motorLoadPct ?? (matched?.motorLoadPercent || +(55.0 + Math.random() * 5.0).toFixed(1)),
      coolantTempC: cachedSim?.coolantTempC ?? (matched?.coolantTemperatureC || +(24.2 + Math.random() * 1.2).toFixed(1)),
      dataProvenance: cachedSim ? 'SIMULATED' : 'EMPIRICAL DATASET',
      jobsProduced: cachedSim?.jobsProduced ?? matched?.jobsProducedThisShift,
      coolantLevelPct: cachedSim?.coolantLevelPct ?? (matched?.coolantLevelPercent || 94),
      workingTimeSeconds: cachedSim?.workingTimeSeconds ?? (matched?.workingTimeMinutes ? matched.workingTimeMinutes * 60 : undefined),
      machineStatus: cachedSim?.machineStatus ?? (matched?.status || 'Nominal'),
      activeAlert: cachedSim?.activeAlert ?? (matched?.activeAlertCount && matched.activeAlertCount > 0 ? `${matched.displayName}: Alert Logged` : null),
    };
  },

  async injectSimulatorTelemetry(
    machineCode: string,
    anomalyType: string,
    userRole: UserRole
  ): Promise<TelemetryReading> {
    if (userRole !== 'Supervisor' && userRole !== 'Maintenance') {
      throw new Error('Permission Denied: Only Supervisor or Maintenance may trigger simulated telemetry injection.');
    }

    const reading = this.getLiveTelemetrySnapshot(machineCode, anomalyType);

    // Keep demo events in browser storage only; persistent ingestion uses the FastAPI route.
    const existing = JSON.parse(safeGetItem(STORAGE_KEYS.SIM_EVENTS) || '[]');
    existing.unshift({
      machineCode,
      ...reading,
      injectedAt: new Date().toISOString(),
    });
    safeSetItem(STORAGE_KEYS.SIM_EVENTS, JSON.stringify(existing.slice(0, 100)));

    // Immediately broadcast live notification to Supervisor and Maintenance
    try {
      notificationService.notifyAbnormalTelemetry({
        machineCode,
        anomalyType,
        reading,
      });
    } catch (e) {
      console.warn('Failed to dispatch abnormal telemetry notification', e);
    }

    return reading;
  },

  // -------------------------------------------------------------
  // Incidents Workflow & Consistent Permissions
  // -------------------------------------------------------------
  async incidentRequest(path: string, method = 'GET', payload?: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/${path}`, { method, headers: {...authHeaders(),'Content-Type':'application/json'}, body: payload ? JSON.stringify(payload) : undefined, signal:AbortSignal.timeout(20000) });
    const body=await response.json(); if(!response.ok) throw new Error(typeof body.detail==='string'?body.detail:'Incident request failed');return body;
  },
  toIncident(row:any): Incident {
    return {sensorSnapshot:typeof row.sensor_snapshot==='string'?JSON.parse(row.sensor_snapshot):row.sensor_snapshot,id:row.id,incidentCode:row.incident_code,machineCode:row.machine_code,reporterId:row.reporter_id,reporterName:row.reporter_name,reporterRole:row.reporter_role,severity:row.severity,symptomDescription:row.symptom_description,componentArea:row.component_area,operatorNotes:row.operator_notes,measuredVibRms:row.measured_vib_rms,measuredMotorPowerKw:row.measured_motor_power_kw,measuredMotorLoadPct:row.measured_motor_load_pct,dataProvenance:row.data_provenance,assignedToId:row.assigned_to_id,assignedToName:row.assigned_to_name,status:row.status,createdAt:row.created_at,closedAt:row.closed_at,closedByName:row.closed_by_name,closedRole:row.closed_role,closureNotes:row.closure_notes,notes:row.notes};
  },
  async getIncidents():Promise<Incident[]> {return (await this.incidentRequest('incidents')).map((row:any)=>this.toIncident(row));},
  async getIncidentById(id:number):Promise<Incident|undefined>{return this.toIncident(await this.incidentRequest(`incidents/${id}`));},
  async getMaintenanceTechnicians():Promise<any[]>{return this.incidentRequest('maintenance/technicians');},
  async createIncident(params:{machineCode:string;severity:Incident['severity'];symptomDescription:string;componentArea:string;operatorNotes?:string;snapshot:TelemetryReading;user:UserProfile}):Promise<Incident>{
    return this.toIncident(await this.incidentRequest('incidents','POST',{machine_code:params.machineCode,severity:params.severity,symptom_description:params.symptomDescription,component_area:params.componentArea,operator_notes:params.operatorNotes||''}));
  },
  async assignIncident(id:number,technicianName:string,_role:UserRole):Promise<Incident>{return this.toIncident(await this.incidentRequest(`incidents/${id}/assign`,'PATCH',{technician_name:technicianName}));},
  async updateIncidentProgress(id:number,notes:string,_role:UserRole):Promise<Incident>{return this.toIncident(await this.incidentRequest(`incidents/${id}/progress`,'PATCH',{progress_notes:notes}));},
  async closeIncident(id:number,notes:string,_user:UserProfile):Promise<Incident>{return this.toIncident(await this.incidentRequest(`incidents/${id}/close`,'PATCH',{closure_notes:notes}));},

  // -------------------------------------------------------------
  // AI Incident Investigation Assistant (Server-Side Calling Pattern)
  // -------------------------------------------------------------
  async diagnoseIncidentWithAI(_incidentId:number):Promise<AIDiagnosisResult>{
    throw new Error('Incident AI diagnosis is unavailable. Use Factory Intelligence on the live dashboard for SQL evidence and optional selected-machine AI analysis.');
  },

  async getToolWearAnalytics(): Promise<Dataset1ToolWearSummary> {
    return DATASET_1_SUMMARY;
  },

  async getRoughnessAnalytics(): Promise<Dataset2RoughnessSummary> {
    return DATASET_2_SUMMARY;
  },

  async getTelemetryAnalytics(): Promise<Dataset3TelemetrySummary> {
    return DATASET_3_SUMMARY;
  },

  async getCycleToFailureAnalytics(): Promise<Dataset4CycleToFailureSummary> {
    return DATASET_4_SUMMARY;
  },

  async getWorkOrders(): Promise<MaintenanceWorkOrder[]> {
    const rows=await this.incidentRequest('work-orders');
    return rows.map((row:any)=>({id:row.id,orderCode:row.order_code,incidentCode:row.incident_code,machineCode:row.machine_code,technicianName:row.technician_name,priority:row.priority,actionTaken:row.action_taken,status:row.status,createdAt:row.created_at,completedAt:row.completed_at}));
  },
  async updateWorkOrderStatus(_orderId:number,_status:'Pending'|'In_Progress'|'Completed'):Promise<MaintenanceWorkOrder[]> {
    await this.incidentRequest(`work-orders/${_orderId}`,'PATCH',{status:_status});
    return this.getWorkOrders();
  },

  async getSimulatedEvents(): Promise<any[]> {
    const raw = safeGetItem(STORAGE_KEYS.SIM_EVENTS);
    return raw ? JSON.parse(raw) : [];
  },

  async getPipelineHealth(): Promise<PipelineHealthAudit> {
    return PIPELINE_AUDIT;
  },
};
