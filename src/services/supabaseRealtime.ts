/**
 * Supabase Realtime Service for FactoryPulse
 * Provides cross-device, in-app notifications to Supervisors and Maintenance staff.
 * 
 * Key Principles:
 * 1. MySQL is the ONLY source of truth for machine data, telemetry, incidents, and work orders.
 * 2. Supabase is used strictly as an event broker for lightweight Realtime broadcast messages.
 * 3. Role-Based Access Control (RBAC): Enforces channel subscriptions so only authorized
 *    Supervisor, Maintenance, and Admin users receive incoming alerts.
 * 4. Minimal non-sensitive payload: Includes only identifiers and metadata needed to render
 *    the alert; full incident or machine records are retrieved from the MySQL/API backend.
 * 5. Resilient fallback: Seamlessly coordinates with browser BroadcastChannel so local tabs
 *    also sync instantaneously, with graceful offline handling.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
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
  private client: SupabaseClient | null = null;
  private activeChannels: Map<string, RealtimeChannel> = new Map();
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
          if (event.data && event.data.type === 'SUPABASE_REALTIME_NOTIFICATION') {
            this.dispatchToSubscribers(event.data.payload);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization skipped:', err);
      }
    }

    // Try initializing Supabase client from env or local override
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
    const { url, anonKey } = this.getCredentials();

    if (url && anonKey && url.startsWith('http')) {
      try {
        this.client = createClient(url, anonKey, {
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });

        this.setConnectionState('connecting');

        // Reconnect active channels if user role was already configured
        if (this.currentRole) {
          this.subscribeUserChannels(this.currentRole, this.currentPlant || undefined);
        } else {
          // Connect to base heartbeat channel to test connectivity
          const testChan = this.client.channel('factorypulse:system_status');
          testChan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.setConnectionState('connected');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              this.setConnectionState('local_fallback');
            }
          });
        }
        return true;
      } catch (err) {
        console.warn('Supabase client initialization error, falling back to local bus:', err);
        this.client = null;
        this.setConnectionState('local_fallback');
        return false;
      }
    } else {
      this.client = null;
      this.setConnectionState('local_fallback');
      return false;
    }
  }

  /**
   * Configure subscription channels based on Role-Based Access Control
   * Only Supervisors, Maintenance, and Admins subscribe to alert channels.
   * Operators only publish alerts and do not receive other machines' triage notifications.
   */
  public subscribeUserChannels(role: UserRole, plant?: string): void {
    this.currentRole = role;
    this.currentPlant = plant || null;

    // Clean up existing Supabase channel subscriptions
    this.activeChannels.forEach((chan) => {
      try {
        chan.unsubscribe();
      } catch {}
    });
    this.activeChannels.clear();

    // Access control: Operators do NOT listen to shop-floor triage alert channels
    if (role === 'Operator') {
      return;
    }

    // Role-enforced channel naming
    const plantSlug = plant ? plant.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'all';
    const channelNames = [
      `factorypulse:alerts:${role.toLowerCase()}:all`,
      `factorypulse:alerts:${role.toLowerCase()}:${plantSlug}`,
      'factorypulse:alerts:broadcast',
    ];

    if (this.client) {
      channelNames.forEach((chanName) => {
        try {
          const chan = this.client!.channel(chanName, {
            config: {
              broadcast: { self: false },
            },
          });

          chan
            .on('broadcast', { event: 'incident_notification' }, ({ payload }) => {
              if (this.isPayloadAuthorized(payload, role, plant)) {
                this.dispatchToSubscribers(payload);
              }
            })
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                this.setConnectionState('connected');
              } else if (status === 'CHANNEL_ERROR') {
                this.setConnectionState('local_fallback');
              }
            });

          this.activeChannels.set(chanName, chan);
        } catch (err) {
          console.warn(`Failed to subscribe to channel ${chanName}:`, err);
        }
      });
    }
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
   * Publish a minimal, non-sensitive notification event through Supabase Realtime
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

    // 3. Publish to Supabase Realtime Channels if client is connected
    if (this.client) {
      try {
        const plantSlug = payload.plant
          ? payload.plant.toLowerCase().replace(/[^a-z0-9]/g, '-')
          : 'all';

        // Target designated roles (Supervisor, Maintenance, Admin)
        const targetChannels = payload.targetRoles.map(
          (r) => `factorypulse:alerts:${r.toLowerCase()}:${plantSlug}`
        );
        targetChannels.push('factorypulse:alerts:broadcast');

        const sendPromises = targetChannels.map(async (chanName) => {
          let chan = this.activeChannels.get(chanName);
          if (!chan) {
            chan = this.client!.channel(chanName, {
              config: { broadcast: { self: true } },
            });
            await chan.subscribe();
            this.activeChannels.set(chanName, chan);
          }

          return chan.send({
            type: 'broadcast',
            event: 'incident_notification',
            payload,
          });
        });

        await Promise.all(sendPromises);
        return true;
      } catch (err) {
        console.warn('Supabase Realtime publish failed, fell back to local bus:', err);
        return false;
      }
    }

    return true;
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
    const { url } = this.getCredentials();
    const isConfigured = Boolean(url && url.startsWith('http'));

    return {
      isConfigured,
      provider: isConfigured ? 'Supabase Realtime (Cloud WebSocket)' : 'In-App Live Event Bus (BroadcastChannel)',
      connectionState: this.connectionState,
      configuredUrl: url ? url.replace(/(https?:\/\/[^/]{4})[^/]+/, '$1****') : 'Not Configured',
      activeChannelsCount: this.activeChannels.size,
      details: isConfigured
        ? 'Real-time WebSocket connection active for cross-device broadcast. MySQL remains primary source of truth.'
        : 'Delivering zero-refresh in-app notifications across views and tabs via resilient BroadcastChannel bus.',
    };
  }
}

export const supabaseRealtime = new SupabaseRealtimeService();
