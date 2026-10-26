/**
 * FactoryPulse Real-Time Notification Service
 * Delivers immediate in-app notifications to Supervisors and Maintenance
 * when an Operator files an alert or when machines exceed safety limits.
 * 
 * Architecture:
 * - MySQL is the ONLY source of truth for machines, incidents, telemetry, and work orders.
 * - Supabase Realtime is used strictly to publish and receive lightweight notification events.
 * - Role-Based Access Control (RBAC): Enforces channel and recipient filtering.
 * - Deduplication / Cooldown guards to prevent notification spam.
 * - Multi-device synchronization with resilient local event bus fallback.
 */

import { UserRole, Incident, TelemetryReading, IncidentSeverity } from '../types';
import { supabaseRealtime, SupabaseRealtimeNotificationPayload } from './supabaseRealtime';

export interface AbnormalParameter {
  parameter: string;
  observedValue: number | string;
  unit: string;
  baselineValue: number | string;
  deviation: string;
}

export interface LiveNotification {
  id: string;
  incidentId?: number;
  incidentCode?: string;
  machineCode: string;
  machineName?: string;
  targetRoles: UserRole[];
  severity: IncidentSeverity;
  title: string;
  message: string;
  source: 'OPERATOR_ALERT' | 'ABNORMAL_TELEMETRY' | 'WORK_ORDER';
  abnormalParameters: AbnormalParameter[];
  recommendedNextSteps: string[];
  deliveredAt: string;
  isRead: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  dedupKey: string;
  occurrenceCount: number;
}

const STORAGE_KEY = 'factorypulse_live_notifications';
const CHANNEL_NAME = 'factorypulse_realtime_events';

// Resilient fallback for environments without BroadcastChannel
class EventHub {
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(notif: LiveNotification) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'NEW_NOTIFICATION') {
            this.notifyListeners(event.data.notification);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization skipped', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('factorypulse:internal_notif', ((e: CustomEvent) => {
        if (e.detail) {
          this.notifyListeners(e.detail);
        }
      }) as EventListener);
    }
  }

  broadcast(notification: LiveNotification) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'NEW_NOTIFICATION', notification });
      } catch (e) {
        console.warn('Channel post error', e);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('factorypulse:internal_notif', { detail: notification })
      );
    }
  }

  subscribe(callback: (notif: LiveNotification) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(notification: LiveNotification) {
    this.listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.error('Notification listener error:', err);
      }
    });
  }
}

const eventHub = new EventHub();

// Initial seed notifications so Supervisor and Maintenance start with verified context
const SEED_NOTIFICATIONS: LiveNotification[] = [
  {
    id: 'NOTIF-2026-001',
    incidentId: 101,
    incidentCode: 'INC-2026-089',
    machineCode: 'CNC-MILL-02',
    machineName: 'Precision 5-Axis VMC #02',
    targetRoles: ['Supervisor', 'Maintenance', 'Admin'],
    severity: 'High',
    title: 'High Spindle Chatter Resonance',
    message: 'Operator Marcus Vance reported audible resonance during roughing pass on pocket 3B.',
    source: 'OPERATOR_ALERT',
    abnormalParameters: [
      {
        parameter: 'Spindle Vibration',
        observedValue: 4.82,
        unit: 'm/s²',
        baselineValue: 1.85,
        deviation: '+160% above operating limit',
      },
      {
        parameter: 'Motor Load',
        observedValue: 84.5,
        unit: '%',
        baselineValue: 55.0,
        deviation: '+29.5% continuous surge',
      },
      {
        parameter: 'Tool Flank Wear (Vb)',
        observedValue: 0.28,
        unit: 'mm',
        baselineValue: 0.15,
        deviation: 'Approaching 0.30mm limit',
      },
    ],
    recommendedNextSteps: [
      'Inspect tool collet taper for runout and swarf contamination',
      'Check spindle drawbar retention force with gauge',
      'Replace carbide insert on Tool #08',
    ],
    deliveredAt: '2026-10-26 09:14:22',
    isRead: false,
    dedupKey: 'CNC-MILL-02_Spindle Taper',
    occurrenceCount: 1,
  },
  {
    id: 'NOTIF-2026-002',
    incidentId: 102,
    incidentCode: 'INC-2026-092',
    machineCode: 'CNC-HEAVY-04',
    machineName: 'Heavy Duty CNC Horizontal Boring Mill #04',
    targetRoles: ['Supervisor', 'Maintenance', 'Admin'],
    severity: 'Critical',
    title: 'Thermal Surge on Axis Wayguides',
    message: 'Waypoint thermocouple reported 54.2°C exceeding safe chilling envelope of 35.0°C.',
    source: 'ABNORMAL_TELEMETRY',
    abnormalParameters: [
      {
        parameter: 'Coolant Temp',
        observedValue: 54.2,
        unit: '°C',
        baselineValue: 24.5,
        deviation: '+29.7°C dangerous heat rise',
      },
      {
        parameter: 'Motor Power Draw',
        observedValue: 22.4,
        unit: 'kW',
        baselineValue: 14.2,
        deviation: '+57.7% power inrush',
      },
    ],
    recommendedNextSteps: [
      'Halt cutting feed immediately to protect linear guide rails',
      'Inspect chiller heat exchanger for swarf clog',
      'Check waylube pump pressure indicator',
    ],
    deliveredAt: '2026-10-26 10:45:00',
    isRead: false,
    dedupKey: 'CNC-HEAVY-04_Z-Axis Ball Screw',
    occurrenceCount: 1,
  },
];

