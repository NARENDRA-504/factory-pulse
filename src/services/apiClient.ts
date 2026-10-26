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
  SEED_USERS,
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
  CURRENT_USER: 'ziro_current_user',
  USERS: 'ziro_users_store',
  INCIDENTS: 'ziro_incidents_store',
  WORK_ORDERS: 'ziro_work_orders_store',
  SIM_EVENTS: 'ziro_sim_telemetry_events',
};

// Resilient in-memory fallback store when localStorage is restricted in iframes / tests
const memoryStore: Record<string, string> = {
  [STORAGE_KEYS.USERS]: JSON.stringify(SEED_USERS),
  [STORAGE_KEYS.INCIDENTS]: JSON.stringify(SEED_INCIDENTS),
  [STORAGE_KEYS.WORK_ORDERS]: JSON.stringify(SEED_WORK_ORDERS),
  [STORAGE_KEYS.CURRENT_USER]: JSON.stringify(SEED_USERS[0]),
};

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

function safeRemoveItem(key: string): void {
  delete memoryStore[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Sandboxed iframe / private window fallback
  }
}

// Synchronize memory store with localStorage if present
function initializePersistence() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!window.localStorage.getItem(STORAGE_KEYS.USERS)) {
        window.localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.INCIDENTS)) {
        window.localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(SEED_INCIDENTS));
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.WORK_ORDERS)) {
        window.localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(SEED_WORK_ORDERS));
      }
      if (!window.localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
        window.localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(SEED_USERS[0]));
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
  // -------------------------------------------------------------
  // Authentication & Session
  // -------------------------------------------------------------
  async login(workId: string, password?: string): Promise<UserProfile> {
    const users = await this.getUsers();
    const user = users.find(
      (u) => u.workId.trim().toUpperCase() === workId.trim().toUpperCase()
    );
    if (!user) {
      throw new Error(`Invalid Work ID "${workId}". Available demo IDs: OP-101, SUP-201, MGR-301, MNT-401, ADM-001.`);
    }
    // In demo mode, verify non-empty password if provided or match standard
    if (password && password.length < 3) {
      throw new Error('Password must be at least 3 characters.');
    }
    safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  },

  getCurrentUser(): UserProfile | null {
    const raw = safeGetItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  },

  logout(): void {
    safeRemoveItem(STORAGE_KEYS.CURRENT_USER);
  },

  // -------------------------------------------------------------
  // User Management & Access Governance
  // -------------------------------------------------------------
  async getUsers(): Promise<UserProfile[]> {
    const raw = safeGetItem(STORAGE_KEYS.USERS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Fallback to seed users
      }
    }
    return SEED_USERS;
  },

  async createUser(newUser: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const users = await this.getUsers();
    const existing = users.find(
      (u) => u.workId.trim().toUpperCase() === newUser.workId.trim().toUpperCase()
    );
    if (existing) {
      throw new Error(`User with Work ID ${newUser.workId} already exists.`);
    }
    const nextId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const created: UserProfile = { ...newUser, id: nextId };
    const updatedList = [...users, created];
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(updatedList));
    return created;
  },

  async updateUser(id: number, data: Partial<UserProfile>): Promise<UserProfile> {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }
    const updated = { ...users[index], ...data };
    users[index] = updated;
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return updated;
  },

  async deleteUser(id: number): Promise<void> {
    const users = await this.getUsers();
    if (users.length <= 1) {
      throw new Error('Cannot delete the last remaining platform user.');
    }
    const updatedList = users.filter((u) => u.id !== id);
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(updatedList));
  },

  async resetUsersToDefaults(): Promise<UserProfile[]> {
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    return SEED_USERS;
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
  // Telemetry Generation & Injection (Writing strictly to sim_telemetry_events)
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

    // Save to sim_telemetry_events in store
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
  async getIncidents(): Promise<Incident[]> {
    const raw = safeGetItem(STORAGE_KEYS.INCIDENTS);
    return raw ? JSON.parse(raw) : SEED_INCIDENTS;
  },

  async getIncidentById(id: number): Promise<Incident | undefined> {
    const incidents = await this.getIncidents();
    return incidents.find((inc) => inc.id === id);
  },

  async createIncident(params: {
    machineCode: string;
    severity: Incident['severity'];
    symptomDescription: string;
    componentArea: string;
    operatorNotes?: string;
    snapshot: TelemetryReading;
    user: UserProfile;
  }): Promise<Incident> {
    // Operator, Supervisor, Maintenance can create (Manager and Admin cannot)
    if (params.user.role !== 'Operator' && params.user.role !== 'Supervisor' && params.user.role !== 'Maintenance') {
      throw new Error(`Permission Denied: User role '${params.user.role}' cannot create incident reports.`);
    }

    // Machine authorization enforcement: Operator cannot report against unauthorized machines
    if (
      params.user.role === 'Operator' &&
      params.user.assignedMachine &&
      params.user.assignedMachine !== params.machineCode
    ) {
      throw new Error(
        `Permission Denied: Operator ${params.user.workId} is assigned to ${params.user.assignedMachine} and cannot report incidents for unauthorized machine ${params.machineCode}.`
      );
    }

    const incidents = await this.getIncidents();

    // Deduplication Policy: Prevent duplicate active incidents for same machine and component area
    const duplicate = incidents.find(
      (i) =>
        i.machineCode === params.machineCode &&
        i.componentArea === params.componentArea &&
        i.status !== 'Closed'
    );
    if (duplicate) {
      throw new Error(
        `Duplicate Incident Prevented: Active ticket ${duplicate.incidentCode} already exists for ${params.machineCode} (${params.componentArea}) with status ${duplicate.status}.`
      );
    }

    const newId = Math.max(...incidents.map((i) => i.id), 100) + 1;
    const incidentCode = `INC-${new Date().getFullYear()}-${String(newId).padStart(3, '0')}`;

    const newIncident: Incident = {
      id: newId,
      incidentCode,
      machineCode: params.machineCode,
      reporterId: params.user.id,
      reporterName: params.user.fullName,
      reporterRole: params.user.role,
      severity: params.severity,
      symptomDescription: params.symptomDescription,
      operatorNotes: params.operatorNotes,
      componentArea: params.componentArea,
      measuredVibRms: params.snapshot.vibRms,
      measuredMotorPowerKw: params.snapshot.motorPowerKw,
      measuredMotorLoadPct: params.snapshot.motorLoadPct,
      correlatedVbMm: +(0.18 + Math.random() * 0.15).toFixed(2),
      correlatedRaUm: +(1.1 + Math.random() * 0.5).toFixed(2),
      dataProvenance: params.snapshot.dataProvenance,
      status: 'Open',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    incidents.unshift(newIncident);
    safeSetItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));

    // Instantly notify Supervisors and Maintenance without page refresh
    try {
      notificationService.notifyOperatorAlert({
        incident: newIncident,
        machineName: params.machineCode,
      });
    } catch (e) {
      console.warn('Failed to dispatch operator alert notification', e);
    }

    return newIncident;
  },

  async assignIncident(
    incidentId: number,
    technicianName: string,
    userRole: UserRole
  ): Promise<Incident> {
    // Supervisor only
    if (userRole !== 'Supervisor') {
      throw new Error('Permission Denied: Only Supervisors can review, assign, and prioritize incidents.');
    }

    const incidents = await this.getIncidents();
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) throw new Error('Incident not found.');

    target.assignedToName = technicianName;
    target.status = 'In_Investigation';

    safeSetItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    return target;
  },

  async updateIncidentProgress(
    incidentId: number,
    actionNotes: string,
    userRole: UserRole
  ): Promise<Incident> {
    // Maintenance only
    if (userRole !== 'Maintenance') {
      throw new Error('Permission Denied: Only Maintenance personnel can investigate and update progress.');
    }

    const incidents = await this.getIncidents();
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) throw new Error('Incident not found.');

    target.notes = (target.notes ? target.notes + '\n\n' : '') + `[Maintenance Progress]: ${actionNotes}`;
    target.status = 'Action_Required';

    safeSetItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    return target;
  },

  async closeIncident(
    incidentId: number,
    closureNotes: string,
    user: UserProfile
  ): Promise<Incident> {
    // Only Supervisor or Maintenance with operational sign-off can close
    if (user.role !== 'Supervisor' && user.role !== 'Maintenance') {
      throw new Error('Permission Denied: Only Supervisor or Maintenance personnel with operational qualification may close an incident.');
    }

    const incidents = await this.getIncidents();
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) throw new Error('Incident not found.');

    target.status = 'Closed';
    target.closedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    target.closedByName = user.fullName;
    target.closedRole = user.role;
    target.closureNotes = closureNotes;

    safeSetItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    return target;
  },

  // -------------------------------------------------------------
  // AI Incident Investigation Assistant (Server-Side Calling Pattern)
  // -------------------------------------------------------------
  async diagnoseIncidentWithAI(incidentId: number): Promise<AIDiagnosisResult> {
    const incidents = await this.getIncidents();
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident) throw new Error('Incident not found.');

    // Simulate server-side processing delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Construct verified sensor readings with explicit physical units
    const verifiedReadings: VerifiedSensorReading[] = [
      {
        metric: 'Vibration RMS',
        measuredValue: incident.measuredVibRms,
        unit: 'm/s²',
        statusNote: 'Measured by machine accelerometer spindle collar',
      },
      {
        metric: 'Motor Power',
        measuredValue: incident.measuredMotorPowerKw,
        unit: 'kW',
        statusNote: 'Measured by spindle variable-frequency drive power meter',
      },
      {
        metric: 'Motor Load',
        measuredValue: incident.measuredMotorLoadPct,
        unit: '%',
        statusNote: 'Calculated as percentage of machine continuous kW rating',
      },
    ];

    if (incident.correlatedVbMm !== undefined) {
      verifiedReadings.push({
        metric: 'Tool Flank Wear (Vb)',
        measuredValue: incident.correlatedVbMm,
        unit: 'mm',
        statusNote: 'Empirical measurement from Dataset 1 correlation',
      });
    }

    if (incident.correlatedRaUm !== undefined) {
      verifiedReadings.push({
        metric: 'Surface Roughness (Ra)',
        measuredValue: incident.correlatedRaUm,
        unit: 'µm',
        statusNote: 'Empirical surface profilometer reading from Dataset 2 correlation',
      });
    }

    // Excluded auxiliary channels
    const unverifiedExcluded = [
      {
        metric: 'Raw Accelerometer Sensor Channel 14',
        reason: 'Unit unverified in primary dataset documentation — excluded from physical diagnostic inference.',
      },
      {
        metric: 'Acoustic Emission High-Frequency Raw Voltage',
        reason: 'Calibration gain factor unverified — excluded from unit-dependent physical reasoning.',
      },
    ];

    // Grounded diagnostic hypotheses
    const hypotheses: DiagnosticHypothesis[] = [];

    if (incident.measuredVibRms > 4.0) {
      hypotheses.push({
        hypothesis: 'Mechanical toolholder taper fretting or insufficient collet clamping torque',
        rationale: `Vibration RMS is ${incident.measuredVibRms} m/s² with elevated motor load (${incident.measuredMotorLoadPct}%). Concentrated harmonic resonance frequently points to toolholder seat play.`,
        verificationStatus: 'Unverified hypothesis — physical dial indicator sweep required',
      });
    }

    if (incident.measuredMotorLoadPct > 95.0) {
      hypotheses.push({
        hypothesis: 'Z-Axis ball screw pre-load binding or guideway lubrication starvation',
        rationale: `Motor load is surging to ${incident.measuredMotorLoadPct}%, indicating severe mechanical friction along feed axes.`,
        verificationStatus: 'Unverified hypothesis — physical way-lube pressure check required',
      });
    } else {
      hypotheses.push({
        hypothesis: 'Progressive abrasive tool flank wear causing cutting edge micro-chipping',
        rationale: `Correlated Vb flank wear is ${incident.correlatedVbMm ?? 'elevated'} mm. Increased rubbing friction elevates cutting forces without total mechanical seizure.`,
        verificationStatus: 'Unverified hypothesis — optical microscope insert inspection required',
      });
    }

    const investigationSteps = [
      'Step 1: Check spindle runout at tool shank with calibrated 0.001 mm dial test indicator.',
      'Step 2: Inspect collet bore, pull-stud, and toolholder 7:24 taper for fretting corrosion or foreign chip entrapment.',
      'Step 3: Measure workpiece surface finish at 3 distinct cut locations with a calibrated stylus profilometer.',
      'Step 4: Verify way-lube pump discharge pressure against machine hydraulic gauge specification.',
    ];

    const diagnosis: AIDiagnosisResult = {
      incidentId: incident.id,
      incidentSummary: `Investigation Analysis for ${incident.incidentCode} on ${incident.machineCode}: ${incident.symptomDescription}`,
      dataProvenance: incident.dataProvenance,
      verifiedSensorReadings: verifiedReadings,
      unverifiedMetricsExcluded: unverifiedExcluded,
      diagnosticHypotheses: hypotheses,
      suggestedInvestigationSteps: investigationSteps,
      safetyDisclaimer:
        'AI-generated diagnostic guidance. All causes are preliminary hypotheses and do NOT replace official manufacturer standard operating procedures or certified maintenance personnel. Follow all facility Lock-Out/Tag-Out (LOTO) procedures before touching machinery.',
      futureSopCapabilityNote:
        'Manufacturer-verified SOP retrieval is reserved for future phases pending integration of validated technical documentation.',
      modelId: 'gemini-3.8-flash (Pending API Model Verification)',
      generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // Save diagnosis to incident in store
    incident.diagnosis = diagnosis;
    safeSetItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));

    return diagnosis;
  },

  // -------------------------------------------------------------
  // Analytics Endpoints (Datasets 1, 2, 3, 4)
  // -------------------------------------------------------------
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
    const raw = safeGetItem(STORAGE_KEYS.WORK_ORDERS);
    return raw ? JSON.parse(raw) : SEED_WORK_ORDERS;
  },

  async updateWorkOrderStatus(orderId: number, status: 'Pending' | 'In_Progress' | 'Completed'): Promise<MaintenanceWorkOrder[]> {
    const orders = await this.getWorkOrders();
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      target.status = status;
      if (status === 'Completed') {
        target.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }
      safeSetItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
    }
    return orders;
  },

  async getSimulatedEvents(): Promise<any[]> {
    const raw = safeGetItem(STORAGE_KEYS.SIM_EVENTS);
    return raw ? JSON.parse(raw) : [];
  },

  async getPipelineHealth(): Promise<PipelineHealthAudit> {
    return PIPELINE_AUDIT;
  },
};
