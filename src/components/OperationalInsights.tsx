import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import {FactoryChat} from './FactoryChat';

const panel = 'rounded-xl border border-slate-800 bg-[#0c1424] p-4 sm:p-5';
const field = 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200';
const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;

export function OperationalInsights({ machineId, isAdmin }: { machineId?: string; isAdmin: boolean }) {
  const [minutes, setMinutes] = useState(60);
  const [downtime, setDowntime] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, busy = false;
    setDowntime(null); setError('');
    const refresh = async () => {
      if (busy || !machineId) return;
      busy = true;
      try {
        const result = await apiClient.getMachineDowntime(machineId, minutes);
        if (active) { setDowntime(result); setError(''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load downtime'); }
      finally { busy = false; }
    };
    refresh(); const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [machineId, minutes]);
  useEffect(() => {
    if (!isAdmin) return;
    let active = true, busy = false;
    const refresh = async () => {
      if (busy) return; busy = true;
      try { const result = await apiClient.getSystemHealth(); if (active) setHealth(result); }
      catch { if (active) setHealth({ error: 'Health checks are temporarily unavailable.' }); }
      finally { busy = false; }
    };
    refresh(); const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAdmin]);
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className={panel} aria-label="Recorded downtime">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Recorded downtime · {machineId || 'select a machine'}</h2><select aria-label="Downtime reporting window" value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={field}><option value={15}>Last 15 minutes</option><option value={60}>Last hour</option><option value={1440}>Last 24 hours</option></select></div>
      {error && <p role="status" className="mt-3 text-xs text-amber-300">{error}</p>}
      {downtime ? <><div className="my-4 grid grid-cols-2 gap-3"><div><p className="text-xs text-slate-400">Explicit stopped time</p><strong className="text-2xl text-cyan-200">{duration(downtime.total_seconds)}</strong></div><div><p className="text-xs text-slate-400">Current confirmed stop</p><strong className="text-2xl text-amber-200">{duration(downtime.current_downtime_seconds)}</strong></div></div><p className="text-xs text-slate-400">{downtime.observed_timestamps} recorded timestamps examined. {downtime.basis}</p><h3 className="mt-4 text-xs font-semibold">Downtime by analysis round</h3><p className="mt-1 text-[11px] text-slate-500">{downtime.round_definition}</p><div className="mt-3 space-y-2">{downtime.rounds.slice(-8).map((round: any) => <div key={round.round_id}><div className="flex justify-between text-xs text-slate-300"><span>{new Date(round.start).toLocaleTimeString()}</span><span>{duration(round.downtime_seconds)}</span></div><div className="mt-1 h-2 rounded bg-slate-800"><div className="h-full rounded bg-amber-400" style={{ width: `${Math.min(100, round.downtime_seconds / ((new Date(round.end).getTime() - new Date(round.start).getTime()) / 1000) * 100)}%` }}/></div></div>)}{!downtime.intervals.length && <p className="text-xs text-slate-400">No explicit stopped intervals were recorded in this window.</p>}</div></> : <p className="py-6 text-xs text-slate-400">{machineId ? 'Loading recorded states…' : 'Select a machine to inspect its recorded downtime.'}</p>}
    </section>
    <FactoryChat machineId={machineId}/>
    {isAdmin && <section className={`${panel} xl:col-span-2`} aria-label="Data Pipeline Status"><h2 className="text-sm font-semibold">Data Pipeline Status · Admin</h2>{health && !health.error ? <><div className="my-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Backend', health.backend], ['MySQL', health.mysql], ['Machines receiving', health.machines_receiving], ['Events · 15 min', health.events_last_15_minutes]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-400">{label}</p><strong className="text-lg text-teal-300">{value}</strong></div>)}</div><p className="text-xs text-slate-400">Last SQL ingestion: {health.latest_ingestion ? new Date(health.latest_ingestion).toLocaleString() : 'None'} · {health.stale_machines} machines with stale saved data.</p><p className="mt-2 text-xs text-amber-200">Power BI: {health.power_bi.status} — {health.power_bi.reason}</p></> : <p className="mt-3 text-xs text-slate-400">{health?.error || 'Checking actual pipeline health…'}</p>}</section>}
  </div>;
}