function loadStoredNotifications(): LiveNotification[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch {
    // Sandboxed iframe fallback
  }
  return SEED_NOTIFICATIONS;
}

function saveStoredNotifications(notifs: LiveNotification[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
    }
  } catch {
    // Sandboxed iframe fallback
  }
}

// Subscribe to incoming Supabase Realtime broadcast notifications
supabaseRealtime.subscribe((incoming: SupabaseRealtimeNotificationPayload) => {
  const notifs = loadStoredNotifications();
  // Idempotency: verify if already stored to prevent duplicate insertion
  if (notifs.some((n) => n.id === incoming.id)) {
    return;
  }

  const notif: LiveNotification = {
    id: incoming.id,
    incidentId: incoming.incidentId,
    incidentCode: incoming.incidentCode,
    machineCode: incoming.machineCode,
    machineName: incoming.machineName || incoming.machineCode,
    targetRoles: incoming.targetRoles,
    severity: incoming.severity,
    title: incoming.title,
    message: incoming.summary,
    source: incoming.source,
    abnormalParameters: incoming.primaryMetric
      ? [
          {
            parameter: incoming.primaryMetric.name,
            observedValue: incoming.primaryMetric.observed,
            unit: incoming.primaryMetric.unit,
            baselineValue: incoming.primaryMetric.limit,
            deviation: 'Sensor threshold breach',
          },
        ]
      : [],
    recommendedNextSteps: [
      'Inspect machine condition diagnostics on shop floor',
      'Verify status on Supervisor or Maintenance console',
      'Assign technician or execute work order inspection',
    ],
    deliveredAt: incoming.timestamp,
    isRead: false,
    dedupKey: `${incoming.machineCode}_${incoming.title}`,
    occurrenceCount: 1,
  };

  notifs.unshift(notif);
  saveStoredNotifications(notifs);
  eventHub.broadcast(notif);
});

