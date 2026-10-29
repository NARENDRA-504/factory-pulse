import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Factory, Gauge, Radio, ShieldCheck, Users, Wrench, Clock3 } from 'lucide-react';
import { Incident, Machine, MaintenanceWorkOrder, UserProfile, UserRole } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';

const roleHeading: Record<UserRole, { title: string; sub: string }> = {
  Operator: { title: 'Shift at a glance', sub: 'Your assigned station, live machine condition and the issues that need your attention.' },
  Supervisor: { title: 'Line and shift overview', sub: 'Fleet condition and response queues from saved Simulator telemetry and FactoryPulse records.' },
  Maintenance: { title: 'Equipment health and response', sub: 'Saved sensor readings, active faults and work awaiting maintenance action.' },
  Manager: { title: 'Plant performance overview', sub: 'Compare reported machine condition across plants. Production and cost measures require production and finance sources.' },
  Admin: { title: 'System and access overview', sub: 'Review service status, audit activity and machine data coverage.' },
};

const panel = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const muted = 'text-xs leading-relaxed text-slate-600';
const display = (value: number | string | null | undefined, unit = '') => value === null || value === undefined || value === '' ? 'Unavailable' : `${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}${unit ? ` ${unit}` : ''}`;
const localTime = (timestamp?: string) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting for a reading';
const PRODUCTION_SENSORS = new Set(['good parts', 'scrap parts', 'shift target', 'cycle time', 'target cycle time']);

function Metric({ label, value, foot, icon }: { label: string; value: string; foot: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</span><span className="text-teal-700">{icon}</span></div><div className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value}</div><div className="mt-1 text-[11px] text-slate-500">{foot}</div></div>;
}

