import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Gauge, Radio, TrendingUp, Zap } from 'lucide-react';
import { Machine, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';
import { OperationalInsights } from './OperationalInsights';
import { SensorTrendChart } from './DashboardCharts';
import { estimatePartsPerHour } from '../utils/productionRate';

interface SimulatorFleetTelemetryDashboardProps {
  user: UserProfile;
  machines: Machine[];
  onReadingsChange?: (readings: PersistedSimulatorReading[]) => void;
}

const formatValue = (value: number | string | null, unit: string) => {
  const shown = typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value ?? '—';
  return `${shown}${shown === '—' || shown === null || shown === '' ? '' : ` ${unit}`}`;
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : 'No readings yet';
const toPlantLabel = (plant?: string) => plant?.includes(':') ? plant.split(':').slice(1).join(':').trim() : plant || 'Unassigned plant';
const sensorPriority = ['RPM', 'Temperature', 'Motor Temperature', 'Vibration', 'Pressure', 'Coolant Flow', 'Motor Load', 'Motor Power', 'Current', 'Torque', 'Voltage', 'Cycle Time', 'Good Parts', 'Scrap Parts', 'Shift Target'];



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
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load saved machine readings.');
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
    if (!selectedMachine?.machineId) { setMachineHistory([]); return; }
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
      }
    };
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
  const observedProductionRate = useMemo(() => estimatePartsPerHour(machineHistory, 'Good Parts'), [machineHistory]);
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

  const selectedMachineCount = visibleMachines.length;
  const maxComparison = Math.max(...comparisonRows.map((row) => row.mean), 1);
  const isFresh = Boolean(latestTime && Date.now() - new Date(latestTime).getTime() < 30000);
  const sourceState = error ? 'UNAVAILABLE' : fleetLoading && fleetReadings.length === 0 ? 'CONNECTING' : fleetReadings.length ? isFresh ? 'LIVE · MYSQL' : 'SAVED DATA · STREAM IDLE' : 'WAITING FOR READINGS';
  const signalChartTypes: Record<string, 'area' | 'line' | 'columns' | 'bullet'> = {
    'temperature': 'area', 'motor temperature': 'area', 'vibration': 'line', pressure: 'line',
    rpm: 'columns', 'cycle time': 'columns', 'motor load': 'bullet', current: 'bullet',
    'motor power': 'area', torque: 'area', 'coolant flow': 'line', voltage: 'line',
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
    <Card title="Live machine telemetry" hint="Machine readings saved in FactoryPulse MySQL · current values refresh every second; detailed history refreshes every two seconds." className="border-slate-200">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${fleetReadings.length && !error ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-slate-700'}`}><Radio className="h-3.5 w-3.5"/>{sourceState}</span>
          <span className="text-slate-600">Latest saved reading: {formatTime(latestTime)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role !== 'Operator' && <>
            <label className="sr-only" htmlFor="machine-plant-filter">Plant filter</label>
            <select id="machine-plant-filter" value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} className="max-w-[250px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="ALL">All plants</option>{plants.map((plant) => <option key={plant} value={plant}>{plant}</option>)}</select>
            <label className="sr-only" htmlFor="machine-type-filter">Machine type filter</label>
            <select id="machine-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="max-w-[270px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="ALL">All machine types</option>{machineTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <label className="sr-only" htmlFor="machine-select">Machine for detailed trend</label>
            <select id="machine-select" value={selectedMachine?.machineId || ''} onChange={(event) => setSelectedMachineId(event.target.value)} className="max-w-[320px] rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800"><option value="">Select a machine</option>{visibleMachines.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machine.machineId} · {machine.machineCode}</option>)}</select>
          </>}
          {user.role === 'Operator' && selectedMachine && <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800">Assigned: {selectedMachine.machineId} · {selectedMachine.machineCode}</span>}
        </div>
      </div>
      {error && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">Saved machine readings unavailable: {error}. Check that FactoryPulse API and MySQL are running.</p>}
      {user.role === 'Operator' && roleMachines.length === 0 && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-slate-700">No machine in the roster matches your assigned machine <strong>{user.assignedMachine || 'not assigned'}</strong>. Ask an Admin to check the account assignment and machine registry.</p>}
      {!error && !fleetLoading && fleetReadings.length === 0 && !(user.role === 'Operator' && roleMachines.length === 0) && <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-100 p-3 text-xs text-slate-700">No machine readings are available for this view yet. New values will appear here when received for the selected machine.</p>}
    </Card>

    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <Kpi label="Machines reporting" value={`${reportingCount} / ${selectedMachineCount}`} note="Machines with a saved reading" icon={<Cpu className="h-4 w-4"/>}/>
      <Kpi label="Latest sensor streams" value={String(visibleReadings.length)} note="One newest saved value per machine and sensor" icon={<Activity className="h-4 w-4"/>} tone="text-slate-700"/>
      <Kpi label="Need attention" value={String(statusCounts.warning + statusCounts.critical)} note={`${statusCounts.critical} critical · ${statusCounts.warning} warning`} icon={<AlertTriangle className="h-4 w-4"/>} tone={statusCounts.critical ? 'text-rose-800' : statusCounts.warning ? 'text-amber-800' : 'text-emerald-800'}/>
      <Kpi label="Good quality" value={visibleReadings.length ? `${Math.round(visibleReadings.filter((reading) => reading.data_quality === 'GOOD').length / visibleReadings.length * 100)}%` : '—'} note="Of latest stored sensor readings" icon={<Gauge className="h-4 w-4"/>} tone="text-teal-800"/>
    </div>

    <section aria-label="Individual machine reading charts" className="space-y-3">
      <div><h2 className="text-base font-semibold text-slate-900">{selectedMachine?.machineCode || 'Machine'} · individual sensor charts</h2><p className="mt-1 text-xs text-slate-600">Each measurement has a dedicated chart in a fixed position. Incoming readings update that chart only.</p></div>
      {historyError && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Saved history could not be refreshed: {historyError}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {signalCharts.map(({reading,points},index) => {
          const samples = [...points];
          if(!samples.some(point=>point.timestamp===reading.timestamp)) samples.push({timestamp:reading.timestamp,value:reading.sensor_value as number});
          const sorted = [...new Map(samples.map(point=>[point.timestamp,point])).values()].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
          return <div key={`${selectedMachine?.machineId}:${reading.sensor_name}`} className="min-w-0"><SensorTrendChart title={reading.sensor_name} description={`Expected ${reading.expected_min}–${reading.expected_max} ${reading.sensor_unit} · ${reading.data_quality}${reading.sensor_name==='Motor Power'?' · derived shaft power':reading.sensor_name==='Motor Load'?' · torque-range estimate':''}`} rows={sorted} unit={reading.sensor_unit} color={['#138b84','#cb7248','#4f77ba','#8163b0'][index%4]} /></div>;
        })}
      </div>
      {!signalCharts.length && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-xs text-slate-500">Waiting for saved sensor readings for this machine.</p>}
    </section>

    {(() => {
      const findValue = (name: string) => selectedCurrent.find((reading) => reading.sensor_name.toLowerCase() === name.toLowerCase() && typeof reading.sensor_value === 'number');
      const good = findValue('Good Parts'); const scrap = findValue('Scrap Parts'); const target = findValue('Shift Target');
      if (!good && !scrap && !target) return null;
      const goodValue = Number(good?.sensor_value ?? 0); const scrapValue = Number(scrap?.sensor_value ?? 0); const targetValue = Number(target?.sensor_value ?? 0);
      const progress = targetValue > 0 ? Math.min(100, (goodValue + scrapValue) / targetValue * 100) : 0;
      return <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-teal-50 p-4 shadow-sm sm:p-5" aria-label="Estimated production progress">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800">Estimated production progress</p><h2 className="mt-1 text-base font-semibold text-slate-900">Shift output against target</h2><p className="mt-1 text-xs text-slate-600">Part-count figures are estimates and are not verified factory production totals.</p></div><span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">{targetValue > 0 ? `${progress.toFixed(0)}% of target` : 'Target unavailable'}</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] md:items-center">
          <div>
            <div className="flex justify-between text-xs"><span className="font-medium text-slate-700">{(goodValue + scrapValue).toLocaleString()} of {targetValue.toLocaleString()} parts</span><span className="text-slate-500">{Math.max(0, targetValue - goodValue - scrapValue).toLocaleString()} remaining</span></div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-[11px] text-slate-500">Progress to the estimated shift target</p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-3 sm:items-center">
            <Donut segments={[{ label: 'Good', value: goodValue, color: '#0f766e' }, { label: 'Scrap', value: scrapValue, color: '#f59e0b' }]} center={`${(goodValue + scrapValue).toLocaleString()}`} caption="parts"/>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Average observed rate</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{observedProductionRate ? observedProductionRate.partsPerHour.toLocaleString() : 'Collecting history'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{observedProductionRate ? `parts/hour · ${observedProductionRate.minutesObserved} min of saved Good Parts readings` : 'Needs at least 1 minute of saved Good Parts history'}</p>
              <p className="mt-1 text-[10px] text-slate-500">Average estimated rate; not verified plant output.</p>
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
        </> : <p className="py-8 text-center text-xs text-slate-600">Status will appear after machine readings are stored.</p>}
      </Card>

      <Card title={`Latest ${selectedSensor || 'sensor'} by ${compareBy === 'plant' ? 'plant' : 'machine type'}`} hint="Bars compare the mean of each group's newest numeric readings. Only machines with saved values for this sensor are included." className="xl:col-span-8" action={<div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="machine-sensor-select">Sensor</label><select id="machine-sensor-select" value={selectedSensor} onChange={(event) => setSelectedSensor(event.target.value)} className="max-w-[200px] rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-800" disabled={!sensorNames.length}><option value="">No sensor data</option>{sensorNames.map((sensor) => <option key={sensor} value={sensor}>{sensor}</option>)}</select>
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
      <Card title="Latest readings · selected machine" hint="Raw sensor names, values, units, status and quality from MySQL." className="xl:col-span-12">
        {selectedCurrent.length ? <div className="max-h-[310px] space-y-2 overflow-y-auto">{selectedCurrent.map((reading) => <button key={reading.reading_id} onClick={() => setSelectedSensor(reading.sensor_name)} className={`w-full rounded-lg border p-3 text-left transition ${selectedSensor === reading.sensor_name ? 'border-slate-200 bg-cyan-50' : 'border-slate-200 bg-slate-100/50 hover:border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{reading.sensor_name}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${reading.machine_status === 'CRITICAL' ? 'bg-rose-50 text-rose-800' : reading.machine_status === 'WARNING' ? 'bg-amber-50 text-amber-800' : reading.machine_status === 'NORMAL' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{reading.machine_status}</span></div>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-700">{formatValue(reading.sensor_value, reading.sensor_unit)}</p>
          <p className="mt-1 text-[10px] text-slate-500">{formatTime(reading.timestamp)} · {reading.data_quality}{reading.fault_mode ? ` · ${reading.fault_mode}` : ''}</p>
        </button>)}</div> : <p className="py-8 text-center text-xs text-slate-600">No saved readings for this machine yet.</p>}
      </Card>
    </div>

    <OperationalInsights machineId={selectedMachine?.machineId} isAdmin={user.role === 'Admin'}/>
    <Card title="Machine readings" hint="Latest saved values for the selected machine. Choose a signal to open its timestamped trend.">
      <div className="space-y-4">
        {[
          { title: 'Machine sensors', note: 'Recorded sensor channels', icon: <Activity className="h-4 w-4"/>, signals: [['RPM', 'rpm'], ['Vibration', 'mm/s'], ['Temperature', '°C'], ['Motor Temperature', '°C'], ['Pressure', 'bar'], ['Coolant Flow', 'L/min'], ['Torque', 'Nm'], ['Current', 'A']] },
          { title: 'Derived indicators', note: 'Calculated estimates; not direct meter readings', icon: <Zap className="h-4 w-4"/>, signals: [['Motor Power', 'kW'], ['Motor Load', '%']] },
          { title: 'Production counters', note: 'Estimated part counts and targets; not verified factory production', icon: <Gauge className="h-4 w-4"/>, signals: [['Good Parts', 'parts'], ['Scrap Parts', 'parts'], ['Shift Target', 'parts'], ['Cycle Time', 's/cycle'], ['Target Cycle Time', 's/cycle']] },
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
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Motor Power is a shaft-power estimate derived from torque and RPM, not electrical energy. Motor Load is a torque-range proxy, not a VFD measurement. Coolant temperature and kWh energy consumption are not available in the current data feed, so those stay unavailable.</p>
    </Card>
  </div>;
};
