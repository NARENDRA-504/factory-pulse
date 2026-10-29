import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Cpu, Users } from 'lucide-react';
import { SimulatorFleetTelemetryDashboard } from './SimulatorFleetTelemetryDashboard';
import { RoleDashboardHighlights } from './RoleDashboardHighlights';
import { Incident, Machine, MaintenanceWorkOrder, UserProfile, UserRole } from '../types';
import { apiClient } from '../services/apiClient';
import { PersistedSimulatorReading } from '../services/apiClient';

type Screen = 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users' | 'activity' | 'inventory' | 'maintenance';

interface FactoryPulseDashboardProps {
  currentUser: UserProfile;
  machines: Machine[];
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: Screen) => void;
  onSelectMachine: (code: string) => void;
  onRefreshData?: () => void;
}

const ROLE_COPY: Record<UserRole, { eyebrow: string; title: string; description: string }> = {
  Operator: {
    eyebrow: 'My Workstation Console',
    title: 'Machine & Shift Overview',
    description: 'Live Simulator readings for your assigned machine, plus issues that need your attention.',
  },
  Supervisor: {
    eyebrow: 'Shift Operations Management',
    title: 'Plant Operations & Fleet Health',
    description: 'Review incoming machine conditions, prioritize incidents, coordinate technician response, and maintain plant line readiness.',
  },
  Maintenance: {
    eyebrow: 'Reliability Workbench',
    title: 'Machine Condition & Work Queue',
    description: 'Use saved sensor history to investigate equipment and move assigned work orders forward.',
  },
  Manager: {
    eyebrow: 'Operations Summary & Executive Governance',
    title: 'Plant Condition & Operational Risk',
    description: 'Compare verified machine condition across plants, review open operational risks, and follow up on issues needing a decision.',
  },
  Admin: {
    eyebrow: 'Platform Governance & Master Oversight',
    title: 'Telemetry & Operations Control Room',
    description: 'Monitor incoming machine data, manage user credentials, and administer platform policies.',
  },
};

export const MeterCard: React.FC<{
  label: string;
  value: number | undefined;
  unit: string;
  limit: number;
  warningAt: number;
  limitLabel: string;
  scaleMax: number;
  digits?: number;
  icon: React.ReactNode;
}> = ({ label, value, unit, limit, warningAt, limitLabel, scaleMax, digits = 1, icon }) => {
  const ok = typeof value === 'number' && Number.isFinite(value);
  const fraction = ok ? Math.max(0, Math.min(1, value / scaleMax)) : 0;
  const color = !ok ? '#64748b' : value > limit ? '#fb7185' : value >= warningAt ? '#fbbf24' : '#2dd4bf';
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
        <span>{label}</span>
        <span className="text-teal-800">{icon}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
        {ok ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'} <span className="text-xs font-normal text-slate-600">{unit}</span>
      </p>
      <p className="text-[10px] text-slate-500">
        {ok ? `${limitLabel} ${limit} ${unit}` : 'No Simulator value received'}
      </p>
    </section>
  );
};

