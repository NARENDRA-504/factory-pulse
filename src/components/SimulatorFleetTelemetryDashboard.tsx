import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Gauge, Radio, Thermometer, Wrench, Zap } from 'lucide-react';
import { Machine, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';
import { OperationalInsights } from './OperationalInsights';

interface SimulatorFleetTelemetryDashboardProps {
  user: UserProfile;
  machines: Machine[];
}

const formatValue = (value: number | string | null, unit: string) => {
  const shown = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value ?? '—';
  return `${shown}${shown === '—' || shown === null || shown === '' ? '' : ` ${unit}`}`;
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : 'No Simulator readings yet';
const toPlantLabel = (plant?: string) => plant?.includes(':') ? plant.split(':').slice(1).join(':').trim() : plant || 'Unassigned plant';

const Card: React.FC<{ title: string; children: React.ReactNode; hint?: string; className?: string; action?: React.ReactNode }> = ({ title, children, hint, className = '', action }) => (
  <section className={`min-w-0 rounded-xl border border-slate-800 bg-[#0c1424] p-4 shadow-sm sm:p-5 ${className}`}>
    <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">{title}</h2>{hint && <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p>}</div>{action}</div>
    {children}
  </section>
);

const Kpi: React.FC<{ label: string; value: string; note: string; icon: React.ReactNode; tone?: string }> = ({ label, value, note, icon, tone = 'text-cyan-300' }) => (
  <section className="min-w-0 rounded-xl border border-slate-800 bg-[#0c1424] p-3.5 sm:p-4">
    <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span><span className={tone}>{icon}</span></div>
    <div className="mt-2 truncate text-2xl font-semibold tabular-nums text-slate-100">{value}</div>
    <p className="mt-1 truncate text-[11px] text-slate-400">{note}</p>
  </section>
);

export const SimulatorFleetTelemetryDashboard: React.FC<SimulatorFleetTelemetryDashboardProps> = ({ user, machines }) => {
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
        if (!cancelled) { setFleetReadings(records); setError(null); }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load saved Simulator telemetry.');
      } finally {
        refreshing = false;
        if (!cancelled) setFleetLoading(false);
      }
    };
    setFleetLoading(true);
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user.workId, user.role, user.assignedMachine]);

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
    const timer = window.setInterval(refresh, 3000);
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
    warning: latestByMachine.filter((reading) => reading.machine_status === 'WARNING').length,
    critical: latestByMachine.filter((reading) => reading.machine_status === 'CRITICAL').length,
    stopped: latestByMachine.filter((reading) => reading.machine_status === 'STOPPED' || reading.machine_status === 'MAINTENANCE').length,
  }), [latestByMachine]);
  const latestTime = visibleReadings.reduce<string | undefined>((latest, reading) => !latest || new Date(reading.timestamp).getTime() > new Date(latest).getTime() ? reading.timestamp : latest, undefined);
  const selectedCurrent = visibleReadings.filter((reading) => reading.machine_id === selectedMachine?.machineId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const selectedHistory = machineHistory.filter((reading) => reading.sensor_name === selectedSensor).slice().reverse();
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

  return <div className="space-y-4">
    <Card title="Live machine telemetry" hint="Simulator readings saved in FactoryPulse MySQL · refreshes every 3 seconds." className="border-cyan-900/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${fleetReadings.length && !error ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-amber-800 bg-amber-950/30 text-amber-200'}`}><Radio className="h-3.5 w-3.5"/>{sourceState}</span>
          <span className="text-slate-400">Latest saved reading: {formatTime(latestTime)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role !== 'Operator' && <>
            <label className="sr-only" htmlFor="simulator-plant-filter">Plant filter</label>
            <select id="simulator-plant-filter" value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} className="max-w-[250px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ALL">All plants</option>{plants.map((plant) => <option key={plant} value={plant}>{plant}</option>)}</select>
            <label className="sr-only" htmlFor="simulator-type-filter">Machine type filter</label>
            <select id="simulator-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="max-w-[270px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ALL">All machine types</option>{machineTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <label className="sr-only" htmlFor="simulator-machine-select">Machine for detailed trend</label>
            <select id="simulator-machine-select" value={selectedMachine?.machineId || ''} onChange={(event) => setSelectedMachineId(event.target.value)} className="max-w-[320px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="">Select a machine</option>{visibleMachines.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machine.machineId} · {machine.machineCode}</option>)}</select>
          </>}
          {user.role === 'Operator' && selectedMachine && <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">Assigned: {selectedMachine.machineId} · {selectedMachine.machineCode}</span>}
        </div>
      </div>
      {error && <p role="status" className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">Saved Simulator telemetry unavailable: {error}. Check that FactoryPulse API and MySQL are running.</p>}
      {user.role === 'Operator' && roleMachines.length === 0 && <p role="status" className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-200">This account is assigned to <strong>{user.assignedMachine || 'no machine'}</strong>, which does not match the incoming Simulator stream <strong>MCH-001 / CNC-5AX-001</strong>. An Admin can update the assignment if this stream belongs at this workstation.</p>}
      {!error && !fleetLoading && fleetReadings.length === 0 && !(user.role === 'Operator' && roleMachines.length === 0) && <p className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">No AI Simulator readings are available for this view yet. When a reading is stored for the selected machine, it will appear here.</p>}
    </Card>

    {selectedCurrent.length > 0 && <section aria-label="Current machine sensor meters" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {selectedCurrent.filter(reading => typeof reading.sensor_value === 'number').map(reading => {
        const value = reading.sensor_value as number;
        const scale = Math.max(reading.expected_max * 1.2, value, 1);
        const fraction = Math.max(0, Math.min(value / scale, 1));
        const outside = value < reading.expected_min || value > reading.expected_max;
        const color = reading.machine_status === 'CRITICAL' ? '#fb7185' : outside ? '#fbbf24' : '#2dd4bf';
        return <button key={reading.sensor_name} onClick={() => setSelectedSensor(reading.sensor_name)} className={`min-w-0 rounded-xl border bg-[#0c1424] p-3 text-left ${selectedSensor === reading.sensor_name ? 'border-cyan-700' : 'border-slate-800'}`}>
          <h2 className="truncate text-xs font-semibold text-slate-300">{reading.sensor_name}</h2>
          <svg viewBox="0 0 160 100" role="img" aria-label={`${reading.sensor_name}: ${formatValue(value, reading.sensor_unit)}`} className="mx-auto mt-2 w-full max-w-[180px]">
            <path d="M 15 80 A 65 65 0 0 1 145 80" pathLength="100" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round"/>
            <path d="M 15 80 A 65 65 0 0 1 145 80" pathLength="100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${fraction * 100} 100`}/>
            <text x="80" y="70" textAnchor="middle" fill="#f1f5f9" fontSize="21" fontWeight="600">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text>
            <text x="80" y="91" textAnchor="middle" fill="#94a3b8" fontSize="11">{reading.sensor_unit}</text>
          </svg>
          <p className="text-[10px]" style={{ color }}>{outside ? 'Outside expected range' : 'Within expected range'}</p>
          <p className="mt-1 text-[10px] text-slate-500">Expected {reading.expected_min}–{reading.expected_max} {reading.sensor_unit}</p>
        </button>;
      })}
    </section>}

    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <Kpi label="Machines reporting" value={`${reportingCount} / ${selectedMachineCount}`} note="Machines with a saved Simulator reading" icon={<Cpu className="h-4 w-4"/>}/>
      <Kpi label="Latest sensor streams" value={String(visibleReadings.length)} note="One newest saved value per machine and sensor" icon={<Activity className="h-4 w-4"/>} tone="text-sky-300"/>
      <Kpi label="Need attention" value={String(statusCounts.warning + statusCounts.critical)} note={`${statusCounts.critical} critical · ${statusCounts.warning} warning`} icon={<AlertTriangle className="h-4 w-4"/>} tone={statusCounts.critical ? 'text-rose-300' : statusCounts.warning ? 'text-amber-300' : 'text-emerald-300'}/>
      <Kpi label="Good quality" value={visibleReadings.length ? `${Math.round(visibleReadings.filter((reading) => reading.data_quality === 'GOOD').length / visibleReadings.length * 100)}%` : '—'} note="Of latest stored sensor readings" icon={<Gauge className="h-4 w-4"/>} tone="text-teal-300"/>
    </div>

    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
      <Card title="Machine status from latest readings" hint="Each reporting machine is counted once using its most recently received sensor status." className="xl:col-span-4">
        {reportingCount ? <>
          <div className="flex h-4 overflow-hidden rounded-full bg-slate-800" aria-label="Latest Simulator machine status breakdown">
            {[['NORMAL', statusCounts.normal, '#10b981'], ['WARNING', statusCounts.warning, '#f59e0b'], ['CRITICAL', statusCounts.critical, '#f43f5e'], ['STOPPED / MAINTENANCE', statusCounts.stopped, '#64748b']].map(([label, count, color]) => Number(count) ? <span key={String(label)} title={`${label}: ${count}`} style={{ width: `${Number(count) / reportingCount * 100}%`, backgroundColor: String(color) }}/> : null)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">{[['Normal', statusCounts.normal, 'text-emerald-300'], ['Warning', statusCounts.warning, 'text-amber-300'], ['Critical', statusCounts.critical, 'text-rose-300'], ['Stopped / Maintenance', statusCounts.stopped, 'text-slate-300']].map(([label, count, tone]) => <div key={String(label)} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2"><span className={String(tone)}>{label}</span><strong className="tabular-nums text-slate-100">{count}</strong></div>)}</div>
        </> : <p className="py-8 text-center text-xs text-slate-400">Status will appear after Simulator readings are stored.</p>}
      </Card>

      <Card title={`Latest ${selectedSensor || 'sensor'} by ${compareBy === 'plant' ? 'plant' : 'machine type'}`} hint="Bars compare the mean of each group's newest numeric readings. Only machines with saved values for this sensor are included." className="xl:col-span-8" action={<div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="simulator-sensor-select">Sensor</label><select id="simulator-sensor-select" value={selectedSensor} onChange={(event) => setSelectedSensor(event.target.value)} className="max-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200" disabled={!sensorNames.length}><option value="">No sensor data</option>{sensorNames.map((sensor) => <option key={sensor} value={sensor}>{sensor}</option>)}</select>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5"><button onClick={() => setCompareBy('plant')} className={`rounded px-2 py-1 text-[11px] ${compareBy === 'plant' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Plant</button><button onClick={() => setCompareBy('machineType')} className={`rounded px-2 py-1 text-[11px] ${compareBy === 'machineType' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Type</button></div>
      </div>}>
        {comparisonRows.length ? <div className="space-y-3">{comparisonRows.map((row) => <div key={row.name}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">{row.name}</span><span className="shrink-0 font-semibold tabular-nums text-slate-100">{formatValue(row.mean, visibleReadings.find((record) => record.sensor_name === selectedSensor)?.sensor_unit || '')}<span className="ml-2 text-[10px] font-normal text-slate-500">{row.machines} machines</span></span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(1, row.mean / maxComparison * 100)}%` }}/></div>
        </div>)}</div> : <p className="py-8 text-center text-xs text-slate-400">No numeric {selectedSensor || 'sensor'} readings in this selection yet.</p>}
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
      <Card title={`${selectedMachine?.machineCode || 'Machine'} · ${selectedSensor || 'sensor'} history`} hint="A true trend uses saved readings for this machine and sensor, ordered by their recorded timestamps. No synthetic points are added." className="xl:col-span-8" action={<span className="text-[11px] text-slate-400">{selectedMachine?.displayName || selectedMachine?.name || 'Select a machine'}</span>}>
        {historyError && <p className="mb-2 text-xs text-amber-300">History refresh warning: {historyError}</p>}
        {historyLoading && !machineHistory.length ? <p className="py-10 text-center text-xs text-slate-400">Loading saved machine history…</p>
          : !selectedSensor ? <p className="py-10 text-center text-xs text-slate-400">Select a sensor after its first reading arrives.</p>
            : !numericHistory.length ? <p className="py-10 text-center text-xs text-slate-400">No numeric history for {selectedSensor}. The latest raw value is shown in the sensor list.</p>
              : <>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><span className="text-2xl font-semibold tabular-nums text-slate-100">{formatValue(currentSensorReading?.sensor_value ?? lastReading.sensor_value, currentSensorReading?.sensor_unit || lastReading.sensor_unit)}</span><span className="ml-2 text-xs text-slate-400">{currentSensorReading?.machine_status || lastReading.machine_status} · {currentSensorReading?.data_quality || lastReading.data_quality}</span></div><span className="text-[11px] text-slate-400">{numericHistory.length} numeric saved point{numericHistory.length === 1 ? '' : 's'}</span></div>
                <div className="h-[230px] w-full overflow-hidden rounded-lg bg-slate-950/70">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${selectedSensor} telemetry history for ${selectedMachine?.machineCode}`} className="h-full w-full">
                    {[0, 1, 2, 3].map((tick) => { const value = maxY - tick / 3 * (maxY - minY); const y = chartPadding.top + tick / 3 * plotHeight; return <g key={tick}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#334155" strokeDasharray="3 5"/><text x={chartPadding.left - 8} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>; })}
                    {selectedBounds && [selectedBounds.expected_min, selectedBounds.expected_max].map((bound, index) => <g key={index}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={chartY(bound)} y2={chartY(bound)} stroke="#f59e0b" strokeDasharray="6 4" opacity=".75"/><text x={chartWidth - chartPadding.right - 2} y={chartY(bound) - 4} textAnchor="end" fill="#fbbf24" fontSize="9">Simulator expected {index === 0 ? 'min' : 'max'} {bound} {currentSensorReading?.sensor_unit}</text></g>)}
                    {numericHistory.length > 1 && <path d={trendPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
                    {numericHistory.map((reading, index) => <circle key={reading.reading_id} cx={chartX(index)} cy={chartY(reading.sensor_value)} r={index === numericHistory.length - 1 ? 5 : 3} fill={reading.data_quality === 'GOOD' ? '#22d3ee' : '#f59e0b'} stroke="#0f172a" strokeWidth="2"><title>{`${formatTime(reading.timestamp)} · ${reading.sensor_value} ${reading.sensor_unit} · ${reading.data_quality}`}</title></circle>)}
                    <text x={chartPadding.left} y={chartHeight - 8} fill="#64748b" fontSize="10">{formatTime(numericHistory[0]?.timestamp)}</text><text x={chartWidth - chartPadding.right} y={chartHeight - 8} fill="#64748b" fontSize="10" textAnchor="end">{formatTime(lastReading?.timestamp)}</text>
                  </svg>
                </div>
                {numericHistory.length === 1 && <p className="mt-2 text-xs text-amber-200">One saved point is available. A line trend will appear after a second reading is stored.</p>}
                {selectedBounds && <p className="mt-2 text-[11px] text-slate-400">Dashed lines are the Simulator record’s expected range ({selectedBounds.expected_min}–{selectedBounds.expected_max} {selectedBounds.sensor_unit}); they are not FactoryPulse safety limits.</p>}
              </>}
      </Card>

      <Card title="Latest readings · selected machine" hint="Raw sensor names, values, units, status and quality from MySQL." className="xl:col-span-4">
        {selectedCurrent.length ? <div className="max-h-[310px] space-y-2 overflow-y-auto">{selectedCurrent.map((reading) => <button key={reading.reading_id} onClick={() => setSelectedSensor(reading.sensor_name)} className={`w-full rounded-lg border p-3 text-left transition ${selectedSensor === reading.sensor_name ? 'border-cyan-700 bg-cyan-950/30' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-200">{reading.sensor_name}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${reading.machine_status === 'CRITICAL' ? 'bg-rose-950 text-rose-300' : reading.machine_status === 'WARNING' ? 'bg-amber-950 text-amber-300' : reading.machine_status === 'NORMAL' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{reading.machine_status}</span></div>
          <p className="mt-1 font-mono text-lg font-semibold text-cyan-200">{formatValue(reading.sensor_value, reading.sensor_unit)}</p>
          <p className="mt-1 text-[10px] text-slate-500">{formatTime(reading.timestamp)} · {reading.data_quality}{reading.fault_mode ? ` · ${reading.fault_mode}` : ''}</p>
        </button>)}</div> : <p className="py-8 text-center text-xs text-slate-400">No saved readings for this machine yet.</p>}
      </Card>
    </div>

    <OperationalInsights machineId={selectedMachine?.machineId} isAdmin={user.role === 'Admin'}/>
    <Card title="Measurement coverage" hint="Current sensor availability. Select a meter above to inspect its trend.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{[
        ['RPM', 'RPM', <Gauge className="h-4 w-4"/>], ['Vibration', 'mm/s', <Activity className="h-4 w-4"/>], ['Temperature', '°C', <Thermometer className="h-4 w-4"/>], ['Motor Temperature', '°C', <Thermometer className="h-4 w-4"/>], ['Torque', 'Nm', <Wrench className="h-4 w-4"/>], ['Current', 'A', <Zap className="h-4 w-4"/>],
      ].map(([name, unit, icon]) => <div key={String(name)} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center gap-2 text-cyan-300">{icon}<span className="text-xs font-semibold text-slate-200">{name}</span></div><p className="mt-1 text-[10px] text-slate-500">{unit} · {sensorNames.includes(String(name)) ? 'data present' : 'no saved readings'}</p></div>)}</div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">The current Simulator payload does not provide production counts, shift targets, coolant temperature, motor load percentage, or motor power in kW. Those values are shown as unavailable here; RPM or motor temperature are not substituted for them.</p>
    </Card>
  </div>;
};
