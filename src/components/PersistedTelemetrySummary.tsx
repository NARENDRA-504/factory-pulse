import React, { useEffect, useState } from 'react';
import { Activity, Radio } from 'lucide-react';
import { Machine, UserProfile } from '../types';
import { apiClient, PersistedSimulatorReading } from '../services/apiClient';

export const PersistedTelemetrySummary: React.FC<{ machine?: Machine; user: UserProfile }> = ({ machine, user }) => {
  const [readings, setReadings] = useState<PersistedSimulatorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReadings([]);
    setError(null);
    const refresh = async () => {
      if (!machine?.machineId) {
        setReadings([]);
        setError('No machine is selected.');
        setLoading(false);
        return;
      }
      try {
        const result = await apiClient.getPersistedSimulatorTelemetry(machine.machineId, user.workId, 100);
        if (!cancelled) { setReadings(result); setError(null); }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load saved telemetry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [machine?.machineId, user.workId]);

  const latestBySensor = Array.from(new Set(readings.map((reading) => reading.sensor_name)))
    .map((sensor) => readings.find((reading) => reading.sensor_name === sensor)!)
    .filter(Boolean);

  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-cyan-700"/><h2 className="text-sm font-semibold text-slate-900">Machine readings</h2></div>
        <p className="mt-1 text-xs text-slate-600">{machine ? `${machine.machineId} · ${machine.displayName || machine.name}` : 'Selected machine'} · refreshed every 10 seconds</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Activity className="h-3.5 w-3.5"/>{readings.length} saved readings</span>
    </div>
    {loading && readings.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50/70 p-3 text-xs text-slate-700">Connecting to the telemetry API…</p>
      : error ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">Saved telemetry unavailable: {error}</p>
        : readings.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No readings are stored for this machine yet. New values will appear here when received.</p>
          : <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {latestBySensor.map((reading) => <div key={reading.reading_id} className="rounded-lg border border-slate-200 bg-slate-100/50 p-3">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] text-slate-600">{reading.sensor_name}</span><span className={`rounded px-1.5 py-0.5 text-[9px] ${reading.machine_status === 'CRITICAL' ? 'bg-rose-50 text-rose-800' : reading.machine_status === 'WARNING' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{reading.machine_status}</span></div>
              <div className="mt-1 font-mono text-lg font-semibold text-cyan-800">{reading.sensor_value ?? '—'} <span className="text-xs font-normal text-slate-600">{reading.sensor_unit}</span></div>
              <p className="mt-1 text-[10px] text-slate-500">{new Date(reading.timestamp).toLocaleString()} · {reading.data_quality}{reading.fault_mode ? ` · ${reading.fault_mode}` : ''}</p>
            </div>)}
          </div>}
    {error && readings.length > 0 && <p className="mt-2 text-[10px] text-amber-800">Refresh warning: {error}</p>}
  </section>;
};
