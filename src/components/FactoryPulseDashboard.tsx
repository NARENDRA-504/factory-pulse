import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  Droplets,
  Gauge,
  MapPin,
  Pause,
  Play,
  Thermometer,
  Zap,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { SimpleBarChart } from './SimpleBarChart';
import { PersistedTelemetrySummary } from './PersistedTelemetrySummary';
import { Incident, Machine, MaintenanceWorkOrder, TelemetryReading, UserProfile, UserRole } from '../types';

type Screen = 'dashboard' | 'machines' | 'incidents' | 'analytics' | 'users';
type MetricKey = 'vibration' | 'temperature' | 'speed' | 'load' | 'power';

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
    eyebrow: 'My workstation',
    title: 'Machine & shift overview',
    description: 'Check today’s machine condition, live readings, production progress, and open issues.',
  },
  Supervisor: {
    eyebrow: 'Shift operations',
    title: 'Floor health at a glance',
    description: 'Compare plant conditions, spot machines that need attention, and follow the shift queue.',
  },
  Manager: {
    eyebrow: 'Operations summary',
    title: 'Production & fleet health',
    description: 'Review output, machine availability, and operating conditions across the selected fleet.',
  },
  Maintenance: {
    eyebrow: 'Reliability workbench',
    title: 'Equipment condition & work queue',
    description: 'Prioritize open issues with current machine readings and work order status.',
  },
  Admin: {
    eyebrow: 'Platform overview',
    title: 'Fleet & operations summary',
    description: 'Review fleet status, production progress, and open operational issues.',
  },
};

const STATUS_COLORS: Record<string, string> = {
  Nominal: '#0f9f8f',
  Warning: '#e8a22a',
  Critical: '#e05b55',
  Offline: '#94a3b8',
};

type TrendMetric = { key: MetricKey; label: string; shortLabel: string; unit: string; color: string; limit?: number; limitLabel?: string; value: (row: TelemetryReading) => number };

const TREND_METRICS: TrendMetric[] = [
  { key: 'vibration', label: 'Spindle vibration', shortLabel: 'Vibration', unit: 'm/s²', color: '#cc6848', limit: 4.2, limitLabel: 'Operating limit', value: (row) => row.vibRms },
  { key: 'temperature', label: 'Coolant temperature', shortLabel: 'Coolant temp', unit: '°C', color: '#3287ad', limit: 35, limitLabel: 'Safe limit', value: (row) => row.coolantTempC },
  { key: 'speed', label: 'Spindle speed', shortLabel: 'Speed', unit: 'RPM', color: '#237d70', value: (row) => row.spindleRpm },
  { key: 'load', label: 'Motor load', shortLabel: 'Motor load', unit: '%', color: '#9c6fbd', limit: 85, limitLabel: 'Load limit', value: (row) => row.motorLoadPct },
  { key: 'power', label: 'Motor power', shortLabel: 'Power', unit: 'kW', color: '#c28b36', value: (row) => row.motorPowerKw },
];

const finiteValues = (values: Array<number | undefined | null>) => values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
const average = (values: Array<number | undefined | null>) => {
  const present = finiteValues(values);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};
const shortPlantName = (plant: string) => plant.includes(':') ? plant.split(':').slice(1).join(':').trim() : plant;
const displayNumber = (value: number | null | undefined, digits = 1) => value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const workOrderLabel = (status: MaintenanceWorkOrder['status']) => status.replace('_', ' ');

const MetricCard: React.FC<{ label: string; value: string; unit?: string; note: string; tone?: 'teal' | 'amber' | 'rose' | 'blue' | 'slate'; icon: React.ReactNode }> = ({ label, value, unit, note, tone = 'slate', icon }) => {
  const tones = {
    teal: 'text-teal-300 bg-teal-950/60',
    amber: 'text-amber-300 bg-amber-950/60',
    rose: 'text-rose-300 bg-rose-950/60',
    blue: 'text-sky-300 bg-sky-950/60',
    slate: 'text-slate-400 bg-slate-800',
  };
  return (
    <section className="min-w-0 rounded-xl border border-slate-800/80 bg-[#0c1424] px-3.5 py-3 shadow-sm sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="truncate text-2xl font-semibold tracking-tight text-slate-100 tabular-nums">{value}</span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-400">{note}</p>
    </section>
  );
};

