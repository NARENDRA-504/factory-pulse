import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Gauge, Radio, TrendingUp, Zap } from 'lucide-react';
import { Machine, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';
import { OperationalInsights } from './OperationalInsights';

interface SimulatorFleetTelemetryDashboardProps {
  user: UserProfile;
  machines: Machine[];
  onReadingsChange?: (readings: PersistedSimulatorReading[]) => void;
}

const formatValue = (value: number | string | null, unit: string) => {
  const shown = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value ?? '—';
  return `${shown}${shown === '—' || shown === null || shown === '' ? '' : ` ${unit}`}`;
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : 'No Simulator readings yet';
const toPlantLabel = (plant?: string) => plant?.includes(':') ? plant.split(':').slice(1).join(':').trim() : plant || 'Unassigned plant';
const sensorPriority = ['RPM', 'Temperature', 'Motor Temperature', 'Vibration', 'Pressure', 'Coolant Flow', 'Motor Load', 'Motor Power', 'Current', 'Torque', 'Cycle Time', 'Good Parts', 'Scrap Parts', 'Shift Target'];

type ChartPoint = { value: number; timestamp: string };

const estimatePartsPerHour = (history: PersistedSimulatorReading[], sensorName: string) => {
  const byTimestamp = new Map<number, number>();
  for (const reading of history) {
    if (reading.sensor_name.toLowerCase() !== sensorName.toLowerCase()) continue;
    const timestamp = new Date(reading.timestamp).getTime();
    const value = typeof reading.sensor_value === 'number'
      ? reading.sensor_value
      : typeof reading.sensor_value === 'string' && reading.sensor_value.trim() !== ''
        ? Number(reading.sensor_value)
        : Number.NaN;
    if (Number.isFinite(timestamp) && Number.isFinite(value)) byTimestamp.set(timestamp, value);
  }
  const allPoints = Array.from(byTimestamp, ([timestamp, value]) => ({ timestamp, value })).sort((a, b) => a.timestamp - b.timestamp);
  if (allPoints.length < 2) return null;

  const latestTimestamp = allPoints[allPoints.length - 1].timestamp;
  const cutoff = latestTimestamp - 15 * 60 * 1000;
  const points = allPoints.filter((point) => point.timestamp >= cutoff);
  let elapsedMs = 0;
  let producedParts = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const interval = current.timestamp - previous.timestamp;
    const delta = current.value - previous.value;
    // A falling cumulative counter marks a reset; ignore that interval instead of
    // turning the reset into negative production or a misleading hourly rate.
    if (interval <= 0 || delta < 0) continue;
    elapsedMs += interval;
    producedParts += delta;
  }
  if (elapsedMs < 60 * 1000) return null;
  return { partsPerHour: Math.round(producedParts / elapsedMs * 60 * 60 * 1000), minutesObserved: Math.round(elapsedMs / 60000) };
};

const Donut: React.FC<{ segments: Array<{ label: string; value: number; color: string }>; center: string; caption: string }> = ({ segments, center, caption }) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="flex items-center gap-4">
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${caption}: ${segments.filter(segment => segment.value > 0).map(segment => `${segment.label} ${segment.value}`).join(', ') || 'no data'}`} className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        {total > 0 && segments.filter(segment => segment.value > 0).map(segment => {
          const length = segment.value / total * circumference;
          const circle = <circle key={segment.label} cx="50" cy="50" r={radius} fill="none" stroke={segment.color} strokeWidth="12" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />;
          offset += length;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg leading-tight tabular-nums text-slate-900">{center}</strong><span className="text-[9px] text-slate-500">{caption}</span></div>
    </div>
    <div className="min-w-0 flex-1 space-y-1.5">{segments.map(segment => <div key={segment.label} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-2 text-slate-600"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }}/><span className="truncate">{segment.label}</span></span><strong className="tabular-nums text-slate-800">{segment.value}</strong></div>)}</div>
  </div>;
};

const SensorMiniChart: React.FC<{ name: string; unit: string; points: ChartPoint[]; min: number; max: number; type: 'area' | 'line' | 'columns' | 'bullet' }> = ({ name, unit, points, min, max, type }) => {
  const values = points.slice(-10).map(point => point.value);
  const latest = values.at(-1);
  const low = Math.min(...values, min);
  const high = Math.max(...values, max);
  const span = high - low || 1;
  const x = (index: number) => values.length < 2 ? 150 : 12 + index / (values.length - 1) * 276;
  const y = (value: number) => 62 - (value - low) / span * 48;
  const path = values.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
  const range = Math.max(max - min, 1);
  const position = latest === undefined ? 0 : Math.max(0, Math.min(100, (latest - min) / range * 100));
  return <div className="mt-3 h-[76px] rounded-lg bg-slate-50 px-2 py-1.5">
    {values.length > 1 && type !== 'bullet' ? <svg viewBox="0 0 300 72" role="img" aria-label={`${name} ${type} chart for ${values.length} saved readings, in ${unit}`} className="h-full w-full">
      <line x1="8" x2="292" y1="62" y2="62" stroke="#cbd5e1" />
      {type === 'columns' ? values.map((value, index) => { const height = Math.max(3, (value - low) / span * 48); return <rect key={index} x={x(index) - 6} y={62 - height} width="12" height={height} rx="3" fill={index === values.length - 1 ? '#0f766e' : '#7dd3c7'}><title>{`${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`}</title></rect>; }) : <>
        {type === 'area' && <path d={`${path} L ${x(values.length - 1)} 62 L ${x(0)} 62 Z`} fill="#99f6e4" opacity=".6"/>}
        <path d={path} fill="none" stroke={type === 'area' ? '#0f766e' : '#2563eb'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="3.5" fill="#0f766e" />
      </>}
    </svg> : latest !== undefined ? <div className="flex h-full flex-col justify-center">
      <div className="relative h-3 rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-700" style={{ width: `${position}%` }}/><span className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded bg-slate-800" style={{ left: `${position}%` }}/></div>
      <div className="mt-2 flex justify-between text-[9px] text-slate-500"><span>{min} {unit}</span><span>{max} {unit}</span></div>
      <span className="mt-1 text-center text-[9px] text-slate-500">{points.length > 1 ? 'Current vs configured range' : 'One saved reading · history forming'}</span>
    </div> : <div className="flex h-full items-center justify-center text-[10px] text-slate-500">Waiting for saved history</div>}
  </div>;
};

const Card: React.FC<{ title: string; children: React.ReactNode; hint?: string; className?: string; action?: React.ReactNode }> = ({ title, children, hint, className = '', action }) => (
  <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
    <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{hint && <p className="mt-1 text-xs leading-relaxed text-slate-600">{hint}</p>}</div>{action}</div>
    {children}
  </section>
);

const Kpi: React.FC<{ label: string; value: string; note: string; icon: React.ReactNode; tone?: string }> = ({ label, value, note, icon, tone = 'text-cyan-800' }) => (
  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
    <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</span><span className={tone}>{icon}</span></div>
    <div className="mt-2 truncate text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    <p className="mt-1 truncate text-[11px] text-slate-600">{note}</p>
  </section>
);

export const SimulatorFleetTelemetryDashboard: React.FC<SimulatorFleetTelemetryDashboardProps> = ({ user, machines, onReadingsChange }) => {
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [compareBy, setCompareBy] = useState<'plant' | 'machineType'>('plant');
  const [fleetReadings, setFleetReadings] = useState<PersistedSimulatorReading[]>([]);
  const [machineHistory, setMachineHistory] = useState<PersistedSimulatorReading[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedSensor, setSelectedSensor] = useState('');
  const [fleetLoading, setFleetLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const roleMachines = user.role === 'Operator'
    ? machines.filter((machine) => machine.machineCode === user.assignedMachine || machine.code === user.assignedMachine || machine.operatorWorkId === user.workId || machine.assignedOperator === user.fullName)
    : machines;
  const plants = useMemo(() => Array.from(new Set(roleMachines.map((machine) => machine.plant).filter(Boolean))).sort(), [roleMachines]);
  const machineTypes = useMemo(() => Array.from(new Set(roleMachines.map((machine) => machine.machineType).filter(Boolean))).sort(), [roleMachines]);
  const visibleMachines = useMemo(() => roleMachines.filter((machine) =>
    (plantFilter === 'ALL' || machine.plant === plantFilter) && (typeFilter === 'ALL' || machine.machineType === typeFilter)
  ), [roleMachines, plantFilter, typeFilter]);
  const visibleMachineIds = useMemo(() => new Set(visibleMachines.map((machine) => machine.machineId)), [visibleMachines]);
  const visibleReadings = useMemo(() => fleetReadings.filter((reading) => visibleMachineIds.has(reading.machine_id)), [fleetReadings, visibleMachineIds]);
  const sensorNames = useMemo(() => Array.from(new Set(visibleReadings.map((reading) => reading.sensor_name))).sort(), [visibleReadings]);
  const selectedMachine = roleMachines.find((machine) => machine.machineId === selectedMachineId)
    || roleMachines.find((machine) => visibleReadings.some((reading) => reading.machine_id === machine.machineId))
    || roleMachines[0];

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const records = await apiClient.getLatestSimulatorFleetTelemetry();
        if (!cancelled) { setFleetReadings(records); onReadingsChange?.(records); setError(null); }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load saved Simulator telemetry.');
      } finally {
        refreshing = false;
        if (!cancelled) setFleetLoading(false);
      }
    };
    setFleetLoading(true);
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user.workId, user.role, user.assignedMachine, onReadingsChange]);

  useEffect(() => {
    if (!selectedMachine || !visibleMachines.some((machine) => machine.machineId === selectedMachine.machineId)) {
      setSelectedMachineId(visibleMachines.find((machine) => visibleReadings.some((reading) => reading.machine_id === machine.machineId))?.machineId || visibleMachines[0]?.machineId || '');
    }
  }, [selectedMachine, visibleMachines, visibleReadings]);

  useEffect(() => {
    if (!sensorNames.includes(selectedSensor)) setSelectedSensor(sensorNames[0] || '');
  }, [sensorNames, selectedSensor]);

  useEffect(() => {
    if (!selectedMachine?.machineId) { setMachineHistory([]); setHistoryLoading(false); return; }
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const records = await apiClient.getPersistedSimulatorTelemetry(selectedMachine.machineId, user.workId, 1000);
        if (!cancelled) { setMachineHistory(records); setHistoryError(null); }
      } catch (caught) {
        if (!cancelled) setHistoryError(caught instanceof Error ? caught.message : 'Could not load machine history.');
      } finally {
        refreshing = false;
        if (!cancelled) setHistoryLoading(false);
      }
    };
    setHistoryLoading(true);
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selectedMachine?.machineId, user.workId]);

  const latestByMachine = useMemo(() => {
    const latest = new Map<string, PersistedSimulatorReading>();
    for (const record of visibleReadings) {
      const prior = latest.get(record.machine_id);
      if (!prior || new Date(record.timestamp).getTime() > new Date(prior.timestamp).getTime()) latest.set(record.machine_id, record);
    }
    return Array.from(latest.values());
  }, [visibleReadings]);
  const reportingCount = latestByMachine.length;
  const statusCounts = useMemo(() => ({
    normal: latestByMachine.filter((reading) => reading.machine_status === 'NORMAL').length,
    idle: latestByMachine.filter((reading) => reading.machine_status === 'IDLE').length,
    warning: latestByMachine.filter((reading) => reading.machine_status === 'WARNING').length,
    critical: latestByMachine.filter((reading) => reading.machine_status === 'CRITICAL').length,
    stopped: latestByMachine.filter((reading) => reading.machine_status === 'STOPPED' || reading.machine_status === 'MAINTENANCE').length,
  }), [latestByMachine]);
  const latestTime = visibleReadings.reduce<string | undefined>((latest, reading) => !latest || new Date(reading.timestamp).getTime() > new Date(latest).getTime() ? reading.timestamp : latest, undefined);
  const selectedCurrent = visibleReadings.filter((reading) => reading.machine_id === selectedMachine?.machineId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const selectedHistory = machineHistory.filter((reading) => reading.sensor_name === selectedSensor).slice().reverse();
  const observedProductionRate = useMemo(() => estimatePartsPerHour(machineHistory, 'Good Parts'), [machineHistory]);
  const numericHistory = selectedHistory.filter((reading): reading is PersistedSimulatorReading & { sensor_value: number } => typeof reading.sensor_value === 'number' && Number.isFinite(reading.sensor_value));
  const currentSensorReading = selectedCurrent.find((reading) => reading.sensor_name === selectedSensor)
    || selectedHistory.find((reading) => reading.sensor_name === selectedSensor);
  const selectedBounds = currentSensorReading;

  const comparisonRows = useMemo(() => {
    const byGroup = new Map<string, { machine: Machine; value: number }[]>();
    const machinesById = new Map(roleMachines.map((machine) => [machine.machineId, machine]));
    for (const record of visibleReadings) {
      if (record.sensor_name !== selectedSensor || typeof record.sensor_value !== 'number' || !Number.isFinite(record.sensor_value)) continue;
      const machine = machinesById.get(record.machine_id);
      if (!machine) continue;
      const name = compareBy === 'plant' ? machine.plant : machine.machineType;
      const values = byGroup.get(name) || [];
      values.push({ machine, value: record.sensor_value });
      byGroup.set(name, values);
    }
    return Array.from(byGroup.entries()).map(([name, values]) => ({
      name: compareBy === 'plant' ? toPlantLabel(name) : name,
      mean: values.reduce((sum, row) => sum + row.value, 0) / values.length,
      machines: values.length,
    })).sort((a, b) => b.mean - a.mean);
  }, [compareBy, roleMachines, selectedSensor, visibleReadings]);

  const chartWidth = 720;
  const chartHeight = 230;
  const chartPadding = { left: 54, right: 18, top: 18, bottom: 32 };
  const vals = numericHistory.map((reading) => reading.sensor_value);
  const rawMin = Math.min(...vals, ...(selectedBounds ? [selectedBounds.expected_min] : []));
  const rawMax = Math.max(...vals, ...(selectedBounds ? [selectedBounds.expected_max] : []));
  const rangePadding = rawMax > rawMin ? (rawMax - rawMin) * 0.12 : Math.max(Math.abs(rawMax) * 0.08, 1);
  const minY = Math.max(0, rawMin - rangePadding);
  const maxY = rawMax + rangePadding;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartX = (index: number) => chartPadding.left + (numericHistory.length < 2 ? plotWidth / 2 : (index / (numericHistory.length - 1)) * plotWidth);
  const chartY = (value: number) => chartPadding.top + ((maxY - value) / (maxY - minY || 1)) * plotHeight;
  const trendPath = numericHistory.map((reading, index) => `${index ? 'L' : 'M'} ${chartX(index)} ${chartY(reading.sensor_value)}`).join(' ');
  const lastReading = numericHistory[numericHistory.length - 1];
  const selectedMachineCount = visibleMachines.length;
  const maxComparison = Math.max(...comparisonRows.map((row) => row.mean), 1);
  const isFresh = Boolean(latestTime && Date.now() - new Date(latestTime).getTime() < 30000);
  const sourceState = error ? 'UNAVAILABLE' : fleetLoading && fleetReadings.length === 0 ? 'CONNECTING' : fleetReadings.length ? isFresh ? 'LIVE · MYSQL' : 'SAVED DATA · STREAM IDLE' : 'WAITING FOR READINGS';
  const signalChartTypes: Record<string, 'area' | 'line' | 'columns' | 'bullet'> = {
    'temperature': 'area', 'motor temperature': 'area', 'vibration': 'line', pressure: 'line',
    rpm: 'columns', 'cycle time': 'columns', 'motor load': 'bullet', current: 'bullet',
    'motor power': 'area', torque: 'area', 'coolant flow': 'line',
  };
  const signalCharts = selectedCurrent
    .filter((reading) => typeof reading.sensor_value === 'number' && signalChartTypes[reading.sensor_name.toLowerCase()])
    .sort((a, b) => sensorPriority.indexOf(a.sensor_name) - sensorPriority.indexOf(b.sensor_name))
    .map((reading) => ({
      reading,
      points: machineHistory.filter((point) => point.sensor_name === reading.sensor_name && typeof point.sensor_value === 'number')
        .slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((point) => ({ value: point.sensor_value as number, timestamp: point.timestamp })),
    }));

  return <div className="space-y-4">
    <Card title="Live machine telemetry" hint="Simulator readings saved in FactoryPulse MySQL · current values refresh every second; detailed history refreshes every two seconds." className="border-slate-200">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${fleetReadings.length && !error ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-slate-700'}`}><Radio className="h-3.5 w-3.5"/>{sourceState}</span>
          <span className="text-slate-600">Latest saved reading: {formatTime(latestTime)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role !== 'Operator' && <>
            <label className="sr-only" htmlFor="simulator-plant-filter">Plant filter</label>
            <select id="simulator-plant-filter" value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} className="max-w-[250px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="ALL">All plants</option>{plants.map((plant) => <option key={plant} value={plant}>{plant}</option>)}</select>
            <label className="sr-only" htmlFor="simulator-type-filter">Machine type filter</label>
            <select id="simulator-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="max-w-[270px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="ALL">All machine types</option>{machineTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <label className="sr-only" htmlFor="simulator-machine-select">Machine for detailed trend</label>
            <select id="simulator-machine-select" value={selectedMachine?.machineId || ''} onChange={(event) => setSelectedMachineId(event.target.value)} className="max-w-[320px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="">Select a machine</option>{visibleMachines.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machine.machineId} · {machine.machineCode}</option>)}</select>
          </>}
          {user.role === 'Operator' && selectedMachine && <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800">Assigned: {selectedMachine.machineId} · {selectedMachine.machineCode}</span>}
        </div>
      </div>
      {error && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">Saved Simulator telemetry unavailable: {error}. Check that FactoryPulse API and MySQL are running.</p>}
      {user.role === 'Operator' && roleMachines.length === 0 && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-slate-700">No machine in the roster matches your assigned machine <strong>{user.assignedMachine || 'not assigned'}</strong>. Ask an Admin to check the account assignment and machine registry.</p>}
      {!error && !fleetLoading && fleetReadings.length === 0 && !(user.role === 'Operator' && roleMachines.length === 0) && <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-100 p-3 text-xs text-slate-700">No AI Simulator readings are available for this view yet. When a reading is stored for the selected machine, it will appear here.</p>}
    </Card>

    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <Kpi label="Machines reporting" value={`${reportingCount} / ${selectedMachineCount}`} note="Machines with a saved Simulator reading" icon={<Cpu className="h-4 w-4"/>}/>
      <Kpi label="Latest sensor streams" value={String(visibleReadings.length)} note="One newest saved value per machine and sensor" icon={<Activity className="h-4 w-4"/>} tone="text-slate-700"/>
      <Kpi label="Need attention" value={String(statusCounts.warning + statusCounts.critical)} note={`${statusCounts.critical} critical · ${statusCounts.warning} warning`} icon={<AlertTriangle className="h-4 w-4"/>} tone={statusCounts.critical ? 'text-rose-800' : statusCounts.warning ? 'text-amber-800' : 'text-emerald-800'}/>
      <Kpi label="Good quality" value={visibleReadings.length ? `${Math.round(visibleReadings.filter((reading) => reading.data_quality === 'GOOD').length / visibleReadings.length * 100)}%` : '—'} note="Of latest stored sensor readings" icon={<Gauge className="h-4 w-4"/>} tone="text-teal-800"/>
    </div>

    <Card title={`${selectedMachine?.machineCode || 'Machine'} · signal gallery`} hint="Each signal uses a chart suited to its shape: pressure and temperature trends, RPM and cycle-time columns, and range bullets for load and current. Charts use saved history only.">
      {signalCharts.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {signalCharts.map(({ reading, points }) => {
          const chartType = signalChartTypes[reading.sensor_name.toLowerCase()];
          const latest = reading.sensor_value as number;
          const outside = latest < reading.expected_min || latest > reading.expected_max;
          return <button key={reading.sensor_name} type="button" onClick={() => setSelectedSensor(reading.sensor_name)} aria-pressed={selectedSensor === reading.sensor_name} className={`min-w-0 rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedSensor === reading.sensor_name ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{reading.sensor_name}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{formatValue(latest, reading.sensor_unit)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${outside ? 'bg-amber-100 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>{outside ? 'Out of range' : 'In range'}</span></div>
            <SensorMiniChart name={reading.sensor_name} unit={reading.sensor_unit} points={points} min={reading.expected_min} max={reading.expected_max} type={chartType}/>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span className="capitalize">{points.length < 2 ? 'Range position · history forming' : chartType === 'columns' ? 'Recent samples' : chartType === 'bullet' ? 'Range position' : `${chartType} trend`}</span><span className="truncate">{points.length ? `${points.length} saved points` : 'Current reading only'}</span></div>
          </button>;
        })}
      </div> : <p className="py-8 text-center text-xs text-slate-600">Signal charts appear after numeric Simulator readings are saved.</p>}
    </Card>

    {(() => {
      const findValue = (name: string) => selectedCurrent.find((reading) => reading.sensor_name.toLowerCase() === name.toLowerCase() && typeof reading.sensor_value === 'number');
      const good = findValue('Good Parts'); const scrap = findValue('Scrap Parts'); const target = findValue('Shift Target');
      if (!good && !scrap && !target) return null;
      const goodValue = Number(good?.sensor_value ?? 0); const scrapValue = Number(scrap?.sensor_value ?? 0); const targetValue = Number(target?.sensor_value ?? 0);
      const progress = targetValue > 0 ? Math.min(100, (goodValue + scrapValue) / targetValue * 100) : 0;
      return <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-teal-50 p-4 shadow-sm sm:p-5" aria-label="Simulator production practice model">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800">Production progress · Simulator model</p><h2 className="mt-1 text-base font-semibold text-slate-900">Shift output against target</h2><p className="mt-1 text-xs text-slate-600">Training counters emitted by the Simulator; these are not verified factory production totals.</p></div><span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">{targetValue > 0 ? `${progress.toFixed(0)}% of target` : 'Target unavailable'}</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] md:items-center">
          <div>
            <div className="flex justify-between text-xs"><span className="font-medium text-slate-700">{(goodValue + scrapValue).toLocaleString()} of {targetValue.toLocaleString()} parts</span><span className="text-slate-500">{Math.max(0, targetValue - goodValue - scrapValue).toLocaleString()} remaining</span></div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-[11px] text-slate-500">Progress to the Simulator practice target</p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-3 sm:items-center">
            <Donut segments={[{ label: 'Good', value: goodValue, color: '#0f766e' }, { label: 'Scrap', value: scrapValue, color: '#f59e0b' }]} center={`${(goodValue + scrapValue).toLocaleString()}`} caption="parts"/>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Average observed rate</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{observedProductionRate ? observedProductionRate.partsPerHour.toLocaleString() : 'Collecting history'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{observedProductionRate ? `parts/hour · ${observedProductionRate.minutesObserved} min of saved Good Parts readings` : 'Needs at least 1 minute of saved Good Parts history'}</p>
              <p className="mt-1 text-[10px] text-slate-500">Simulator model average; not verified plant output.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cycle time</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{findValue('Cycle Time') ? formatValue(findValue('Cycle Time')!.sensor_value, findValue('Cycle Time')!.sensor_unit) : '—'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{findValue('Target Cycle Time') ? `Target ${formatValue(findValue('Target Cycle Time')!.sensor_value, findValue('Target Cycle Time')!.sensor_unit)}` : 'No target reading saved'}</p>
            </div>
          </div>
        </div>
      </section>;
    })()}

    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
      <Card title="Machine status from latest readings" hint="Each reporting machine is counted once using its most recently received sensor status." className="xl:col-span-4">
        {reportingCount ? <>
          <Donut segments={[{ label: 'Normal', value: statusCounts.normal, color: '#0f9f79' }, { label: 'Idle', value: statusCounts.idle, color: '#94a3b8' }, { label: 'Warning', value: statusCounts.warning, color: '#f59e0b' }, { label: 'Critical', value: statusCounts.critical, color: '#e11d48' }, { label: 'Stopped / maintenance', value: statusCounts.stopped, color: '#475569' }]} center={String(reportingCount)} caption="machines" />
        </> : <p className="py-8 text-center text-xs text-slate-600">Status will appear after Simulator readings are stored.</p>}
      </Card>

      <Card title={`Latest ${selectedSensor || 'sensor'} by ${compareBy === 'plant' ? 'plant' : 'machine type'}`} hint="Bars compare the mean of each group's newest numeric readings. Only machines with saved values for this sensor are included." className="xl:col-span-8" action={<div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="simulator-sensor-select">Sensor</label><select id="simulator-sensor-select" value={selectedSensor} onChange={(event) => setSelectedSensor(event.target.value)} className="max-w-[200px] rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-800" disabled={!sensorNames.length}><option value="">No sensor data</option>{sensorNames.map((sensor) => <option key={sensor} value={sensor}>{sensor}</option>)}</select>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"><button onClick={() => setCompareBy('plant')} className={`rounded px-2 py-1 text-[11px] ${compareBy === 'plant' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}>Plant</button><button onClick={() => setCompareBy('machineType')} className={`rounded px-2 py-1 text-[11px] ${compareBy === 'machineType' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}>Type</button></div>
      </div>}>
        {comparisonRows.length ? <>
          <div className="mt-4 overflow-x-auto rounded-lg bg-gradient-to-b from-slate-50 to-white px-2 pt-3">
            <svg viewBox="0 0 720 250" role="img" aria-label={`Bar chart of latest ${selectedSensor} snapshots by ${compareBy === 'plant' ? 'plant' : 'machine type'}`} className="h-[245px] min-w-[560px] w-full">
              <defs><linearGradient id="plantBars" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6"/><stop offset="100%" stopColor="#0f766e"/></linearGradient></defs>
              {[0, 1, 2, 3].map((tick) => { const y = 190 - tick * 52; const value = maxComparison * tick / 3; return <g key={tick}><line x1="58" x2="704" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={tick === 0 ? '0' : '4 5'}/><text x="48" y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</text></g>; })}
              {comparisonRows.map((row, index) => {
                const slot = 646 / comparisonRows.length; const width = Math.min(48, slot * 0.54); const x = 58 + index * slot + (slot - width) / 2; const height = row.mean / maxComparison * 156; const label = row.name.length > 13 ? `${row.name.slice(0, 12)}…` : row.name;
                return <g key={row.name}><rect x={x} y={190 - height} width={width} height={height} rx="6" fill="url(#plantBars)"><title>{`${row.name}: ${formatValue(row.mean, visibleReadings.find((record) => record.sensor_name === selectedSensor)?.sensor_unit || '')} · ${row.machines} machines`}</title></rect><circle cx={x + width / 2} cy={190 - height} r="3" fill="#0f766e"/><text x={x + width / 2} y="210" textAnchor="middle" fontSize="10" fill="#475569">{label}</text><text x={x + width / 2} y={Math.max(24, 190 - height - 10)} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f172a">{row.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })}</text><text x={x + width / 2} y="229" textAnchor="middle" fontSize="9" fill="#94a3b8">{row.machines} machine{row.machines === 1 ? '' : 's'}</text></g>;
              })}
              <text x="58" y="15" fontSize="10" fill="#64748b">Mean {selectedSensor} · {visibleReadings.find((record) => record.sensor_name === selectedSensor)?.sensor_unit || ''}</text>
            </svg>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Each bar uses the average of the latest saved value per reporting machine in that group. This compares snapshots; it is not a historical plant trend.</p>
        </> : <p className="py-8 text-center text-xs text-slate-600">No numeric {selectedSensor || 'sensor'} readings in this selection yet.</p>}
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
      <Card title={`${selectedMachine?.machineCode || 'Machine'} · ${selectedSensor || 'sensor'} history`} hint="A true trend uses saved readings for this machine and sensor, ordered by their recorded timestamps. No synthetic points are added." className="xl:col-span-8" action={<span className="text-[11px] text-slate-600">{selectedMachine?.displayName || selectedMachine?.name || 'Select a machine'}</span>}>
        {historyError && <p className="mb-2 text-xs text-amber-800">History refresh warning: {historyError}</p>}
        {historyLoading && !machineHistory.length ? <p className="py-10 text-center text-xs text-slate-600">Loading saved machine history…</p>
          : !selectedSensor ? <p className="py-10 text-center text-xs text-slate-600">Select a sensor after its first reading arrives.</p>
            : !numericHistory.length ? <p className="py-10 text-center text-xs text-slate-600">No numeric history for {selectedSensor}. The latest raw value is shown in the sensor list.</p>
              : <>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><span className="text-2xl font-semibold tabular-nums text-slate-900">{formatValue(currentSensorReading?.sensor_value ?? lastReading.sensor_value, currentSensorReading?.sensor_unit || lastReading.sensor_unit)}</span><span className="ml-2 text-xs text-slate-600">{currentSensorReading?.machine_status || lastReading.machine_status} · {currentSensorReading?.data_quality || lastReading.data_quality}</span></div><span className="text-[11px] text-slate-600">{numericHistory.length} numeric saved point{numericHistory.length === 1 ? '' : 's'}</span></div>
                <div className="h-[230px] w-full overflow-hidden rounded-lg bg-slate-100/70">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${selectedSensor} telemetry history for ${selectedMachine?.machineCode}`} className="h-full w-full">
                    {[0, 1, 2, 3].map((tick) => { const value = maxY - tick / 3 * (maxY - minY); const y = chartPadding.top + tick / 3 * plotHeight; return <g key={tick}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="3 5"/><text x={chartPadding.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>; })}
                    {selectedBounds && [selectedBounds.expected_min, selectedBounds.expected_max].map((bound, index) => <g key={index}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={chartY(bound)} y2={chartY(bound)} stroke="#f59e0b" strokeDasharray="6 4" opacity=".75"/><text x={chartWidth - chartPadding.right - 2} y={chartY(bound) - 4} textAnchor="end" fill="#fbbf24" fontSize="9">Simulator expected {index === 0 ? 'min' : 'max'} {bound} {currentSensorReading?.sensor_unit}</text></g>)}
                    {numericHistory.length > 1 && <path d={trendPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
                    {numericHistory.map((reading, index) => <circle key={reading.reading_id} cx={chartX(index)} cy={chartY(reading.sensor_value)} r={index === numericHistory.length - 1 ? 5 : 3} fill={reading.data_quality === 'GOOD' ? '#22d3ee' : '#f59e0b'} stroke="#ffffff" strokeWidth="2"><title>{`${formatTime(reading.timestamp)} · ${reading.sensor_value} ${reading.sensor_unit} · ${reading.data_quality}`}</title></circle>)}
                    <text x={chartPadding.left} y={chartHeight - 8} fill="#64748b" fontSize="10">{formatTime(numericHistory[0]?.timestamp)}</text><text x={chartWidth - chartPadding.right} y={chartHeight - 8} fill="#64748b" fontSize="10" textAnchor="end">{formatTime(lastReading?.timestamp)}</text>
                  </svg>
                </div>
                {numericHistory.length === 1 && <p className="mt-2 text-xs text-slate-700">One saved point is available. A line trend will appear after a second reading is stored.</p>}
                {selectedBounds && <p className="mt-2 text-[11px] text-slate-600">Dashed lines are the Simulator record’s expected range ({selectedBounds.expected_min}–{selectedBounds.expected_max} {selectedBounds.sensor_unit}); they are not FactoryPulse safety limits.</p>}
              </>}
      </Card>

      <Card title="Latest readings · selected machine" hint="Raw sensor names, values, units, status and quality from MySQL." className="xl:col-span-4">
        {selectedCurrent.length ? <div className="max-h-[310px] space-y-2 overflow-y-auto">{selectedCurrent.map((reading) => <button key={reading.reading_id} onClick={() => setSelectedSensor(reading.sensor_name)} className={`w-full rounded-lg border p-3 text-left transition ${selectedSensor === reading.sensor_name ? 'border-slate-200 bg-cyan-50' : 'border-slate-200 bg-slate-100/50 hover:border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{reading.sensor_name}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${reading.machine_status === 'CRITICAL' ? 'bg-rose-50 text-rose-800' : reading.machine_status === 'WARNING' ? 'bg-amber-50 text-amber-800' : reading.machine_status === 'NORMAL' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{reading.machine_status}</span></div>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-700">{formatValue(reading.sensor_value, reading.sensor_unit)}</p>
          <p className="mt-1 text-[10px] text-slate-500">{formatTime(reading.timestamp)} · {reading.data_quality}{reading.fault_mode ? ` · ${reading.fault_mode}` : ''}</p>
        </button>)}</div> : <p className="py-8 text-center text-xs text-slate-600">No saved readings for this machine yet.</p>}
      </Card>
    </div>

    <OperationalInsights machineId={selectedMachine?.machineId} isAdmin={user.role === 'Admin'}/>
    <Card title="Simulator signal map" hint="Latest saved values for the selected machine. Choose a signal to open its timestamped trend.">
      <div className="space-y-4">
        {[
          { title: 'Machine sensors', note: 'Simulator-generated sensor channels', icon: <Activity className="h-4 w-4"/>, signals: [['RPM', 'rpm'], ['Vibration', 'mm/s'], ['Temperature', '°C'], ['Motor Temperature', '°C'], ['Pressure', 'bar'], ['Coolant Flow', 'L/min'], ['Torque', 'Nm'], ['Current', 'A']] },
          { title: 'Derived indicators', note: 'Calculated by the Simulator; not direct meter readings', icon: <Zap className="h-4 w-4"/>, signals: [['Motor Power', 'kW'], ['Motor Load', '%']] },
          { title: 'Production practice model', note: 'Training counters and targets; not verified factory production', icon: <Gauge className="h-4 w-4"/>, signals: [['Good Parts', 'parts'], ['Scrap Parts', 'parts'], ['Shift Target', 'parts'], ['Cycle Time', 's/cycle'], ['Target Cycle Time', 's/cycle']] },
        ].map((group) => <div key={group.title}>
          <div className="mb-2 flex items-center gap-2"><span className="text-cyan-800">{group.icon}</span><div><h3 className="text-xs font-semibold text-slate-800">{group.title}</h3><p className="text-[10px] text-slate-500">{group.note}</p></div></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{group.signals.map(([name, unit]) => {
            const reading = selectedCurrent.find((row) => row.sensor_name.toLowerCase() === name.toLowerCase());
            return <button key={name} type="button" disabled={!reading} onClick={() => reading && setSelectedSensor(reading.sensor_name)} className={`rounded-lg border p-3 text-left transition ${reading ? selectedSensor === reading.sensor_name ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white hover:border-cyan-200' : 'cursor-default border-slate-200 bg-slate-50/70'}`}>
              <span className="block text-[11px] font-semibold text-slate-700">{name}</span>
              <span className={`mt-1 block truncate font-mono text-base font-semibold tabular-nums ${reading ? 'text-slate-900' : 'text-slate-400'}`}>{reading ? formatValue(reading.sensor_value, reading.sensor_unit || unit) : '—'}</span>
              <span className="mt-1 block text-[10px] text-slate-500">{reading ? `${reading.data_quality} · ${formatTime(reading.timestamp)}` : 'Waiting for saved reading'}</span>
            </button>;
          })}</div>
        </div>)}
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Motor Power is a shaft-power estimate derived from torque and RPM, not electrical energy. Motor Load is a torque-range proxy, not a VFD measurement. The current Simulator does not emit coolant temperature or kWh energy consumption, so those stay unavailable.</p>
    </Card>
  </div>;
};