const RoleActions: React.FC<{
  user: UserProfile;
  incidents: Incident[];
  workOrders: MaintenanceWorkOrder[];
  onNavigate: (screen: Screen) => void;
  onSelectMachine: (code: string) => void;
  onRefreshData?: () => void;
}> = ({ user, incidents, workOrders, onNavigate, onSelectMachine, onRefreshData }) => {
  const [feedback, setFeedback] = React.useState('');
  const scopedIncidents = incidents.filter(
    (i) => i.status !== 'Closed' && (user.role !== 'Operator' || i.machineCode === user.assignedMachine)
  );
  const openOrders = workOrders.filter((o) => o.status !== 'Completed');

  const actions: Record<UserRole, { label: string; target: Screen; icon: React.ReactNode; note: string }> = {
    Operator: {
      label: 'Report a machine issue',
      target: 'incidents',
      icon: <AlertTriangle className="h-4 w-4" />,
      note: 'Report abnormal readings or a safety concern for your assigned workstation.',
    },
    Supervisor: {
      label: 'Prioritize open incidents',
      target: 'incidents',
      icon: <ClipboardList className="h-4 w-4" />,
      note: 'Review open and high-severity incidents, then assign the next response.',
    },
    Maintenance: {
      label: 'Open maintenance queue',
      target: 'maintenance',
      icon: <ClipboardList className="h-4 w-4" />,
      note: 'Review work orders and update their status from the maintenance board.',
    },
    Manager: {
      label: 'Review operations analytics',
      target: 'analytics',
      icon: <Activity className="h-4 w-4" />,
      note: 'Compare verified plant condition and review open operational risks. Production and financial KPIs appear when their source data is available.',
    },
    Admin: {
      label: 'Manage users and access',
      target: 'users',
      icon: <Users className="h-4 w-4" />,
      note: 'Administer employee accounts, permissions, and role access.',
    },
  };

  const action = actions[user.role];

  const update = async (order: MaintenanceWorkOrder, status: MaintenanceWorkOrder['status']) => {
    try {
      await apiClient.updateWorkOrderStatus(order.id, status);
      setFeedback(`${order.orderCode} updated.`);
      onRefreshData?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not update work order.');
    }
  };

  return (
    <aside className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-teal-800">
          {action.icon}
          <h2 className="text-sm font-semibold text-slate-900">Your next step</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{action.note}</p>
        <button
          onClick={() => onNavigate(action.target)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-500"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {user.role !== 'Operator' && (
          <button
            onClick={() => onNavigate('machines')}
            className="ml-2 mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Cpu className="h-3.5 w-3.5" />
            Machine roster
          </button>
        )}
      </section>

      {user.role === 'Maintenance' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Open work orders</h2>
            <span className="text-xs font-mono text-amber-800">{openOrders.length}</span>
          </div>
          {feedback && <p role="status" className="mt-2 text-xs text-teal-800">{feedback}</p>}
          <div className="mt-2 divide-y divide-slate-100">
            {openOrders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {o.orderCode} · {o.machineCode}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {o.priority} priority · {o.status.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex gap-1">
                  {o.status === 'Pending' && (
                    <button
                      onClick={() => update(o, 'In_Progress')}
                      className="rounded border border-amber-200 px-2 py-1 text-[10px] text-slate-700"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => update(o, 'Completed')}
                    className="rounded border border-emerald-200 px-2 py-1 text-[10px] text-slate-700"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!openOrders.length && <p className="mt-2 text-xs text-slate-600">No open work orders.</p>}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Open incidents</h2>
            <span className="text-xs font-mono text-rose-800">{scopedIncidents.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {scopedIncidents.slice(0, 4).map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  onSelectMachine(i.machineCode);
                  onNavigate('incidents');
                }}
                className="flex w-full items-start justify-between gap-2 rounded-lg bg-slate-100/50 p-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {i.incidentCode} · {i.machineCode}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{i.symptomDescription}</span>
                </span>
                <span className="shrink-0 text-[10px] font-mono text-amber-800">{i.severity}</span>
              </button>
            ))}
          </div>
          {!scopedIncidents.length && (
            <p className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              No open incidents in this view.
            </p>
          )}
        </section>
      )}

      {user.role === 'Manager' && (
        <p className="rounded-lg border border-slate-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-slate-700">
          The Simulator sends sensor readings and machine status, but not production totals or downtime duration. Those KPIs are not inferred.
        </p>
      )}
    </aside>
  );
};

export const FactoryPulseDashboard: React.FC<FactoryPulseDashboardProps> = ({
  currentUser,
  machines,
  incidents,
  workOrders,
  onNavigate,
  onSelectMachine,
  onRefreshData,
}) => {
  const copy = ROLE_COPY[currentUser.role];
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry'>('overview');
  const [readings, setReadings] = useState<PersistedSimulatorReading[]>([]);
  const overviewRefreshInFlight = useRef(false);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    let mounted = true;
    const refresh = async () => {
      if (overviewRefreshInFlight.current) return;
      overviewRefreshInFlight.current = true;
      try {
        const latest = await apiClient.getLatestSimulatorFleetTelemetry();
        if (mounted) setReadings(latest);
      } catch {
        // Keep the last verified SQL snapshot visible during a short network interruption.
      } finally {
        overviewRefreshInFlight.current = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeTab, currentUser.id]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6 text-slate-900">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800 font-mono">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl font-display">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-mono">
            {currentUser.role}
          </span>
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 font-mono"
            >
              Refresh Operations Data
            </button>
          )}
        </div>
      </header>

      <nav aria-label="Dashboard views" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {([{ id: 'overview', label: `${currentUser.role} overview` }, { id: 'telemetry', label: 'Live machine telemetry' }] as const).map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{tab.label}</button>)}
      </nav>
      {activeTab === 'overview' ? <>
        <RoleDashboardHighlights user={currentUser} machines={machines} incidents={incidents} workOrders={workOrders} readings={readings} />
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12"><div className="2xl:col-span-8"><section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-900">Live telemetry preview</h2><p className="mt-1 text-xs text-slate-600">Saved Simulator readings for the authorized machine or role scope.</p><button onClick={() => setActiveTab('telemetry')} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Open live charts <ArrowRight className="h-3.5 w-3.5" /></button></section></div><div className="2xl:col-span-4"><RoleActions user={currentUser} incidents={incidents} workOrders={workOrders} onNavigate={onNavigate} onSelectMachine={onSelectMachine} onRefreshData={onRefreshData} /></div></div>
      </> : <SimulatorFleetTelemetryDashboard user={currentUser} machines={machines} onReadingsChange={setReadings} />}
      <footer className="border-t border-slate-200 pt-2 text-[10px] text-slate-500 font-mono">
        Sensor values and trends: FactoryPulse MySQL records received from AI Simulator. Operational queues: FactoryPulse incident and work-order records.
      </footer>
    </div>
  );
};