export const MeterCard: React.FC<{ label: string; value: number | undefined; unit: string; limit: number; warningAt: number; limitLabel: string; scaleMax: number; digits?: number; icon: React.ReactNode }> = ({ label, value, unit, limit, warningAt, limitLabel, scaleMax, digits = 1, icon }) => {
  const current = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const fraction = current == null ? 0 : Math.max(0, Math.min(1, current / scaleMax));
  const limitFraction = Math.max(0, Math.min(1, limit / scaleMax));
  const status = current == null ? 'Unavailable' : current > limit ? 'Above limit' : current >= warningAt ? 'Check reading' : 'In range';
  const color = current == null ? '#64748b' : current > limit ? '#fb7185' : current >= warningAt ? '#fbbf24' : '#2dd4bf';
  const angle = Math.PI * (1 - limitFraction);
  const tickX1 = 76 + Math.cos(angle) * 49;
  const tickY1 = 76 - Math.sin(angle) * 49;
  const tickX2 = 76 + Math.cos(angle) * 64;
  const tickY2 = 76 - Math.sin(angle) * 64;
  return <section className="min-w-0 rounded-xl border border-slate-800/80 bg-[#0c1424] px-3 py-3 shadow-sm sm:px-3.5" aria-label={`${label}: ${current == null ? 'unavailable' : `${displayNumber(current, digits)} ${unit}`}, ${limitLabel} ${displayNumber(limit, digits)} ${unit}`}>
    <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-teal-300">{icon}</span></div>
    <svg viewBox="0 0 152 100" role="img" aria-label={`${label} meter`} className="mx-auto mt-1 h-[104px] w-full max-w-[220px]">
      <path d="M 18 76 A 58 58 0 0 1 134 76" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" pathLength="100" />
      <path d="M 18 76 A 58 58 0 0 1 134 76" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray={`${fraction * 100} 100`} />
      <line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2} stroke="#f8fafc" strokeWidth="2.5" />
      <text x="76" y="61" textAnchor="middle" fill="#f8fafc" fontSize="19" fontWeight="700">{current == null ? '—' : displayNumber(current, digits)}</text>
      <text x="76" y="78" textAnchor="middle" fill="#94a3b8" fontSize="10">{unit}</text>
    </svg>
    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px]"><span className="font-semibold" style={{ color }}>{status}</span><span className="text-right text-slate-400">{limitLabel} {displayNumber(limit, digits)} {unit}</span></div>
  </section>;
};

