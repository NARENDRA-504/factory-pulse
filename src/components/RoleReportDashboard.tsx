import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, CircleHelp, Filter, RefreshCw } from 'lucide-react';
import { Incident, Machine, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';
import { buildRoleReport, numericReading, reportMachineScope } from '../utils/roleReportData';
import { SensorTrendChart } from './DashboardCharts';
import { AdminWorkspace, ManagerWorkspace, SupervisorWorkspace } from './RoleWorkspaces';
import { OperationsModelPanel } from './OperationsModelPanel';
import { ShiftOperations } from './ShiftOperations';
import { MachineOperations } from './MachineOperations';
import { MaintenanceTicketClosure } from './MaintenanceTicketClosure';

const panel = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const input = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800';
const fmt = (n: number | undefined, digits = 1) => n === undefined ? 'Unavailable' : n.toLocaleString(undefined, { maximumFractionDigits: digits });
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const shortLine = (label: string) => label.replace(/Plant ([^:]+):[^/]+\/ /, 'Plant $1 / ');

function Metric({ label, value, foot }: { label: string; value: string; foot: string }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-900">{value}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{foot}</p></article>;
}
function LoadGauge({ row }: { row?: PersistedSimulatorReading }) {
  const value = numericReading(row?.sensor_value);
  const valid = row?.sensor_unit === '%' && value !== undefined;
  const fraction = valid ? Math.max(0, Math.min(1, value / 100)) : 0;
  return <section className={panel}><h3 className="text-sm font-semibold">Motor load</h3><p className="mt-1 text-xs text-slate-500">Latest percentage reading · torque proxy when supplied by the current source.</p>
    <svg viewBox="0 0 240 146" className="mx-auto mt-4 max-h-48 w-full" role="img" aria-label={`Motor load ${valid ? fmt(value) + ' percent' : 'unavailable'}`}><path d="M25 115 A95 95 0 0 1 215 115" fill="none" stroke="#e7eef4" strokeWidth="22" pathLength="100" strokeLinecap="round" />{valid && fraction > 0 && <path d="M25 115 A95 95 0 0 1 215 115" fill="none" stroke={value > row.expected_max ? '#df6471' : '#1688d4'} strokeWidth="22" pathLength="100" strokeDasharray={`${fraction * 100} 100`} strokeLinecap="round" />}<text x="120" y="102" textAnchor="middle" fontSize="29" fill="#183b4c" fontWeight="600">{valid ? fmt(value) + '%' : '—'}</text><text x="24" y="143" fontSize="11" fill="#64748b">0%</text><text x="215" y="143" textAnchor="end" fontSize="11" fill="#64748b">100%</text></svg>
    <p className="mt-1 text-xs text-slate-500">{row ? `Configured range ${row.expected_min}–${row.expected_max} ${row.sensor_unit}` : 'No motor load reading received.'}</p></section>;
}

export function RoleReportDashboard({ user, machines, incidents, readings, error, onNavigate }: { user: UserProfile; machines: Machine[]; incidents: Incident[]; readings: PersistedSimulatorReading[]; error?: string; onNavigate?: (screen: 'users' | 'activity' | 'inventory') => void }) {
  const [filtersOpen, setFiltersOpen] = useState(user.role !== 'Manager');
  const [plant, setPlant] = useState('ALL'), [line, setLine] = useState('ALL'), [machineId, setMachineId] = useState('ALL');
  const [search, setSearch] = useState(''), [from, setFrom] = useState(() => localDate(new Date(Date.now() - 3600000))), [to, setTo] = useState(() => localDate(new Date()));
  const [range, setRange] = useState<{ since: string; until: string } | null>(null), [request, setRequest] = useState(0);
  const [history, setHistory] = useState<PersistedSimulatorReading[]>([]), [loading, setLoading] = useState(false), [historyError, setHistoryError] = useState('');
  const [historyNote, setHistoryNote] = useState(''), [detail, setDetail] = useState<PersistedSimulatorReading[]>([]), [detailError, setDetailError] = useState('');
  const [validation, setValidation] = useState('');
  const allowed = useMemo(() => reportMachineScope(user, machines), [user, machines]);
  const plants = [...new Set(allowed.map(m => m.plant))].sort();
  const plantMachines = allowed.filter(m => plant === 'ALL' || m.plant === plant);
  const lines = [...new Set(plantMachines.map(m => m.productionLine))].sort();
  const lineMachines = plantMachines.filter(m => line === 'ALL' || m.productionLine === line);
  const scopedMachines = lineMachines.filter(m => machineId === 'ALL' || m.machineId === machineId);
  const scopeKey = scopedMachines.map(m => m.machineId).sort().join(',');
  const scopeIds = useRef<string[]>([]); scopeIds.current = scopedMachines.map(m => m.machineId);
  const report = useMemo(() => buildRoleReport(scopedMachines, range ? history : readings, incidents), [scopeKey, machines, range, history, readings, incidents]);
  const detailId = user.role === 'Operator' ? scopedMachines[0]?.machineId : machineId !== 'ALL' ? machineId : undefined;

  useEffect(() => {
    if (!range) { setHistory([]); setHistoryError(''); setHistoryNote(''); return; }
    let cancelled = false;
    setLoading(true); setHistory([]); setHistoryError(''); setHistoryNote('');
    const ids = [...scopeIds.current];
    const collected: PersistedSimulatorReading[] = [], failed: string[] = [], capped: string[] = [];
    let cursor = 0;
    const worker = async () => {
      while (!cancelled && cursor < ids.length) {
        const id = ids[cursor++];
        try { const rows = await apiClient.getPersistedSimulatorTelemetry(id, user.workId, 1000, range); collected.push(...rows); if (rows.length === 1000) capped.push(id); }
        catch { failed.push(id); }
      }
    };
    Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker)).then(() => {
      if (cancelled) return;
      setHistory(collected); setLoading(false);
      if (failed.length) setHistoryError(`Incomplete report: ${failed.length} machine histories could not be loaded. Retry Apply window.`);
      setHistoryNote(capped.length ? `History is capped at 1,000 newest records per machine; ${capped.length} reached the cap. Counts are a sample, not complete date-range totals.` : 'Selected records returned by MySQL for this window. Production cards are the latest counter snapshots in that window, not units made during it.');
    });
    return () => { cancelled = true; };
  }, [scopeKey, range, request, user.workId]);

  useEffect(() => {
    setDetail([]); setDetailError('');
    if (!detailId || range) return;
    let cancelled = false, timer: number;
    const refresh = async () => {
      try { const rows = await apiClient.getPersistedSimulatorTelemetry(detailId, user.workId, 1000); if (!cancelled) { setDetail(rows); setDetailError(''); } }
      catch { if (!cancelled) setDetailError('Sensor history is unavailable. Current readings are shown separately.'); }
      finally { if (!cancelled) timer = window.setTimeout(refresh, 5000); }
    };
    void refresh();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [detailId, range, user.workId]);

  function applyWindow() {
    const since = new Date(from), until = new Date(to);
    if (!from || !to || !Number.isFinite(+since) || !Number.isFinite(+until) || since > until) { setValidation('Choose a valid start and end time, with start before end.'); return; }
    if (+until - +since > 31 * 86400000) { setValidation('Select a window of 31 days or less.'); return; }
    setValidation(''); setRange({ since: since.toISOString(), until: until.toISOString() }); setRequest(n => n + 1);
  }
  const selectedId = detailId || scopedMachines[0]?.machineId || '';
  const coolant = report.reading(selectedId, 'Coolant Temperature') || report.reading(selectedId, 'Coolant Temp');
  const temperature = coolant || report.reading(selectedId, 'Temperature');
  const trendName = temperature?.sensor_name || 'Temperature';
  const trendRows = (range ? report.rows : [...detail, ...report.latest]).filter(r => r.machine_id === selectedId && r.sensor_name === trendName && numericReading(r.sensor_value) !== undefined);
  const trend = [...new Map(trendRows.map(r => [r.timestamp, { timestamp: r.timestamp, value: numericReading(r.sensor_value)! }])).values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const latestAge = report.latestTimestamp ? Date.now() - Date.parse(report.latestTimestamp) : Infinity;
  const reportStatus = range ? 'Historical window' : error ? 'Connection interrupted' : latestAge > 30000 ? 'Last saved snapshot' : 'Live saved readings';
  const unitValue = (sensor: string) => { const row = report.reading(selectedId, sensor); const value = numericReading(row?.sensor_value); return value === undefined ? 'Unavailable' : `${fmt(value, 2)} ${row?.sensor_unit || ''}`; };

  const independentSignals = ['RPM', 'Vibration', 'Pressure', 'Motor Temperature', 'Coolant Flow', 'Current', 'Voltage', 'Torque'];
  const signalHistory = range ? report.rows : [...detail, ...report.latest];
  const independentTrends = independentSignals.flatMap(name => {
    const current = report.reading(selectedId, name);
    if (!current) return [];
    const points = signalHistory.filter(r => r.machine_id === selectedId && r.sensor_name === name && numericReading(r.sensor_value) !== undefined);
    const rows = [...new Map(points.map(r => [r.timestamp, { timestamp: r.timestamp, value: numericReading(r.sensor_value)! }])).values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    return [{ name, unit: current.sensor_unit, min: current.expected_min, max: current.expected_max, rows }];
  });
  const roleStyle = {
    Operator: { eyebrow: 'Machine execution', description: 'Your station, production progress and immediate machine condition.', color: 'border-teal-200 from-teal-50 to-white' },
    Supervisor: { eyebrow: 'Floor coordination', description: 'Find the stations needing attention and coordinate the next response.', color: 'border-amber-200 from-amber-50 to-white' },
    Manager: { eyebrow: 'Plant performance', description: 'Compare plant output, yield and the risks requiring a decision.', color: 'border-indigo-200 from-indigo-50 to-white' },
    Admin: { eyebrow: 'Access & governance', description: 'Manage accounts, inspect audit history and verify system coverage.', color: 'border-rose-200 from-rose-50 to-white' },
  'Super Admin': { eyebrow: 'Access & governance', description: 'Manage accounts, inspect audit history and verify system coverage.', color: 'border-rose-200 from-rose-50 to-white' },
    Maintenance: { eyebrow: 'Equipment diagnostics', description: 'Diagnose faults and progress assigned maintenance work.', color: 'border-violet-200 from-violet-50 to-white' },
  }[user.role];
  return <div className="space-y-4" aria-label={`${user.role} report dashboard`}>
    <section className={`${panel} bg-gradient-to-r ${roleStyle.color}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sky-700">{roleStyle.eyebrow}</p><h2 className="mt-1 text-xl font-semibold">{user.role} Dashboard</h2><p className="mt-1 text-xs text-slate-600">{roleStyle.description}</p></div><span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-800">{reportStatus}</span></div><p className="mt-3 text-[11px] text-slate-500">Latest selected reading: {report.latestTimestamp ? new Date(report.latestTimestamp).toLocaleString() : 'No saved reading'} · {range ? 'Fixed window until you apply or change filters.' : 'Current snapshots refresh every second while this tab is open.'}</p></section>
    {user.role === 'Manager' && <button onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold text-indigo-800">{filtersOpen ? 'Hide plant and date filters' : 'Filter plants, lines and dates'}</button>}
    <div className={`grid min-w-0 gap-4 ${user.role === 'Operator' || user.role === 'Manager' ? '' : 'lg:grid-cols-[230px_minmax(0,1fr)]'}`}>
      <aside hidden={!filtersOpen} className={`${!filtersOpen ? '!hidden' : ''} ${panel} self-start gap-4 ${user.role === 'Operator' || user.role === 'Manager' ? 'grid sm:grid-cols-2 xl:grid-cols-4' : 'space-y-4 lg:sticky lg:top-28'}`} aria-label="Report slicers">
        <h3 className="flex items-center gap-2 text-sm font-semibold sm:col-span-2 xl:col-span-4"><Filter size={15} />Filter report</h3>
        <label className="block space-y-1 text-xs text-slate-600"><span>Plant</span><select aria-label="Report plant" className={input} value={plant} onChange={e => { setPlant(e.target.value); setLine('ALL'); setMachineId('ALL'); }}><option value="ALL">All authorized plants</option>{plants.map(p => <option key={p}>{p}</option>)}</select></label>
        <label className="block space-y-1 text-xs text-slate-600"><span>Production line</span><select aria-label="Report production line" className={input} value={line} onChange={e => { setLine(e.target.value); setMachineId('ALL'); }}><option value="ALL">All lines</option>{lines.map(l => <option key={l}>{l}</option>)}</select></label>
        <fieldset><legend className="text-xs font-semibold">Machine slicer</legend><input aria-label="Search report machines" className={`${input} mt-2`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machine" /><div className="mt-2 max-h-48 space-y-1 overflow-auto text-xs"><label className="flex items-center gap-2 rounded-lg p-2 hover:bg-sky-50"><input type="radio" name="reportMachine" checked={machineId === 'ALL'} onChange={() => setMachineId('ALL')} />{user.role === 'Operator' ? 'Assigned station' : `All ${lineMachines.length} machines`}</label>{lineMachines.filter(m => `${m.machineId} ${m.machineCode} ${m.displayName}`.toLowerCase().includes(search.toLowerCase())).map(m => <label key={m.machineId} className="flex items-start gap-2 rounded-lg p-2 hover:bg-sky-50"><input className="mt-0.5" type="radio" name="reportMachine" checked={machineId === m.machineId} onChange={() => setMachineId(m.machineId)} /><span>{m.machineCode}<small className="block text-[10px] text-slate-500">{m.machineId}</small></span></label>)}</div></fieldset>
        <div className="space-y-2 border-t border-slate-100 pt-3"><h4 className="flex items-center gap-2 text-xs font-semibold"><CalendarDays size={14} />Recorded date and time</h4><label className="block text-[11px] text-slate-500">From<input aria-label="Report from" type="datetime-local" className={`${input} mt-1`} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="block text-[11px] text-slate-500">To<input aria-label="Report to" type="datetime-local" className={`${input} mt-1`} value={to} onChange={e => setTo(e.target.value)} /></label><p className="text-[10px] text-slate-500">Times use your browser local time. Maximum 31 days; up to 1,000 records per machine.</p><button disabled={loading} onClick={applyWindow} className="w-full rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Loading window…' : 'Apply window'}</button><button onClick={() => { setRange(null); setValidation(''); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"><RefreshCw size={13} />Return to live</button>{validation && <p role="alert" className="text-xs text-rose-700">{validation}</p>}</div>
        <button onClick={() => { setPlant('ALL'); setLine('ALL'); setMachineId('ALL'); setSearch(''); setRange(null); setValidation(''); }} className="text-xs font-semibold text-sky-700">Clear all filters</button>
      </aside>
      <main className="min-w-0 space-y-4" aria-label="Report visuals">
        {!range && user.role === 'Operator' && <ShiftOperations machineId={scopedMachines[0]?.machineId}/>}
        {!range && user.role === 'Maintenance' && <MaintenanceTicketClosure user={user}/>}
        {!range && user.role === 'Maintenance' && <MachineOperations machines={scopedMachines} role="Maintenance"/>}
        {!range && !['Admin', 'Super Admin'].includes(user.role) && <OperationsModelPanel rows={readings} ids={scopedMachines.map(m => m.machineId)} />}
        {(range ? historyError : error || detailError) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{range ? historyError : error || detailError}</p>}
        {range && <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">{loading ? 'Loading saved records. Charts will appear when the selected scope finishes loading.' : historyNote}</p>}
        {!report.rows.length && !loading && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No saved readings in this selection. Select another window or resume machine delivery when your cleanup is finished.</p>}

        {['Admin', 'Super Admin'].includes(user.role) ? <AdminWorkspace report={report} machines={scopedMachines} navigate={onNavigate} /> : user.role === 'Supervisor' ? <SupervisorWorkspace report={report} machines={scopedMachines} selectMachine={setMachineId} /> : user.role === 'Manager' ? <ManagerWorkspace report={report} machines={scopedMachines} /> : <>

          <section className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-6" aria-label="Operator production station"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-teal-700">My station · current production</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-2xl font-semibold">{scopedMachines[0]?.machineCode || 'No assigned station'}</h3><p className="mt-1 text-xs text-slate-500">{user.fullName} · {user.workId}</p></div><div className="text-right"><strong className="text-4xl font-semibold text-teal-900">{report.productionMachines ? fmt(report.actual, 0) : '—'}</strong><span className="ml-2 text-sm text-slate-500">/ {report.target ? fmt(report.target, 0) : '—'} parts</span></div></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-teal-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${report.target ? Math.min(100, report.actual / report.target * 100) : 0}%` }} /></div><p className="mt-2 text-xs text-teal-800">{report.target && report.productionMachines ? `${Math.max(0, report.target - report.actual).toLocaleString()} parts remaining · ${Math.round(report.actual / report.target * 100)}% of target` : 'Waiting for complete production counters'}</p></section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Motor speed" value={unitValue('RPM')} foot={scopedMachines[0]?.machineCode || 'No assigned machine'} /><Metric label="Motor load" value={unitValue('Motor Load')} foot="Latest percentage reading" /><Metric label="Coolant temperature" value={coolant ? `${fmt(numericReading(coolant.sensor_value))} ${coolant.sensor_unit}` : 'Unavailable'} foot={coolant ? 'Dedicated coolant sensor' : 'Machine temperature is not coolant temperature'} /><Metric label="Assigned machines" value={fmt(scopedMachines.length, 0)} foot="Only your authorized station" /></div>
          <div className="grid gap-4 xl:grid-cols-2"><LoadGauge row={report.reading(selectedId, 'Motor Load')} /><SensorTrendChart title={coolant ? 'Coolant temperature over time' : 'Machine temperature over time'} description={coolant ? 'Recorded °C readings. Temperatures are not summed.' : 'Recorded machine temperature in °C; a coolant sensor is unavailable.'} unit={temperature?.sensor_unit || '°C'} rows={trend} /></div>
          <section className="space-y-3" aria-label="Independent machine signal trends"><h3 className="text-base font-semibold">Individual sensor histories</h3><p className="text-xs text-slate-500">Each signal keeps its own chart and unit. Current values refresh every second; saved trend history refreshes every five seconds.</p><div className="grid gap-4 xl:grid-cols-2">{independentTrends.map((signal, index) => <SensorTrendChart key={`${selectedId}/${signal.name}`} title={signal.name} description={`Configured range ${signal.min}–${signal.max} ${signal.unit}. Timestamped saved readings.`} unit={signal.unit} rows={signal.rows} color={['#198c87', '#5382c3', '#9772bb', '#d48c4f'][index % 4]} />)}</div></section>
          <div className="grid gap-4 sm:grid-cols-3"><Metric label="Total parts" value={report.productionMachines ? `${fmt(report.actual, 0)} parts` : 'Unavailable'} foot="Latest good and rejected counters" /><Metric label="Shift target" value={report.target ? `${fmt(report.target, 0)} parts` : 'Unavailable'} foot="Latest target snapshot" /><Metric label="Good and rejected" value={report.productionMachines ? `${fmt(report.good, 0)} / ${fmt(report.scrap, 0)}` : 'Unavailable'} foot="Modeled counters from the configured source" /></div>
        </>}

        {!['Admin', 'Super Admin'].includes(user.role) && <section className={panel}><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 size={16} />{user.role === 'Operator' ? 'My machine incidents' : 'Incidents in the selected scope'}</h3><span className="text-xs text-slate-500">{report.scopedIncidents.length} current records</span></div><p className="mt-1 text-xs text-slate-500">Current incident state; the recorded-date slicer applies to telemetry, not incident creation dates.</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-200 text-slate-500"><tr>{['Incident', 'Machine', 'Description', 'Severity', 'Status'].map(h => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{report.scopedIncidents.map(i => <tr key={i.id} className="border-b border-slate-100"><td className="whitespace-nowrap px-2 py-3 font-medium">{i.incidentCode}</td><td className="whitespace-nowrap px-2 py-3">{i.machineCode}</td><td className="min-w-40 px-2 py-3">{i.symptomDescription}</td><td className="px-2 py-3">{i.severity}</td><td className="whitespace-nowrap px-2 py-3">{i.status}</td></tr>)}</tbody></table>{!report.scopedIncidents.length && <p className="py-5 text-center text-xs text-slate-500">No incident records for the selected machines.</p>}</div></section>}
        <p className="text-[11px] leading-relaxed text-slate-500">Source: authorized FactoryPulse records. Layout adapted from your individual report screenshots. Counters remain modeled where supplied by the Simulator; no physical-factory or Microsoft Power BI connection is implied.</p>
      </main>
    </div>
  </div>;
}