function StatusBadge({ status }: { status?: string }) {
  const styles: Record<string, string> = {
    NORMAL: 'border-emerald-200 bg-emerald-50 text-emerald-800', RUNNING: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-900', IDLE: 'border-slate-200 bg-slate-100 text-slate-700',
    STOPPED: 'border-rose-200 bg-rose-50 text-rose-800', CRITICAL: 'border-rose-200 bg-rose-50 text-rose-800', DOWN: 'border-rose-200 bg-rose-50 text-rose-800',
    HIGH: 'border-rose-200 bg-rose-50 text-rose-800', MEDIUM: 'border-amber-200 bg-amber-50 text-amber-900', LOW: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  const label = status || 'No current reading';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[label.toUpperCase()] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{label}</span>;
}

function Unavailable({ title, reason }: { title: string; reason: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"><h3 className="text-xs font-semibold text-slate-800">{title}</h3><p className="mt-1 text-[11px] leading-relaxed text-slate-600">{reason}</p></div>;
}

export function RoleDashboardHighlights({ user, machines, incidents, workOrders, readings }: { user: UserProfile; machines: Machine[]; incidents: Incident[]; workOrders: MaintenanceWorkOrder[]; readings: PersistedSimulatorReading[] }) {
  const [plant, setPlant] = useState('ALL');
  const [line, setLine] = useState('ALL');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [system, setSystem] = useState<any>(null);

  useEffect(() => {
    if (user.role !== 'Admin') return;
    let cancelled = false;
    const refresh = async () => { try { const health = await apiClient.getSystemHealth(); if (!cancelled) setSystem(health); } catch { if (!cancelled) setSystem({ unavailable: true }); } };
    refresh(); const timer = window.setInterval(refresh, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user.role]);

  const plantMachines = useMemo(() => {
    const list = user.role === 'Operator'
      ? machines.filter((m) => m.machineCode === user.assignedMachine || m.code === user.assignedMachine || m.operatorWorkId === user.workId)
      : machines;
    // Operators always see their assigned station, regardless of the fleet plant selector.
    return user.role === 'Operator' || plant === 'ALL' ? list : list.filter((m) => m.plant === plant);
  }, [machines, plant, user]);
  const lineOptions = useMemo(() => [...new Set(plantMachines.map((m) => m.productionLine).filter(Boolean))].sort(), [plantMachines]);
  const effectiveLine = user.role === 'Supervisor' && lineOptions.includes(line) ? line : 'ALL';
  const scopedMachines = useMemo(() => user.role === 'Supervisor' && effectiveLine !== 'ALL'
    ? plantMachines.filter((m) => m.productionLine === effectiveLine)
    : plantMachines, [plantMachines, user.role, effectiveLine]);
  const assignedMachine = user.role === 'Operator' ? scopedMachines[0] : undefined;
  const selectedMachineForScope = scopedMachines.some((m) => m.machineId === selectedMachine) ? selectedMachine : '';
  const effectiveMachineId = user.role === 'Operator'
    ? assignedMachine?.machineId || ''
    : selectedMachineForScope || scopedMachines.find((m) => readings.some((r) => r.machine_id === m.machineId))?.machineId || scopedMachines[0]?.machineId || '';
  const allowedIds = useMemo(() => new Set(scopedMachines.map((m) => m.machineId)), [scopedMachines]);
  const scopedReadings = useMemo(() => readings.filter((r) => allowedIds.has(r.machine_id)), [readings, allowedIds]);
  const latestByMachine = useMemo(() => {
    const map = new Map<string, PersistedSimulatorReading>();
    for (const row of scopedReadings) {
      const prior = map.get(row.machine_id);
      if (!prior || Date.parse(row.timestamp) > Date.parse(prior.timestamp)) map.set(row.machine_id, row);
    }
    return [...map.values()];
  }, [scopedReadings]);
  const latestForSelected = useMemo(() => scopedReadings.filter((r) => r.machine_id === effectiveMachineId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [scopedReadings, effectiveMachineId]);
  const sensorValue = (names: string[]) => latestForSelected.find((r) => names.some((n) => r.sensor_name.toLowerCase() === n.toLowerCase()));
  const productionByMachine = useMemo(() => {
    const byMachine = new Map<string, Map<string, PersistedSimulatorReading>>();
    for (const row of scopedReadings) {
      const key = row.sensor_name.toLowerCase();
      if (!PRODUCTION_SENSORS.has(key)) continue;
      const sensors = byMachine.get(row.machine_id) || new Map<string, PersistedSimulatorReading>();
      const previous = sensors.get(key);
      if (!previous || Date.parse(row.timestamp) > Date.parse(previous.timestamp)) sensors.set(key, row);
      byMachine.set(row.machine_id, sensors);
    }
    return byMachine;
  }, [scopedReadings]);
  const productionValue = (machineId: string, sensor: string) => {
    const raw = productionByMachine.get(machineId)?.get(sensor.toLowerCase())?.sensor_value;
    const value = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const productionTotals = (sensor: string) => [...productionByMachine.values()].reduce((sum, sensors) => {
    const value = sensors.get(sensor.toLowerCase())?.sensor_value;
    const number = value === null || value === undefined ? NaN : Number(value);
    return sum + (Number.isFinite(number) ? number : 0);
  }, 0);
  const selectedGood = productionValue(effectiveMachineId, 'Good Parts');
  const selectedScrap = productionValue(effectiveMachineId, 'Scrap Parts');
  const selectedTarget = productionValue(effectiveMachineId, 'Shift Target');
  const selectedCycle = productionValue(effectiveMachineId, 'Cycle Time');
  const selectedCycleTarget = productionValue(effectiveMachineId, 'Target Cycle Time');
  const hasSelectedProduction = selectedGood !== undefined && selectedScrap !== undefined && selectedTarget !== undefined;
  const selectedActual = hasSelectedProduction ? selectedGood! + selectedScrap! : undefined;
  const selectedProgress = selectedActual !== undefined && selectedTarget! > 0 ? Math.min(100, selectedActual / selectedTarget! * 100) : undefined;
  const fleetGood = productionTotals('Good Parts');
  const fleetScrap = productionTotals('Scrap Parts');
  const fleetTarget = productionTotals('Shift Target');
  const fleetActual = fleetGood + fleetScrap;
  const hasFleetProduction = productionByMachine.size > 0 && fleetTarget > 0;
  const physicalRowsForSelected = latestForSelected.filter((r) => !PRODUCTION_SENSORS.has(r.sensor_name.toLowerCase()));
  const openIncidents = incidents.filter((i) => i.status !== 'Closed' && (user.role !== 'Operator' || i.machineCode === user.assignedMachine));
  const openOrders = workOrders.filter((w) => w.status !== 'Completed' && (user.role !== 'Operator' || w.machineCode === user.assignedMachine));
  const plants = [...new Set(machines.map((m) => m.plant).filter(Boolean))].sort();
  const managerLineGroups = [...new Set(scopedMachines.map((m) => `${m.plant || 'Unknown plant'} · ${m.productionLine || 'Unassigned line'}`))].map((label) => ({
    label,
    machines: scopedMachines.filter((m) => `${m.plant || 'Unknown plant'} · ${m.productionLine || 'Unassigned line'}` === label),
  }));
  const statusCount = (statuses: string[]) => latestByMachine.filter((r) => statuses.includes(r.machine_status)).length;
  const title = roleHeading[user.role];
  const prioritizedIncidents = [...openIncidents].sort((a, b) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[a.severity] ?? 4) - ({ Critical: 0, High: 1, Medium: 2, Low: 3 }[b.severity] ?? 4));
  const prioritizedOrders = [...openOrders].sort((a, b) => ({ Critical: 0, Urgent: 1, High: 2, Medium: 3, Low: 4 }[a.priority] ?? 5) - ({ Critical: 0, Urgent: 1, High: 2, Medium: 3, Low: 4 }[b.priority] ?? 5));
  const assignedIncidents = [...openIncidents].filter((i) => !assignedMachine || i.machineCode === assignedMachine.machineCode || i.machineCode === assignedMachine.code).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return <section className={`${panel} space-y-4`} aria-label={`${user.role} dashboard summary`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">{user.role} · live operations</p><h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{title.title}</h1><p className={`mt-1 max-w-3xl ${muted}`}>{title.sub}</p></div>
      <div className="flex flex-wrap gap-3">{(user.role === 'Supervisor' || user.role === 'Manager' || user.role === 'Admin') && <label className="text-xs font-medium text-slate-600">Plant <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" value={plant} onChange={(e) => setPlant(e.target.value)}><option value="ALL">All plants</option>{plants.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>}{user.role === 'Supervisor' && <label className="text-xs font-medium text-slate-600">Line / bay <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" value={effectiveLine} onChange={(e) => setLine(e.target.value)}><option value="ALL">All lines</option>{lineOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}</div>
    </div>

    {user.role === 'Operator' && <div className="grid gap-2 rounded-xl border border-teal-200 bg-teal-50/70 p-3 sm:grid-cols-4">
      <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Operator</div><strong className="text-sm text-slate-900">{user.fullName} · {user.workId}</strong></div>
      <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Machine ID · station</div><strong className="font-mono text-sm text-slate-900">{assignedMachine ? `${assignedMachine.machineId} · ${assignedMachine.machineCode}` : user.assignedMachine || 'Unassigned'}</strong></div>
      <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Shift</div><strong className="text-sm text-slate-900">{user.shift || 'Not assigned'}</strong></div>
      <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Session started</div><strong className="text-sm text-slate-900">{user.sessionStartedAt ? new Date(user.sessionStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unavailable'}</strong><div className="text-[10px] text-slate-500">{user.shift ? `${user.shift} · shift attendance is not tracked` : 'Shift not assigned'}</div></div>
    </div>}

    {user.role === 'Operator' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Machine status</span><Radio size={16} className="text-teal-700" /></div><div className="mt-2"><StatusBadge status={latestForSelected[0]?.machine_status} /></div><div className="mt-2 text-[11px] text-slate-500">{latestForSelected[0] ? `Latest report ${localTime(latestForSelected[0].timestamp)}` : 'No status from the assigned machine'}</div></div>
        <Metric label="Production · actual / target" value={hasSelectedProduction ? `${display(selectedActual, 'parts')} / ${display(selectedTarget, 'parts')}` : 'Waiting for Simulator'} foot={hasSelectedProduction ? 'Modelled shift output · includes good and scrap parts' : 'Start the Simulator to receive production counters'} icon={<BarChart3 size={16} />} />
        <Metric label="Cycle · good / scrap" value={hasSelectedProduction ? `${display(selectedCycle, 's')} · ${display(selectedGood, 'good')} / ${display(selectedScrap, 'scrap')}` : 'Waiting for Simulator'} foot={hasSelectedProduction ? `Simulated cycle target ${display(selectedCycleTarget, 's/cycle')}` : 'Cycle and quality counts arrive with Simulator data'} icon={<CheckCircle2 size={16} />} />
        <Metric label="Open issues" value={String(openIncidents.length)} foot="FactoryPulse incidents for your assigned station" icon={<AlertTriangle size={16} />} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['RPM', ['rpm', 'spindle speed']], ['Machine temperature', ['motor temperature']], ['Vibration', ['vibration']], ['Pressure', ['pressure']], ['Coolant flow', ['coolant flow']], ['Shaft power · derived', ['motor power']], ['Motor load · proxy', ['motor load']],
      ].map(([label, names]) => { const row = sensorValue(names as string[]); const labelText = label as string; const powerNote = labelText.startsWith('Shaft power') ? 'Derived from Torque × RPM · not electrical energy' : labelText.startsWith('Motor load') ? 'Torque-range simulator proxy · not a VFD measurement' : ''; return <Metric key={labelText} label={labelText} value={row ? display(row.sensor_value, row.sensor_unit) : 'Unavailable'} foot={row ? `${powerNote ? `${powerNote} · ` : ''}Expected ${row.expected_min}–${row.expected_max} ${row.sensor_unit} · ${row.data_quality}` : labelText.startsWith('Shaft power') || labelText.startsWith('Motor load') ? 'Waiting for valid torque and RPM readings' : 'No matching saved sensor stream'} icon={<Gauge size={16} />} />; })}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">Shift production progress</h2><p className={`mt-1 ${muted}`}>Counts are generated by the Simulator’s production model, not a factory counter.</p></div><BarChart3 size={17} className="text-teal-700" /></div><div className="mt-3 grid grid-cols-3 gap-2"><Metric label="Actual parts" value={display(selectedActual, 'parts')} foot="Good + scrap · simulated" icon={<CheckCircle2 size={15} />} /><Metric label="Shift target" value={display(selectedTarget, 'parts')} foot="Simulator model target" icon={<Gauge size={15} />} /><Metric label="Good · scrap" value={hasSelectedProduction ? `${display(selectedGood)} · ${display(selectedScrap)}` : 'Waiting'} foot="Modelled counts" icon={<ClipboardList size={15} />} /></div>{selectedProgress !== undefined ? <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-600"><span>Target progress</span><strong>{Math.round(selectedProgress)}%</strong></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${selectedProgress}%` }} /></div></div> : <div className="mt-3"><Unavailable title="Waiting for production model readings" reason="Start the Simulator. Part counts and target will appear after it sends them." /></div>}{selectedCycle !== undefined && <p className="mt-3 text-xs text-slate-600">Latest simulated cycle: <strong>{display(selectedCycle, 's')}</strong> · target {display(selectedCycleTarget, 's/cycle')}</p>}</div>
        <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-900">Recent machine alarms</h2><p className={`mt-1 ${muted}`}>Open incident reports for your assigned station.</p></div><AlertTriangle size={17} className="text-amber-700" /></div><div className="mt-3 space-y-2">{assignedIncidents.slice(0, 5).map((incident) => <div key={incident.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3"><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-900">{incident.incidentCode} · {incident.machineCode}</div><p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{incident.symptomDescription}</p><span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock3 size={11} />{localTime(incident.createdAt)}</span></div><StatusBadge status={incident.severity.toUpperCase()} /></div>)}{!assignedIncidents.length && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">No open incident reports for this station.</p>}</div><p className="mt-3 text-[11px] text-slate-500">Downtime duration and reason codes are not currently recorded. Use Report Problem to log an issue.</p></div>
      </div>
      <p className={muted}>Sensor names, values, units, bounds and quality stay as sent by the Simulator. Missing measurements remain unavailable.</p>
    </>}

    {user.role === 'Supervisor' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Machines reporting" value={`${latestByMachine.length} / ${scopedMachines.length}`} foot="Machines with a saved Simulator state" icon={<Factory size={16} />} /><Metric label="Normal" value={String(statusCount(['NORMAL']))} foot="Latest saved state per machine" icon={<CheckCircle2 size={16} />} /><Metric label="Alerts" value={String(statusCount(['WARNING', 'CRITICAL']))} foot={`${statusCount(['CRITICAL'])} critical · ${statusCount(['WARNING'])} warning`} icon={<AlertTriangle size={16} />} /><Metric label="Open incidents" value={String(openIncidents.length)} foot="Persisted FactoryPulse records" icon={<ClipboardList size={16} />} /><Metric label="Simulated output / target" value={hasFleetProduction ? `${display(fleetActual)} / ${display(fleetTarget)}` : 'Waiting for Simulator'} foot="Modelled shift counts across machines in scope" icon={<BarChart3 size={16} />} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><h2 className="text-sm font-semibold text-slate-900">Line condition heatmap</h2><p className={`mt-1 ${muted}`}>Latest saved machine state · machines without readings remain unreported.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{scopedMachines.map((m) => { const r = latestByMachine.find((row) => row.machine_id === m.machineId); const state = r?.machine_status || 'No data'; const color = state === 'CRITICAL' || state === 'STOPPED' ? 'border-rose-300 bg-rose-50 text-rose-800' : state === 'WARNING' ? 'border-amber-300 bg-amber-50 text-amber-900' : state === 'NORMAL' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-600'; return <div key={m.machineId} className={`rounded-lg border px-2.5 py-2 ${color}`}><div className="truncate font-mono text-xs font-semibold">{m.machineCode}</div><div className="mt-1 text-[10px]">{state}</div></div>; })}</div></div><div className="rounded-xl border border-slate-200 p-3"><h2 className="text-sm font-semibold text-slate-900">Response queue · highest priority first</h2><p className={`mt-1 ${muted}`}>Open issues and uncompleted work orders from FactoryPulse.</p><div className="mt-3 space-y-2">{prioritizedIncidents.slice(0, 5).map((i) => <div key={i.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 p-2.5 text-xs"><span className="truncate text-slate-800">{i.machineCode} · {i.symptomDescription}</span><b className="shrink-0 text-amber-800">{i.severity}</b></div>)}{prioritizedOrders.slice(0, 4).map((w) => <div key={w.id} className="flex justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-xs"><span className="truncate text-slate-700">{w.machineCode} · {w.orderCode} · {w.actionTaken || w.incidentCode}</span><b className="shrink-0 text-teal-800">{w.status}</b></div>)}{!openIncidents.length && !openOrders.length && <p className={`py-4 ${muted}`}>No open incident or work-order records.</p>}</div></div></div>
      <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-semibold text-slate-800">Shift output vs. simulator target</h3><p className="mt-1 text-[11px] text-slate-600">A modelled counter view; not a verified production/OEE record.</p>{hasFleetProduction ? <><div className="mt-3 flex justify-between text-sm"><span>{display(fleetActual)} parts</span><strong>{fleetTarget ? Math.min(100, Math.round(fleetActual / fleetTarget * 100)) : 0}%</strong></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, fleetActual / fleetTarget * 100)}%` }} /></div><p className="mt-2 text-[11px] text-slate-600">{display(fleetGood)} good · {display(fleetScrap)} scrap · target {display(fleetTarget)}</p></> : <p className="mt-3 text-xs text-slate-500">Waiting for saved Simulator production values.</p>}</div><Unavailable title="Shift OEE" reason="Requires planned shift time and validated availability, quality and cycle-time definitions. Simulator model values alone do not establish plant OEE." /><Unavailable title="Downtime Pareto and operator allocation" reason="Reason-coded stop intervals and verified shift attendance are not recorded yet." /></div>
    </>}

    {user.role === 'Maintenance' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] font-semibold uppercase text-slate-600">Equipment<select className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium normal-case text-slate-800" value={effectiveMachineId} onChange={(e) => setSelectedMachine(e.target.value)}>{scopedMachines.map((m) => <option key={m.machineId} value={m.machineId}>{m.machineCode} · {m.displayName}</option>)}</select></label><Metric label="Active faults" value={String(openIncidents.length)} foot="Open persisted incident records" icon={<AlertTriangle size={16} />} /><Metric label="Work awaiting action" value={String(openOrders.length)} foot="Uncompleted FactoryPulse work orders" icon={<Wrench size={16} />} /><Metric label="MTBF / MTTR" value="Unavailable" foot="Requires complete failure and repair timestamps" icon={<Activity size={16} />} /><Metric label="Tech response time" value="Unavailable" foot="Assignment and acknowledgement timestamps are not available" icon={<ClipboardList size={16} />} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-900">Current diagnostic readings</h2><p className={`mt-1 ${muted}`}>Latest physical sensors from FactoryPulse MySQL. Production counters are shown separately and are excluded from this equipment list.</p><div className="mt-3 space-y-2">{physicalRowsForSelected.slice(0, 12).map((r) => { const low = Number(r.expected_min); const high = Number(r.expected_max); const value = Number(r.sensor_value); const hasBounds = Number.isFinite(low) && Number.isFinite(high); const out = hasBounds && r.sensor_value !== null && Number.isFinite(value) && (value < low || value > high); const derived = r.sensor_name.toLowerCase() === 'motor power'; const proxy = r.sensor_name.toLowerCase() === 'motor load'; return <div key={r.reading_id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-xs"><span className="text-slate-700">{r.sensor_name}{derived && <span className="ml-1 text-slate-500">(derived shaft power)</span>}{proxy && <span className="ml-1 text-slate-500">(torque-range proxy)</span>}</span><span className="font-semibold tabular-nums text-slate-900">{display(r.sensor_value, r.sensor_unit)}</span><span className="text-right text-slate-500">{hasBounds ? `Expected ${low}–${high} ${r.sensor_unit}` : 'No configured bounds'}<br/><StatusBadge status={out ? 'WARNING' : r.machine_status} /></span></div>; })}{!physicalRowsForSelected.length && <p className={`py-4 ${muted}`}>No physical sensor readings saved for this machine.</p>}</div><div className="mt-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-900">Shift model: {hasSelectedProduction ? `${display(selectedGood)} good · ${display(selectedScrap)} scrap · ${display(selectedCycle, 's')} per cycle` : 'Waiting for Simulator production counters.'} These are simulator values, not validated plant production records. Motor Power is derived shaft power, and Motor Load is a torque-range proxy; neither is an electrical meter reading.</div></div><div className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-900">Active fault queue and work history</h2><p className={`mt-1 ${muted}`}>Open faults are ordered by severity; work orders show their current recorded status.</p><div className="mt-3 space-y-2">{prioritizedIncidents.map((i) => <div key={i.id} className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">{i.machineCode} · {i.severity} · {i.symptomDescription}</div>)}{prioritizedOrders.map((w) => <div key={w.id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-800">{w.machineCode} · {w.orderCode} · {w.actionTaken || w.incidentCode} · {w.status}</div>)}{!openIncidents.length && !openOrders.length && <p className={muted}>No active fault or work-order records.</p>}<p className="pt-2 text-[11px] text-slate-500">Closed records appear in maintenance history only when they exist in the database.</p></div></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><Unavailable title="MTBF and MTTR" reason="These measures need complete failure, repair-start and resolution timestamps for the selected machine." /><Unavailable title="Technician response time" reason="The current source does not record a verified alarm-to-technician-acknowledgement timeline." /></div>
    </>}

    {user.role === 'Manager' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Machines reporting" value={`${latestByMachine.length} / ${scopedMachines.length}`} foot="Latest saved Simulator state" icon={<Factory size={16} />} /><Metric label="Fleet status" value={`${statusCount(['NORMAL'])} normal`} foot={`${statusCount(['IDLE'])} idle · ${statusCount(['WARNING'])} warning · ${statusCount(['CRITICAL'])} critical`} icon={<Activity size={16} />} /><Metric label="Simulated yield / scrap" value={hasFleetProduction && fleetGood + fleetScrap > 0 ? `${Math.round(fleetGood / (fleetGood + fleetScrap) * 100)}% / ${Math.round(fleetScrap / (fleetGood + fleetScrap) * 100)}%` : 'Waiting for Simulator'} foot="Model-generated part counts only · not plant actuals" icon={<CheckCircle2 size={16} />} /><Metric label="Downtime loss" value="Unavailable" foot="No verified downtime cost rate or finance source" icon={<BarChart3 size={16} />} /><Metric label="Energy efficiency" value="Unavailable" foot="No energy meter or tariff data supplied" icon={<Gauge size={16} />} /></div>
      <div><h2 className="mb-2 text-sm font-semibold text-slate-900">Line-by-line condition comparison</h2><p className={`mb-3 ${muted}`}>Bars compare each line’s newest reported machine status with its registered roster. They do not represent production or OEE.</p><div className="grid gap-3 lg:grid-cols-2">{managerLineGroups.map(({ label, machines: group }) => { const ids = new Set(group.map((m) => m.machineId)); const stateRows = latestByMachine.filter((r) => ids.has(r.machine_id)); const normal = stateRows.filter((r) => r.machine_status === 'NORMAL').length; const idle = stateRows.filter((r) => r.machine_status === 'IDLE').length; const warning = stateRows.filter((r) => r.machine_status === 'WARNING').length; const risk = stateRows.filter((r) => ['CRITICAL', 'STOPPED', 'DOWN', 'MAINTENANCE'].includes(r.machine_status)).length; const width = (count: number) => `${group.length ? count / group.length * 100 : 0}%`; return <div key={label} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-900">{label}</h3><p className={muted}>{stateRows.length} of {group.length} machines reporting</p></div><span className="text-xs text-teal-800">{group.length ? Math.round(stateRows.length / group.length * 100) : 0}% reporting</span></div><div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${normal} normal, ${idle} idle, ${warning} warning, ${risk} down or critical`}><div className="bg-emerald-600" style={{ width: width(normal) }} /><div className="bg-slate-400" style={{ width: width(idle) }} /><div className="bg-amber-500" style={{ width: width(warning) }} /><div className="bg-rose-500" style={{ width: width(risk) }} /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600"><span>{normal} normal</span><span>{idle} idle</span><span>{warning} warning</span><span>{risk} down / critical</span><span>{group.length - stateRows.length} no report</span></div></div>; })}{!managerLineGroups.length && <p className={muted}>No line assignments are available for this plant selection.</p>}</div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Unavailable title="OEE · day / week / month" reason="Needs approved production counts, ideal cycle time, planned shift time, and explicit downtime intervals." /><Unavailable title="Yield and scrap cost" reason="No verified part-quality counts or approved material cost per part are available." /><Unavailable title="Financial downtime loss" reason="No explicit downtime durations or approved lost-output/revenue rate are configured." /><Unavailable title="Energy per unit" reason="No machine energy meter readings or verified production denominator are connected." /></div>
    </>}

    {user.role === 'Admin' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Backend" value={system?.backend || (system?.unavailable ? 'Unavailable' : 'Checking')} foot="FactoryPulse service health" icon={<Radio size={16} />} /><Metric label="MySQL" value={system?.mysql || (system?.unavailable ? 'Unavailable' : 'Checking')} foot="Operational source of truth" icon={<CheckCircle2 size={16} />} /><Metric label="Machines reporting" value={system?.machines_receiving === undefined ? 'Checking' : String(system.machines_receiving)} foot="Saved Simulator streams" icon={<Factory size={16} />} /><Metric label="Activity log" value="Available" foot="Admin-only sign-in and business audit events" icon={<ShieldCheck size={16} />} /><Metric label="Power BI refresh" value="Unverified" foot="Local report reference exists; source and refresh are not verified" icon={<BarChart3 size={16} />} /></div>
      <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-xl border border-slate-200 p-4 lg:col-span-2"><h2 className="text-sm font-semibold text-slate-900">Audit and access coverage</h2><p className={`mt-1 ${muted}`}>Use Activity Log and User Management for event records and access administration. Current logs include employee, role, UTC event time, session and request identifiers.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">Session events recorded</span><span className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">Role changes audited</span><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">IP/device stored only when optional audit columns are installed; older rows may say “Not captured”</span><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">Manual override event type not currently configured</span></div></div><div className="rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-900">Role coverage</h2><p className={`mt-1 ${muted}`}>User administration is protected to Admin.</p><div className="mt-3 space-y-2">{(['Operator', 'Supervisor', 'Maintenance', 'Manager', 'Admin'] as UserRole[]).map((role) => <div key={role} className="flex justify-between text-xs"><span className="text-slate-700">{role}</span><strong className="text-teal-800">{machines.filter((m) => m.assignedOperator && role === 'Operator').length ? 'Rostered' : role === 'Operator' ? 'Roster data' : 'Protected'}</strong></div>)}</div><p className="mt-3 text-[11px] text-slate-500">Per-role usage analytics are not available from current audit API.</p></div></div>
    </>}

    {user.role === 'Supervisor' && <p className={muted}><Users size={14} className="mr-1 inline" />Coverage data is limited to known roster assignments; actual presence and staffing counts are not inferred.</p>}
    {user.role === 'Maintenance' && <p className={muted}><Wrench size={14} className="mr-1 inline" />Pressure and coolant flow are Simulator sensor streams. Shaft power is derived from torque and RPM; it is not an electrical meter or energy-consumption reading.</p>}
    {(user.role === 'Supervisor' || user.role === 'Manager' || user.role === 'Admin') && <p className={`${muted} border-t border-slate-100 pt-3`}>Live values are Simulator readings persisted in FactoryPulse MySQL. Last fleet update: {localTime(scopedReadings.reduce<string | undefined>((a, r) => !a || Date.parse(r.timestamp) > Date.parse(a) ? r.timestamp : a, undefined))}. {scopedReadings.length ? `${scopedReadings.length} latest sensor streams in this selection.` : 'Waiting for saved readings.'}</p>}
  </section>;
}