const Panel: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`min-w-0 rounded-xl border border-slate-800/80 bg-[#0c1424] p-4 shadow-sm sm:p-5 ${className}`}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const LiveTrend: React.FC<{ readings: TelemetryReading[]; metric: TrendMetric }> = ({ readings, metric }) => {
  const data = readings.map((reading) => ({ value: metric.value(reading), time: reading.timestamp })).filter((point) => Number.isFinite(point.value));
  if (!data.length) {
    return <div className="flex min-h-[240px] items-center justify-center rounded-lg bg-slate-900/70 px-6 text-center text-sm text-slate-400">No {metric.shortLabel.toLowerCase()} history is available yet. The current reading is shown above.</div>;
  }

  const values = data.map((point) => point.value);
  const low = Math.min(...values, ...(metric.limit == null ? [] : [metric.limit]));
  const high = Math.max(...values, ...(metric.limit == null ? [] : [metric.limit]));
  const padding = Math.max((high - low) * 0.2, high === low ? Math.abs(high) * 0.08 : 0.1);
  const minY = Math.max(0, low - padding);
  const maxY = high + padding;
  const width = 720;
  const height = 250;
  const left = 48;
  const right = 16;
  const top = 16;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xAt = (index: number) => left + (data.length <= 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
  const yAt = (value: number) => top + ((maxY - value) / (maxY - minY || 1)) * chartHeight;
  const line = data.map((point, index) => `${index ? 'L' : 'M'} ${xAt(index).toFixed(1)} ${yAt(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L ${xAt(data.length - 1).toFixed(1)} ${(top + chartHeight).toFixed(1)} L ${xAt(0).toFixed(1)} ${(top + chartHeight).toFixed(1)} Z`;
  const current = data[data.length - 1];
  const timeLabel = (timestamp?: string) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const ticks = Array.from({ length: 4 }, (_, index) => maxY - (index / 3) * (maxY - minY));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div><span className="text-3xl font-semibold tracking-tight text-slate-100 tabular-nums">{displayNumber(current.value, metric.unit === 'RPM' ? 0 : 2)}</span><span className="ml-1.5 text-sm text-slate-400">{metric.unit}</span></div>
        <span className="text-[11px] text-slate-400">{data.length} recent simulator readings</span>
      </div>
      <div className="h-[230px] w-full overflow-hidden rounded-lg bg-slate-950/70">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label} recent readings`} className="h-full w-full">
          <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={metric.color} stopOpacity=".2"/><stop offset="100%" stopColor={metric.color} stopOpacity="0"/></linearGradient></defs>
          {ticks.map((tick, index) => {
            const y = yAt(tick);
            return <g key={index}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 5"/><text x={left - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">{displayNumber(tick, metric.unit === 'RPM' ? 0 : 1)}</text></g>;
          })}
          {metric.limit != null && metric.limit >= minY && metric.limit <= maxY && <g><line x1={left} x2={width - right} y1={yAt(metric.limit)} y2={yAt(metric.limit)} stroke="#cf6657" strokeDasharray="6 4"/><text x={width - right - 2} y={yAt(metric.limit) - 5} textAnchor="end" fill="#b4534a" fontSize="10">{metric.limitLabel}: {metric.limit} {metric.unit}</text></g>}
          <path d={area} fill="url(#trend-fill)"/>
          {data.length > 1 && <path d={line} fill="none" stroke={metric.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
          <circle cx={xAt(data.length - 1)} cy={yAt(current.value)} r="5" fill={metric.color} stroke="white" strokeWidth="2"/>
          <text x={left} y={height - 8} fill="#64748b" fontSize="10">{timeLabel(data[0].time)}</text>
          <text x={width - right} y={height - 8} textAnchor="end" fill="#64748b" fontSize="10">{timeLabel(current.time)}</text>
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-400">This line uses the readings collected since this page was opened. No earlier history is available in this view.</p>
    </div>
  );
};

const StackedStatusBar: React.FC<{ machines: Machine[] }> = ({ machines }) => {
  const statuses = ['Nominal', 'Warning', 'Critical', 'Offline'];
  const counts = statuses.map((status) => machines.filter((machine) => machine.status === status).length);
  const total = machines.length;
  return (
    <div className="space-y-4">
      {Array.from(new Set(machines.map((machine) => machine.plant).filter(Boolean))).sort().map((plant) => {
        const rows = machines.filter((machine) => machine.plant === plant);
        return (
          <div key={plant}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate font-medium text-slate-300">{shortPlantName(plant)}</span><span className="shrink-0 text-slate-400">{rows.length} units</span></div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-800" aria-label={`${plant}: ${rows.length} machines`}>
              {statuses.map((status) => {
                const count = rows.filter((machine) => machine.status === status).length;
                return count ? <span key={status} title={`${status}: ${count}`} style={{ width: `${(count / rows.length) * 100}%`, backgroundColor: STATUS_COLORS[status] }} /> : null;
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">{statuses.map((status) => { const count = rows.filter((machine) => machine.status === status).length; return count ? <span key={status} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }}/>{count} {status.toLowerCase()}</span> : null; })}</div>
          </div>
        );
      })}
      {!total && <p className="py-10 text-center text-sm text-slate-400">No machines match these filters.</p>}
      {!!total && <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">{statuses.map((status, index) => <span key={status} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }}/>{status}: {counts[index]}</span>)}</div>}
    </div>
  );
};

const PlantComparison: React.FC<{ machines: Machine[]; metric: 'coolantTemperatureC' | 'vibrationMmS' | 'motorLoadPercent' | 'powerKw'; label: string; unit: string; color: string; threshold?: number; groupBy: 'plant' | 'machineType' }> = ({ machines, metric, label, unit, color, threshold, groupBy }) => {
  const groups = Array.from(new Set(machines.map((machine) => groupBy === 'plant' ? machine.plant : machine.machineType).filter(Boolean))).sort().map((name) => {
    const rows = machines.filter((machine) => (groupBy === 'plant' ? machine.plant : machine.machineType) === name);
    return { name: groupBy === 'plant' ? shortPlantName(name) : name, value: average(rows.map((machine) => machine[metric])) };
  }).filter((entry) => entry.value != null);
  const maxValue = Math.max(threshold ?? 0, ...groups.map((entry) => entry.value || 0), 1);
  return (
    <div className="space-y-3">
      {groups.map(({ name, value }) => (
        <div key={name}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-400">{name}</span><span className="shrink-0 font-semibold tabular-nums text-slate-200">{displayNumber(value, 1)} {unit}</span></div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${Math.min(100, ((value || 0) / maxValue) * 100)}%`, backgroundColor: color }}/>{threshold != null && <span className="absolute inset-y-[-2px] w-px bg-slate-900/700" style={{ left: `${Math.min(100, (threshold / maxValue) * 100)}%` }} />}</div>
        </div>
      ))}
      {!groups.length && <p className="py-6 text-center text-xs text-slate-400">No readings are available for this selection.</p>}
      {threshold != null && <p className="border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">Line marks the {threshold} {unit} watch level.</p>}
      <p className="text-[11px] text-slate-400">Average {label.toLowerCase()} from current machine roster values; this is a plant comparison, not a time trend.</p>
    </div>
  );
};