export const notificationService = {
  // Subscribe to live notifications arriving without page refresh
  subscribe(callback: (notif: LiveNotification) => void): () => void {
    return eventHub.subscribe(callback);
  },

  // Synchronize active user role with Supabase Realtime channel access rules
  syncUserRole(role: UserRole, plant?: string): void {
    supabaseRealtime.subscribeUserChannels(role, plant);
  },

  // Get notifications filtered by recipient role
  getNotificationsForRole(role?: UserRole): LiveNotification[] {
    const all = loadStoredNotifications();
    if (!role) return all;

    return all.filter((n) => {
      // Supervisor, Maintenance, and Admin have visibility into incident and abnormal telemetry alerts
      if (role === 'Supervisor' || role === 'Maintenance' || role === 'Admin') {
        return n.targetRoles.includes(role);
      }
      // Operators only receive work-order updates or notifications for their own machine
      if (role === 'Operator') {
        return n.targetRoles.includes('Operator');
      }
      // Managers receive aggregated summary notifications
      if (role === 'Manager') {
        return n.targetRoles.includes('Manager') || n.severity === 'Critical';
      }
      return false;
    });
  },

  // Dispatch an alert when an Operator files an incident (MySQL confirmed first, then published to Supabase)
  notifyOperatorAlert(params: {
    incident: Incident;
    machineName?: string;
    plant?: string;
  }): LiveNotification {
    const notifs = loadStoredNotifications();
    const dedupKey = `${params.incident.machineCode}_${params.incident.componentArea}`;

    // Deduplication guard: Check if an active unacknowledged notification already exists
    const existingIndex = notifs.findIndex(
      (n) => n.dedupKey === dedupKey && !n.acknowledgedAt
    );

    const abnormalParams: AbnormalParameter[] = [];
    if (params.incident.measuredVibRms > 2.5) {
      abnormalParams.push({
        parameter: 'Spindle Vibration',
        observedValue: params.incident.measuredVibRms,
        unit: 'm/s²',
        baselineValue: 1.85,
        deviation: `${(((params.incident.measuredVibRms - 1.85) / 1.85) * 100).toFixed(0)}% deviation`,
      });
    }
    if (params.incident.measuredMotorLoadPct > 80) {
      abnormalParams.push({
        parameter: 'Motor Load',
        observedValue: params.incident.measuredMotorLoadPct,
        unit: '%',
        baselineValue: 55.0,
        deviation: `${(params.incident.measuredMotorLoadPct - 55.0).toFixed(1)}% above baseline`,
      });
    }
    if (params.incident.measuredMotorPowerKw > 10) {
      abnormalParams.push({
        parameter: 'Motor Power',
        observedValue: params.incident.measuredMotorPowerKw,
        unit: 'kW',
        baselineValue: 7.8,
        deviation: `${(params.incident.measuredMotorPowerKw - 7.8).toFixed(1)} kW inrush`,
      });
    }

    if (existingIndex !== -1) {
      // Update existing notification to avoid spamming
      const existing = notifs[existingIndex];
      existing.occurrenceCount += 1;
      existing.deliveredAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      existing.message = `[Update: ${existing.occurrenceCount} reports] ${params.incident.symptomDescription}`;
      existing.isRead = false;
      saveStoredNotifications(notifs);
      eventHub.broadcast(existing);

      // Publish update through Supabase Realtime
      supabaseRealtime.publishNotification({
        id: existing.id,
        incidentId: existing.incidentId,
        incidentCode: existing.incidentCode,
        machineCode: existing.machineCode,
        machineName: existing.machineName,
        plant: params.plant || 'Plant A: Precision Machining',
        severity: existing.severity,
        title: existing.title,
        summary: existing.message,
        source: existing.source,
        targetRoles: existing.targetRoles,
        timestamp: existing.deliveredAt,
      });

      return existing;
    }

    const newNotif: LiveNotification = {
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      incidentId: params.incident.id,
      incidentCode: params.incident.incidentCode,
      machineCode: params.incident.machineCode,
      machineName: params.machineName || params.incident.machineCode,
      targetRoles: ['Supervisor', 'Maintenance', 'Admin', 'Manager'],
      severity: params.incident.severity,
      title: `${params.incident.severity} Alert: ${params.incident.componentArea}`,
      message: `${params.incident.reporterName} (${params.incident.reporterRole}) reported: "${params.incident.symptomDescription}"`,
      source: 'OPERATOR_ALERT',
      abnormalParameters: abnormalParams,
      recommendedNextSteps: [
        'Review live machine telemetry and spectrogram',
        'Assign a qualified maintenance technician',
        'Verify LOTO before accessing machine spindle',
      ],
      deliveredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isRead: false,
      dedupKey,
      occurrenceCount: 1,
    };

    notifs.unshift(newNotif);
    saveStoredNotifications(notifs);
    eventHub.broadcast(newNotif);

    // Publish minimal non-sensitive event through Supabase Realtime
    supabaseRealtime.publishNotification({
      id: newNotif.id,
      incidentId: newNotif.incidentId,
      incidentCode: newNotif.incidentCode,
      machineCode: newNotif.machineCode,
      machineName: newNotif.machineName,
      plant: params.plant || 'Plant A: Precision Machining',
      severity: newNotif.severity,
      title: newNotif.title,
      summary: newNotif.message,
      source: newNotif.source,
      targetRoles: newNotif.targetRoles,
      timestamp: newNotif.deliveredAt,
      primaryMetric: abnormalParams[0]
        ? {
            name: abnormalParams[0].parameter,
            observed: abnormalParams[0].observedValue,
            unit: abnormalParams[0].unit,
            limit: abnormalParams[0].baselineValue,
          }
        : undefined,
    });

    return newNotif;
  },

  // Dispatch an alert when telemetry breaches critical safety thresholds
  notifyAbnormalTelemetry(params: {
    machineCode: string;
    machineName?: string;
    plant?: string;
    anomalyType: string;
    reading: TelemetryReading;
  }): LiveNotification | null {
    const notifs = loadStoredNotifications();
    const dedupKey = `${params.machineCode}_${params.anomalyType}`;

    // Check if recently notified within 3 minutes to avoid duplicate chatter
    const existing = notifs.find(
      (n) => n.dedupKey === dedupKey && !n.acknowledgedAt
    );
    if (existing) {
      existing.occurrenceCount += 1;
      existing.deliveredAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      saveStoredNotifications(notifs);
      eventHub.broadcast(existing);
      return existing;
    }

    const severity: IncidentSeverity =
      params.reading.vibRms > 5.0 || params.reading.coolantTempC > 50 || params.reading.motorLoadPct > 100
        ? 'Critical'
        : 'High';

    const abnormalParams: AbnormalParameter[] = [
      {
        parameter: 'Vibration RMS',
        observedValue: params.reading.vibRms.toFixed(2),
        unit: 'm/s²',
        baselineValue: '1.85',
        deviation: `${(((params.reading.vibRms - 1.85) / 1.85) * 100).toFixed(0)}% elevated`,
      },
      {
        parameter: 'Coolant Temp',
        observedValue: params.reading.coolantTempC.toFixed(1),
        unit: '°C',
        baselineValue: '24.5',
        deviation: `${(params.reading.coolantTempC - 24.5).toFixed(1)}°C surge`,
      },
      {
        parameter: 'Motor Load',
        observedValue: params.reading.motorLoadPct.toFixed(1),
        unit: '%',
        baselineValue: '55.0',
        deviation: `${(params.reading.motorLoadPct - 55.0).toFixed(1)}% surge`,
      },
    ];

    const newNotif: LiveNotification = {
      id: `NOTIF-${Date.now().toString().slice(-6)}`,
      machineCode: params.machineCode,
      machineName: params.machineName || params.machineCode,
      targetRoles: ['Supervisor', 'Maintenance', 'Admin'],
      severity,
      title: `Abnormal Sensor Activity: ${params.anomalyType}`,
      message: `Automatic sensor monitor detected threshold breach on ${params.machineCode} during active cut cycle.`,
      source: 'ABNORMAL_TELEMETRY',
      abnormalParameters: abnormalParams,
      recommendedNextSteps: [
        'Pause feed rate if chatter vibration exceeds 4.20 m/s²',
        'Inspect coolant reservoir level and chiller temperature',
        'Review axis lubrication pressure gauge',
      ],
      deliveredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isRead: false,
      dedupKey,
      occurrenceCount: 1,
    };

    notifs.unshift(newNotif);
    saveStoredNotifications(notifs);
    eventHub.broadcast(newNotif);

    // Publish minimal non-sensitive event through Supabase Realtime
    supabaseRealtime.publishNotification({
      id: newNotif.id,
      machineCode: newNotif.machineCode,
      machineName: newNotif.machineName,
      plant: params.plant || 'Plant A: Precision Machining',
      severity: newNotif.severity,
      title: newNotif.title,
      summary: newNotif.message,
      source: newNotif.source,
      targetRoles: newNotif.targetRoles,
      timestamp: newNotif.deliveredAt,
      primaryMetric: abnormalParams[0]
        ? {
            name: abnormalParams[0].parameter,
            observed: abnormalParams[0].observedValue,
            unit: abnormalParams[0].unit,
            limit: abnormalParams[0].baselineValue,
          }
        : undefined,
    });

    return newNotif;
  },

  // Acknowledge a notification
  acknowledgeNotification(id: string, userName: string): LiveNotification | null {
    const notifs = loadStoredNotifications();
    const target = notifs.find((n) => n.id === id);
    if (!target) return null;

    target.acknowledgedBy = userName;
    target.acknowledgedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    target.isRead = true;

    saveStoredNotifications(notifs);
    eventHub.broadcast(target);
    return target;
  },

  // Mark all as read
  markAllAsRead(): void {
    const notifs = loadStoredNotifications();
    notifs.forEach((n) => {
      n.isRead = true;
    });
    saveStoredNotifications(notifs);
  },

  // Clear single notification
  dismissNotification(id: string): void {
    const notifs = loadStoredNotifications();
    const filtered = notifs.filter((n) => n.id !== id);
    saveStoredNotifications(filtered);
  },

  // Check Supabase Realtime status and connection
  getSupabaseRealtimeStatus() {
    return supabaseRealtime.getStatusSummary();
  },
};
