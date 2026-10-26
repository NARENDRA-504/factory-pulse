import React, { useState } from 'react';
import { UserProfile } from '../types';
import { LiveNotification, notificationService } from '../services/notificationService';
import { supabaseRealtime } from '../services/supabaseRealtime';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  Radio,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Cpu,
  Flame,
  Gauge,
  Activity,
  Layers,
  Sparkles,
  Settings,
  Database,
  Key,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  notifications: LiveNotification[];
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigateToMachine?: (machineCode: string) => void;
  onNavigateToIncidents?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  notifications,
  onAcknowledge,
  onDismiss,
  onNavigateToMachine,
  onNavigateToIncidents,
}) => {
  if (!isOpen) return null;

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const creds = supabaseRealtime.getCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(creds.anonKey);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  const realtimeStatus = notificationService.getSupabaseRealtimeStatus();
  const unreadCount = notifications.filter((n) => !n.isRead && !n.acknowledgedAt).length;

  const plantSlug = currentUser.assignedPlant
    ? currentUser.assignedPlant.toLowerCase().replace(/[^a-z0-9]/g, '-')
    : 'all';

  const authorizedChannels = [
    `factorypulse:alerts:${currentUser.role.toLowerCase()}:all`,
    `factorypulse:alerts:${currentUser.role.toLowerCase()}:${plantSlug}`,
    'factorypulse:alerts:broadcast',
  ];

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    const success = supabaseRealtime.saveCredentials(supabaseUrl, supabaseAnonKey);
    if (success) {
      notificationService.syncUserRole(currentUser.role, currentUser.assignedPlant);
      setConfigFeedback('Supabase credentials saved and real-time channels connected.');
    } else {
      setConfigFeedback('Cleared custom credentials. Operating on high-speed in-app BroadcastChannel bus.');
    }
    setTimeout(() => setConfigFeedback(null), 4000);
  };

  const handleResetToDefault = () => {
    supabaseRealtime.saveCredentials('', '');
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    notificationService.syncUserRole(currentUser.role, currentUser.assignedPlant);
    setConfigFeedback('Reverted to resilient local broadcast engine.');
    setTimeout(() => setConfigFeedback(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Live Notifications &amp; Alerts Hub
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Delivered in real-time to {currentUser.role} without refreshing. Role-based notification stream.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close Notification Hub"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Realtime Delivery Engine Status Banner */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                realtimeStatus.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-teal-500'
              }`}
            />
            <span className="font-semibold text-slate-800">Engine:</span>
            <span className="font-medium text-slate-600">{realtimeStatus.provider}</span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-500 text-[11px]">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
              <Database className="w-3 h-3 text-teal-600" />
              MySQL: Source of Truth
            </span>
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold px-2 py-0.5 rounded hover:bg-slate-200/70 transition-colors"
            >
              <Sliders className="w-3 h-3 text-slate-600" />
              <span>Channels &amp; Cloud Setup</span>
              {isConfigOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expandable Supabase Realtime Channels & Config Drawer */}
        {isConfigOpen && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Radio className="w-3.5 h-3.5 text-teal-600" />
                  Supabase Realtime Channel Architecture (RBAC Enforced)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  PostgreSQL/Supabase is used <strong>strictly as a broadcast event broker</strong>. All machine data, incidents, and work orders reside exclusively in MySQL. Privileged credentials never leave the server.
                </p>
              </div>
              <span className="shrink-0 px-2 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono text-[10px] font-semibold">
                Role: {currentUser.role}
              </span>
            </div>

            {/* Authorized Channels List */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Subscribed Channels for Current User:
              </span>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {authorizedChannels.map((chan, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-slate-700 border border-slate-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    {chan}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Supabase Credentials Form */}
            <form onSubmit={handleSaveCredentials} className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Optional: Connect Live Supabase Cloud Project
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">VITE_SUPABASE_URL</label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">VITE_SUPABASE_ANON_KEY (Public Key Only)</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {configFeedback && (
                <p className="text-[11px] font-medium text-teal-700 bg-teal-50 p-1.5 rounded border border-teal-200">
                  {configFeedback}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  When empty, FactoryPulse defaults to zero-refresh BroadcastChannel multi-tab bus.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    Save &amp; Connect
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Notification Stream Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">All clear on the factory floor</p>
              <p className="text-xs text-slate-500 mt-1">
                No active anomaly triggers or unacknowledged operator incident alerts.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isAcknowledged = Boolean(notif.acknowledgedAt);
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAcknowledged
                      ? 'bg-slate-50/60 border-slate-200 opacity-80'
                      : notif.severity === 'Critical'
                      ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                      : notif.severity === 'High'
                      ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                      : 'bg-white border-slate-200/90 shadow-xs'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          notif.severity === 'Critical'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : notif.severity === 'High'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}
                      >
                        {notif.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {notif.machineCode}
                      </span>
                      {notif.incidentCode && (
                        <span className="text-xs text-slate-500 font-mono">
                          · {notif.incidentCode}
                        </span>
                      )}
                      {notif.occurrenceCount > 1 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-700 font-semibold font-mono">
                          ×{notif.occurrenceCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{notif.deliveredAt}</span>
                    </div>
                  </div>

                  {/* Title & Message */}
                  <h4 className="font-bold text-sm text-slate-900">{notif.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                  {/* Abnormal Parameters Table */}
                  {notif.abnormalParameters && notif.abnormalParameters.length > 0 && (
                    <div className="mt-3 p-3 bg-white/90 rounded-lg border border-slate-200 text-xs space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Verified Sensor Anomaly Snapshot:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {notif.abnormalParameters.map((param, i) => (
                          <div key={i} className="p-2 bg-slate-50 rounded-md border border-slate-100">
                            <span className="text-[11px] text-slate-500 block truncate">{param.parameter}</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="font-bold text-slate-900 text-sm tabular-nums">
                                {param.observedValue}
                              </span>
                              <span className="text-[10px] text-slate-500">{param.unit}</span>
                            </div>
                            <span className="text-[10px] text-rose-600 font-medium block truncate mt-0.5">
                              {param.deviation}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Next Steps */}
                  {notif.recommendedNextSteps && notif.recommendedNextSteps.length > 0 && (
                    <div className="mt-2.5 text-xs text-slate-600">
                      <span className="text-[11px] font-semibold text-slate-700 block">Recommended Action:</span>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-slate-500">
                        {notif.recommendedNextSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      {isAcknowledged ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Acknowledged by {notif.acknowledgedBy} at {notif.acknowledgedAt?.slice(11, 16)}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-medium">Pending operational response</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isAcknowledged && (
                        <button
                          onClick={() => onAcknowledge(notif.id)}
                          className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-xs transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}

                      {onNavigateToMachine && (
                        <button
                          onClick={() => {
                            onNavigateToMachine(notif.machineCode);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <span>Inspect Machine</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {onNavigateToIncidents && notif.incidentId && (
                        <button
                          onClick={() => {
                            onNavigateToIncidents();
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors"
                        >
                          View Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Connected Users: Supervisor (Elena) · Maintenance (Frank) · Admin (Sarah)
          </span>
          <button
            onClick={() => {
              notificationService.markAllAsRead();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors"
          >
            Mark All Read &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
