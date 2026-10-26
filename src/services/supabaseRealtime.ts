/**
 * Supabase Realtime Service for FactoryPulse
 * Provides local in-app notifications. Cloud delivery remains disabled until the
 * backend has durable MySQL workflows and server-enforced Supabase authorization.
 * 
 * Key Principles:
 * 1. MySQL is the ONLY source of truth for machine data, telemetry, incidents, and work orders.
 * 2. Supabase is used strictly as an event broker for lightweight Realtime broadcast messages.
 * 3. Role and plant checks in this browser are UI filters, not an authorization boundary.
 * 4. Minimal non-sensitive payload: Includes only identifiers and metadata needed to render
 *    the alert; full incident or machine records are retrieved from the MySQL/API backend.
 * 5. Resilient fallback: Seamlessly coordinates with browser BroadcastChannel so local tabs
 *    also sync instantaneously, with graceful offline handling.
 */

import { UserRole, IncidentSeverity } from '../types';

export interface SupabaseRealtimeNotificationPayload {
  id: string;
  incidentId?: number;
  incidentCode?: string;
  machineCode: string;
  machineName?: string;
  plant?: string;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  source: 'OPERATOR_ALERT' | 'ABNORMAL_TELEMETRY' | 'WORK_ORDER';
  targetRoles: UserRole[];
  timestamp: string;
  // Non-sensitive sensor snapshot metric
  primaryMetric?: {
    name: string;
    observed: string | number;
    unit: string;
    limit: string | number;
  };
}

export type RealtimeConnectionState = 'connected' | 'connecting' | 'disconnected' | 'local_fallback';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  connectionState: RealtimeConnectionState;
}

const STORAGE_KEYS = {
  SUPABASE_URL: 'factorypulse_supabase_url',
  SUPABASE_KEY: 'factorypulse_supabase_key',
};

class SupabaseRealtimeService {
  private subscribers: Array<(payload: SupabaseRealtimeNotificationPayload) => void> = [];
  private connectionStatusSubscribers: Array<(state: RealtimeConnectionState) => void> = [];
  private connectionState: RealtimeConnectionState = 'local_fallback';
  private currentRole: UserRole | null = null;
  private currentPlant: string | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Setup local BroadcastChannel as immediate fallback & multi-tab bridge
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('factorypulse_supabase_realtime_bridge');
        this.localBroadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'SUPABASE_REALTIME_NOTIFICATION' &&
              this.currentRole && this.isPayloadAuthorized(event.data.payload, this.currentRole, this.currentPlant || undefined)) {
            this.dispatchToSubscribers(event.data.payload);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization skipped:', err);
      }
    }

    // Fail closed until workflow writes and channel authorization are enforced server-side.
    this.initClient();
  }

  /**
   * Read credentials from import.meta.env or localStorage
   */
  public getCredentials(): { url: string; anonKey: string } {
    let url = '';
    let anonKey = '';

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        url = window.localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || '';
        anonKey = window.localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || '';
      }
    } catch {
      // Sandboxed iframe fallback
    }

    // Fallback to Vite env variables if not set in localStorage
    if (!url && typeof import.meta !== 'undefined' && import.meta.env) {
      url = import.meta.env.VITE_SUPABASE_URL || '';
    }
    if (!anonKey && typeof import.meta !== 'undefined' && import.meta.env) {
      anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    }

    return { url: url.trim(), anonKey: anonKey.trim() };
  }

  /**
   * Save custom Supabase credentials (for live user project testing)
   */
  public saveCredentials(url: string, anonKey: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (url && anonKey) {
          window.localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim());
          window.localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, anonKey.trim());
        } else {
          window.localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
          window.localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
        }
      }
    } catch {
      // Sandboxed fallback
    }

    return this.initClient();
  }

  /**
   * Initialize or re-initialize Supabase client
   */
  public initClient(): boolean {
    this.setConnectionState('local_fallback');
    return false;
  }

  /**
   * Keep role/plant context for local filtering. Remote subscriptions are disabled
   * until trusted server-side authorization is available.
   */
  public subscribeUserChannels(role: UserRole, plant?: string): void {
    this.currentRole = role;
    this.currentPlant = plant || null;

    this.setConnectionState('local_fallback');
  }

  /**
   * Client-side access guard: Verifies that received payload matches authorized role & plant
   */
  private isPayloadAuthorized(
    payload: SupabaseRealtimeNotificationPayload,
    role: UserRole,
    userPlant?: string
  ): boolean {
    if (!payload || !payload.targetRoles) return false;
    if (!payload.targetRoles.includes(role)) return false;

    // If notification is tied to a specific plant and user has a restricted plant, enforce boundary
    if (payload.plant && userPlant && userPlant !== 'ALL') {
      if (!payload.plant.toLowerCase().includes(userPlant.toLowerCase()) &&
          !userPlant.toLowerCase().includes(payload.plant.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Publish locally only. Cloud publish is disabled so a frontend mutation or
   * in-memory backend record cannot be mistaken for a committed MySQL transaction.
   */
  public async publishNotification(
    payload: SupabaseRealtimeNotificationPayload
  ): Promise<boolean> {
    // 1. Always dispatch through local BroadcastChannel so current browser/tabs update instantly
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: 'SUPABASE_REALTIME_NOTIFICATION',
          payload,
        });
      } catch (err) {
        console.warn('Local broadcast error:', err);
      }
    }

    // 2. Also dispatch to local listeners if matching role
    if (this.currentRole && this.isPayloadAuthorized(payload, this.currentRole, this.currentPlant || undefined)) {
      this.dispatchToSubscribers(payload);
    }

    return false;
  }

  /**
   * Subscribe frontend UI to live incoming notifications
   */
  public subscribe(
    callback: (payload: SupabaseRealtimeNotificationPayload) => void
  ): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribe to connection status changes (connected, connecting, local_fallback)
   */
  public subscribeConnectionStatus(
    callback: (state: RealtimeConnectionState) => void
  ): () => void {
    this.connectionStatusSubscribers.push(callback);
    callback(this.connectionState);
    return () => {
      this.connectionStatusSubscribers = this.connectionStatusSubscribers.filter(
        (cb) => cb !== callback
      );
    };
  }

  private setConnectionState(state: RealtimeConnectionState) {
    this.connectionState = state;
    this.connectionStatusSubscribers.forEach((cb) => {
      try {
        cb(state);
      } catch {}
    });
  }

  private dispatchToSubscribers(payload: SupabaseRealtimeNotificationPayload) {
    this.subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Realtime notification subscriber error:', err);
      }
    });
  }

  public getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  public getStatusSummary(): {
    isConfigured: boolean;
    provider: string;
    connectionState: RealtimeConnectionState;
    configuredUrl: string;
    activeChannelsCount: number;
    details: string;
  } {
    const isConfigured = false;

    return {
      isConfigured,
      provider: 'Local notifications only (cloud delivery disabled)',
      connectionState: this.connectionState,
      configuredUrl: 'Cloud delivery disabled',
      activeChannelsCount: 0,
      details: 'Cloud delivery stays disabled until notifications follow committed MySQL writes and Supabase enforces role and plant authorization server-side.',
    };
  }
}

export const supabaseRealtime = new SupabaseRealtimeService();