export const FactoryPulseDashboard: React.FC<FactoryPulseDashboardProps> = ({ currentUser, machines, incidents, workOrders, onNavigate, onSelectMachine, onRefreshData }) => {
  const isOperator = currentUser.role === 'Operator';
  const assignedMachine = useMemo(() => machines.find((machine) =>
    machine.code === currentUser.assignedMachine || machine.machineCode === currentUser.assignedMachine ||
    machine.assignedOperator === currentUser.fullName || machine.operatorWorkId === currentUser.workId
  ) || machines[0], [machines, currentUser.assignedMachine, currentUser.fullName, currentUser.workId]);
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [comparisonGroup, setComparisonGroup] = useState<'plant' | 'machineType'>('plant');
  const [isStreaming, setIsStreaming] = useState(true);
  const [trendKey, setTrendKey] = useState<MetricKey>('vibration');
  const [workOrderFeedback, setWorkOrderFeedback] = useState<string | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>(() => isOperator && assignedMachine ? [apiClient.getLiveTelemetrySnapshot(assignedMachine.code)] : []);

  useEffect(() => {
    if (!isOperator || !assignedMachine) { setTelemetryHistory([]); return; }
    if (!isStreaming) return;
    const pushReading = () => setTelemetryHistory((previous) => [...previous.slice(-29), apiClient.getLiveTelemetrySnapshot(assignedMachine.code)]);
    pushReading();
    const timer = window.setInterval(pushReading, 1800);
    return () => window.clearInterval(timer);
  }, [isOperator, assignedMachine, isStreaming]);

  const plants = useMemo(() => Array.from(new Set(machines.map((machine) => machine.plant).filter(Boolean))).sort(), [machines]);
  const types = useMemo(() => Array.from(new Set(machines.map((machine) => machine.machineType).filter(Boolean))).sort(), [machines]);
  const filteredMachines = useMemo(() => isOperator ? (assignedMachine ? [assignedMachine] : []) : machines.filter((machine) => (plantFilter === 'ALL' || machine.plant === plantFilter) && (typeFilter === 'ALL' || machine.machineType === typeFilter)), [assignedMachine, isOperator, machines, plantFilter, typeFilter]);
  const machineCodes = useMemo(() => new Set(filteredMachines.flatMap((machine) => [machine.code, machine.machineCode])), [filteredMachines]);
  const allMachineCodes = useMemo(() => new Set(machines.flatMap((machine) => [machine.code, machine.machineCode])), [machines]);
  const hasFleetFilter = !isOperator && (plantFilter !== 'ALL' || typeFilter !== 'ALL');
  const activeIncidents = useMemo(() => incidents.filter((incident) => incident.status !== 'Closed' && (!hasFleetFilter || machineCodes.has(incident.machineCode)) && (isOperator ? machineCodes.has(incident.machineCode) : true)), [hasFleetFilter, incidents, isOperator, machineCodes]);
  const visibleWorkOrders = useMemo(() => workOrders.filter((order) => !hasFleetFilter || machineCodes.has(order.machineCode)), [hasFleetFilter, machineCodes, workOrders]);
  const unmappedOpenIncidentCount = incidents.filter((incident) => incident.status !== 'Closed' && !allMachineCodes.has(incident.machineCode)).length;
  const unmappedWorkOrderCount = workOrders.filter((order) => !allMachineCodes.has(order.machineCode)).length;
  const selectedMachine = isOperator ? assignedMachine : filteredMachines[0];
  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];
  const selectedTrend = TREND_METRICS.find((metric) => metric.key === trendKey) || TREND_METRICS[0];
  const copy = ROLE_COPY[currentUser.role];
  const nominalCount = filteredMachines.filter((machine) => machine.status === 'Nominal').length;
  const warningCount = filteredMachines.filter((machine) => machine.status === 'Warning').length;
  const criticalCount = filteredMachines.filter((machine) => machine.status === 'Critical').length;
  const offlineCount = filteredMachines.filter((machine) => machine.status === 'Offline').length;
  const needsAttention = warningCount + criticalCount + offlineCount;
  const produced = filteredMachines.reduce((sum, machine) => sum + (machine.jobsProducedThisShift || 0), 0);
  const target = filteredMachines.reduce((sum, machine) => sum + (machine.shiftJobsTarget || 0), 0);
  const productionPercent = target ? Math.min(100, (produced / target) * 100) : 0;
  const avgCoolant = average(filteredMachines.map((machine) => machine.coolantTemperatureC));
  const avgVibration = average(filteredMachines.map((machine) => machine.vibrationMmS));
  const avgLoad = average(filteredMachines.map((machine) => machine.motorLoadPercent));
  const avgSpeed = average(filteredMachines.map((machine) => machine.spindleRpm));
  const avgPower = average(filteredMachines.map((machine) => machine.powerKw));
  const totalAlerts = filteredMachines.reduce((sum, machine) => sum + (machine.activeAlertCount || 0), 0);
  const telemetryCritical = !!latestTelemetry && (latestTelemetry.vibRms > 4.2 || latestTelemetry.motorLoadPct > 90 || latestTelemetry.coolantTempC > 45);
  const telemetryWarning = !!latestTelemetry && (latestTelemetry.vibRms > 3.2 || latestTelemetry.motorLoadPct > 80 || latestTelemetry.coolantTempC > 35);
  const operatorCondition = telemetryCritical ? 'Critical' : telemetryWarning ? 'Warning' : selectedMachine?.status || '—';
  const operatorProduction = selectedMachine?.jobsProducedThisShift || 0;
  const operatorTarget = selectedMachine?.shiftJobsTarget || 0;

  const updateWorkOrder = async (order: MaintenanceWorkOrder, status: MaintenanceWorkOrder['status']) => {
    try {
      await apiClient.updateWorkOrderStatus(order.id, status);
      setWorkOrderFeedback(`${order.orderCode} marked ${workOrderLabel(status).toLowerCase()}.`);
      onRefreshData?.();
    } catch (error) {
      setWorkOrderFeedback(error instanceof Error ? error.message : 'Could not update this work order.');
    }
  };

  const roleAction = currentUser.role === 'Operator'
    ? null
    : <button onClick={() => onNavigate(currentUser.role === 'Admin' ? 'users' : currentUser.role === 'Manager' ? 'analytics' : currentUser.role === 'Maintenance' ? 'incidents' : 'incidents')} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700">{currentUser.role === 'Admin' ? 'User directory' : currentUser.role === 'Manager' ? 'Open analytics' : currentUser.role === 'Maintenance' ? 'Work queue' : 'Triage issues'}<ArrowRight className="h-3.5 w-3.5"/></button>;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-5 text-slate-100">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-[#0c1424] px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300"><Activity className="h-3.5 w-3.5"/>{copy.eyebrow}</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roleAction}
          {!isOperator && <button onClick={() => onNavigate('machines')} className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-[#0c1424] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-900/70"><Cpu className="h-3.5 w-3.5"/>Browse machines</button>}
          {onRefreshData && !isOperator && <button onClick={onRefreshData} title="Refresh dashboard data" aria-label="Refresh dashboard data" className="rounded-lg border border-slate-800/80 bg-[#0c1424] p-2 text-slate-400 hover:bg-slate-900/70"><Activity className="h-4 w-4"/></button>}
        </div>
      </header>

      <PersistedTelemetrySummary machine={selectedMachine} user={currentUser} />

      {isOperator ? (
        <>
          <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0c1424] px-4 py-3 shadow-sm sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-slate-400"/><span className="truncate text-sm font-semibold text-slate-200">{selectedMachine?.displayName || selectedMachine?.name || 'Assigned machine'}</span><span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">{selectedMachine?.machineCode || selectedMachine?.code || currentUser.assignedMachine}</span></div>
            <div className="flex items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-semibold ${operatorCondition === 'Nominal' ? 'bg-emerald-950/60 text-emerald-300' : operatorCondition === 'Critical' ? 'bg-rose-950/60 text-rose-300' : operatorCondition === 'Warning' ? 'bg-amber-950/60 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{operatorCondition}</span><button onClick={() => setIsStreaming((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-800/80 px-2.5 py-1.5 text-slate-400 hover:bg-slate-900/70">{isStreaming ? <Pause className="h-3.5 w-3.5"/> : <Play className="h-3.5 w-3.5"/>}{isStreaming ? 'Pause stream' : 'Resume stream'}</button><span className="text-slate-400">Simulator stream</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            <MeterCard label="Vibration" value={latestTelemetry?.vibRms} unit="m/s²" warningAt={3.2} limit={4.2} limitLabel="Baseline" scaleMax={6.3} digits={2} icon={<Activity className="h-4 w-4"/>}/>
            <MeterCard label="Coolant temp" value={latestTelemetry?.coolantTempC} unit="°C" warningAt={30} limit={35} limitLabel="Safe limit" scaleMax={52.5} icon={<Thermometer className="h-4 w-4"/>}/>
            <MetricCard label="Spindle speed" value={displayNumber(latestTelemetry?.spindleRpm, 0)} unit="RPM" note="Current simulator reading" tone="teal" icon={<Gauge className="h-4 w-4"/>}/>
            <MeterCard label="Motor load" value={latestTelemetry?.motorLoadPct} unit="%" warningAt={80} limit={85} limitLabel="Load limit" scaleMax={100} icon={<Zap className="h-4 w-4"/>}/>
            <MetricCard label="Motor power" value={displayNumber(latestTelemetry?.motorPowerKw, 1)} unit="kW" note="Current simulator reading" tone="slate" icon={<Zap className="h-4 w-4"/>}/>
            <MetricCard label="Open issues" value={String(activeIncidents.length)} note="Assigned workstation" tone={activeIncidents.length ? 'rose' : 'teal'} icon={<AlertTriangle className="h-4 w-4"/>}/>
          </div>
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <Panel title="Recent sensor readings" subtitle="Live simulator readings collected since this page was opened." className="xl:col-span-8" action={<div className="flex flex-wrap gap-1">{TREND_METRICS.map((metric) => <button key={metric.key} onClick={() => setTrendKey(metric.key)} className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${trendKey === metric.key ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{metric.shortLabel}</button>)}</div>}>
              <LiveTrend readings={telemetryHistory} metric={selectedTrend}/>
            </Panel>
            <div className="space-y-3.5 xl:col-span-4">
              <Panel title="Shift production" subtitle="Progress from the machine roster’s shift count.">
                {selectedMachine && operatorTarget > 0 ? <>
                  <div className="flex items-baseline justify-between"><div><span className="text-3xl font-semibold tabular-nums text-slate-100">{operatorProduction.toLocaleString()}</span><span className="ml-1 text-sm text-slate-400">/ {operatorTarget.toLocaleString()} parts</span></div><span className="text-sm font-semibold text-teal-300">{displayNumber(productionPercent, 0)}%</span></div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${productionPercent}%` }}/></div>
                  <p className="mt-2 text-xs text-slate-400">{Math.max(0, operatorTarget - operatorProduction).toLocaleString()} parts remain to reach the listed shift target.</p>
                </> : <p className="text-sm text-slate-400">Shift target data is unavailable for this machine.</p>}
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs"><span className="text-slate-400">Shift duration recorded</span><span className="font-semibold text-slate-300">{selectedMachine?.workingTimeMinutes != null ? `${Math.floor(selectedMachine.workingTimeMinutes / 60)}h ${selectedMachine.workingTimeMinutes % 60}m` : '—'}</span></div>
              </Panel>
              <Panel title="Issue queue" subtitle={`${activeIncidents.length} open issue${activeIncidents.length === 1 ? '' : 's'} for this station.`} action={<button onClick={() => onNavigate('incidents')} className="text-[11px] font-semibold text-teal-300 hover:text-teal-200">View all</button>}>
                {activeIncidents.length ? <div className="space-y-2.5">{activeIncidents.slice(0, 3).map((incident) => <div key={incident.id} className="flex gap-2.5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${incident.severity === 'Critical' || incident.severity === 'High' ? 'bg-rose-950/600' : incident.severity === 'Medium' ? 'bg-amber-950/600' : 'bg-slate-400'}`}/><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{incident.incidentCode} · {incident.severity}</p><p className="truncate text-[11px] text-slate-400">{incident.symptomDescription}</p></div></div>)}</div> : <p className="flex items-center gap-2 py-1 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4"/>No open issues for this station.</p>}
              </Panel>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-[#0c1424] px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-400"><MapPin className="h-4 w-4"/></span>Compare current machine roster readings by plant. No historical fleet trend is available in this view.</div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="dashboard-plant">Plant</label><select id="dashboard-plant" value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} className="max-w-[240px] rounded-lg border border-slate-800/80 bg-[#0c1424] px-3 py-2 text-xs text-slate-300 focus:border-teal-500 focus:outline-none"><option value="ALL">All plants</option>{plants.map((plant) => <option key={plant} value={plant}>{plant}</option>)}</select>
              <label className="sr-only" htmlFor="dashboard-machine-type">Machine type</label><select id="dashboard-machine-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="max-w-[250px] rounded-lg border border-slate-800/80 bg-[#0c1424] px-3 py-2 text-xs text-slate-300 focus:border-teal-500 focus:outline-none"><option value="ALL">All machine types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Machines" value={filteredMachines.length.toLocaleString()} note="In current selection" tone="slate" icon={<Cpu className="h-4 w-4"/>}/>
            <MetricCard label="Nominal" value={nominalCount.toLocaleString()} note={filteredMachines.length ? `${displayNumber((nominalCount / filteredMachines.length) * 100, 0)}% of selected fleet` : 'No matching machines'} tone="teal" icon={<CheckCircle2 className="h-4 w-4"/>}/>
            <MetricCard label="Need attention" value={needsAttention.toLocaleString()} note={`${warningCount} warning · ${criticalCount} critical · ${offlineCount} offline`} tone={needsAttention ? 'amber' : 'teal'} icon={<AlertTriangle className="h-4 w-4"/>}/>
            <MetricCard label="Open issues" value={activeIncidents.length.toLocaleString()} note={`${totalAlerts} machine alerts in roster`} tone={activeIncidents.length ? 'rose' : 'teal'} icon={<Activity className="h-4 w-4"/>}/>
            <MetricCard label="Avg coolant" value={displayNumber(avgCoolant, 1)} unit="°C" note="Safe limit 35°C" tone={avgCoolant != null && avgCoolant > 35 ? 'amber' : 'blue'} icon={<Droplets className="h-4 w-4"/>}/>
            <MetricCard label="Avg vibration" value={displayNumber(avgVibration, 2)} unit="mm/s" note="Fleet watch level 3.0 mm/s" tone={avgVibration != null && avgVibration > 3 ? 'amber' : 'slate'} icon={<Activity className="h-4 w-4"/>}/>
          </div>
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <Panel title="Machine status by plant" subtitle={`${nominalCount} of ${filteredMachines.length} machines are nominal in this selection.`} className="xl:col-span-8">
              <StackedStatusBar machines={filteredMachines}/>
            </Panel>
            <Panel title="Shift output" subtitle="Production counts and targets from the machine roster." className="xl:col-span-4">
              <div className="flex items-end justify-between gap-3"><div><span className="text-3xl font-semibold tabular-nums text-slate-100">{produced.toLocaleString()}</span><span className="ml-1 text-sm text-slate-400">/ {target.toLocaleString()} parts</span></div><span className="text-sm font-semibold text-teal-300">{target ? `${displayNumber(productionPercent, 0)}%` : '—'}</span></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-teal-600" style={{ width: `${productionPercent}%` }}/></div>
              <p className="mt-2 text-xs text-slate-400">{target ? `${Math.max(0, target - produced).toLocaleString()} parts remain to reach the combined target.` : 'Shift target data is unavailable for this selection.'}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3 text-xs"><div><span className="block text-slate-400">Avg motor load</span><strong className="mt-0.5 block text-slate-200">{displayNumber(avgLoad, 1)}%</strong><span className="mt-0.5 block text-[10px] text-slate-400">85% operating limit</span></div><div><span className="block text-slate-400">Avg power</span><strong className="mt-0.5 block text-slate-200">{displayNumber(avgPower, 1)} kW</strong></div><div><span className="block text-slate-400">Avg spindle speed</span><strong className="mt-0.5 block text-slate-200">{displayNumber(avgSpeed, 0)} RPM</strong></div><div><span className="block text-slate-400">Open work orders</span><strong className="mt-0.5 block text-slate-200">{visibleWorkOrders.filter((order) => order.status !== 'Completed').length}</strong></div></div>
            </Panel>
          </div>
          <Panel title="Shift production by plant" subtitle="Parts produced compared with each plant’s recorded shift target. These are current roster counts, not a time trend.">
            <SimpleBarChart data={Array.from(new Set(filteredMachines.map((machine) => machine.plant).filter(Boolean))).sort().map((plant) => {
              const rows = filteredMachines.filter((machine) => machine.plant === plant);
              const output = rows.reduce((sum, machine) => sum + (machine.jobsProducedThisShift || 0), 0);
              const plantTarget = rows.reduce((sum, machine) => sum + (machine.shiftJobsTarget || 0), 0);
              return { label: shortPlantName(plant), value: output, color: plantTarget > 0 && output >= plantTarget ? '#34d399' : '#14b8a6', detail: plantTarget ? `${displayNumber(output / plantTarget * 100, 0)}% of ${plantTarget.toLocaleString()} part target` : 'No shift target recorded' };
            })} unit="parts" emptyText="No production counts are available for this selection." />
          </Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-400">Compare current readings by:</p><div className="inline-flex w-fit rounded-lg border border-slate-800/80 bg-[#0c1424] p-1 shadow-sm"><button onClick={() => setComparisonGroup('plant')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${comparisonGroup === 'plant' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900/70'}`}>Plant</button><button onClick={() => setComparisonGroup('machineType')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${comparisonGroup === 'machineType' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900/70'}`}>Machine type</button></div></div>
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Panel title={`Coolant temperature by ${comparisonGroup === 'plant' ? 'plant' : 'machine type'}`} subtitle="Mean current reading; the marker is the 35°C safe limit.">
              <PlantComparison machines={filteredMachines} metric="coolantTemperatureC" label="coolant temperature" unit="°C" color="#3287ad" threshold={35} groupBy={comparisonGroup}/>
            </Panel>
            <Panel title={`Vibration by ${comparisonGroup === 'plant' ? 'plant' : 'machine type'}`} subtitle="Mean roster reading; the marker is the app’s 3.0 mm/s watch level.">
              <PlantComparison machines={filteredMachines} metric="vibrationMmS" label="vibration" unit="mm/s" color="#cc6848" threshold={3} groupBy={comparisonGroup}/>
            </Panel>
          </div>
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <Panel title={currentUser.role === 'Maintenance' ? 'Work order queue' : 'Open issue queue'} subtitle={currentUser.role === 'Maintenance' ? (hasFleetFilter ? 'Tasks linked to machines in the current selection.' : 'Open work orders from the project data.') : (hasFleetFilter ? 'Incidents linked to machines in the current selection.' : 'Open incidents from the project data.')} className="xl:col-span-8" action={<button onClick={() => onNavigate('incidents')} className="text-[11px] font-semibold text-teal-300 hover:text-teal-200">Open incident board</button>}>
              {workOrderFeedback && currentUser.role === 'Maintenance' && <p role="status" className="mb-2 rounded-lg bg-teal-950/60 px-3 py-2 text-xs font-medium text-teal-200">{workOrderFeedback}</p>}
              {currentUser.role === 'Maintenance' && visibleWorkOrders.length ? <div className="divide-y divide-slate-800/80">{visibleWorkOrders.slice(0, 5).map((order) => <div key={order.id} className="flex items-center justify-between gap-3 py-2.5"><button onClick={() => onNavigate('incidents')} className="min-w-0 flex-1 text-left hover:text-teal-200"><span className="block truncate text-xs font-semibold text-slate-200">{order.orderCode} · {order.machineCode}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{order.incidentCode} · {order.technicianName}</span></button><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${order.status === 'Completed' ? 'bg-emerald-950/60 text-emerald-300' : order.priority === 'Urgent' ? 'bg-rose-950/60 text-rose-300' : 'bg-amber-950/60 text-amber-300'}`}>{workOrderLabel(order.status)}</span>{order.status !== 'Completed' && <div className="flex shrink-0 gap-1">{order.status === 'Pending' && <button onClick={() => updateWorkOrder(order, 'In_Progress')} className="rounded-md border border-amber-800/70 bg-amber-950/60 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-900/60">Start</button>}<button onClick={() => updateWorkOrder(order, 'Completed')} className="rounded-md border border-emerald-800/70 bg-emerald-950/60 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-900/60">Complete</button></div>}</div>)}</div> : activeIncidents.length ? <div className="divide-y divide-slate-800/80">{activeIncidents.slice(0, 5).map((incident) => <button key={incident.id} onClick={() => onNavigate('incidents')} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-900/70"><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-200">{incident.incidentCode} · {incident.machineCode}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{incident.symptomDescription}</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${incident.severity === 'Critical' || incident.severity === 'High' ? 'bg-rose-950/60 text-rose-300' : incident.severity === 'Medium' ? 'bg-amber-950/60 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{incident.severity}</span></button>)}</div> : <p className="flex items-center gap-2 py-4 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4"/>No open issues in the current selection.</p>}
              {((currentUser.role === 'Maintenance' && unmappedWorkOrderCount > 0) || (currentUser.role !== 'Maintenance' && unmappedOpenIncidentCount > 0)) && <p className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed text-slate-400">{currentUser.role === 'Maintenance' ? `${unmappedWorkOrderCount} work order${unmappedWorkOrderCount === 1 ? '' : 's'} use legacy machine codes and cannot be matched to a plant.` : `${unmappedOpenIncidentCount} open issue${unmappedOpenIncidentCount === 1 ? '' : 's'} use legacy machine codes and cannot be matched to a plant.`}</p>}
            </Panel>
            <Panel title="How to read this view" subtitle="Values are shown with their source and unit.">
              <div className="space-y-3 text-xs leading-relaxed text-slate-400"><p className="flex gap-2"><span className="mt-0.5 text-teal-300"><Cpu className="h-4 w-4"/></span><span>Fleet comparisons use the machine roster’s current values; there is no historical plant timeline in this dashboard.</span></p><p className="flex gap-2"><span className="mt-0.5 text-sky-300"><Thermometer className="h-4 w-4"/></span><span>Coolant readings are in °C. The app’s safe limit is 35°C. Separate machine case-temperature readings are not available in the current data.</span></p><p className="flex gap-2"><span className="mt-0.5 text-amber-300"><Activity className="h-4 w-4"/></span><span>Roster vibration is shown in mm/s. Operator simulator vibration is a separate measure in m/s².</span></p><button onClick={() => { if (selectedMachine) onSelectMachine(selectedMachine.code); onNavigate(currentUser.role === 'Admin' ? 'users' : 'machines'); }} className="inline-flex items-center gap-1 pt-1 font-semibold text-teal-300 hover:text-teal-200">{currentUser.role === 'Admin' ? 'Manage users' : 'Inspect machine details'}<ArrowRight className="h-3.5 w-3.5"/></button></div>
            </Panel>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-800/80 px-1 pt-2 text-[10px] text-slate-400"><span>FactoryPulse dashboard · {currentUser.role}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{isOperator ? 'Simulator stream' : 'Current roster values'}</span></div>
    </div>
  );
};
