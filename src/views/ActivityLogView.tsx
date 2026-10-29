import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';

type ActivityEvent = {
  id: number; employee_id?: number | null; employee_work_id?: string | null; employee_name?: string | null; role?: string | null;
  event_type: string; occurred_at_utc: string; occurred_at_local?: string; factory_time_zone?: string; session_id?: string | null;
  request_id?: string | null; details?: string | null;
  session_duration_seconds?: number | null; client_ip?: string | null; device_info?: string | null;
  resource_type?: string | null; resource_id?: string | null; changed_fields?: string[] | null;
};

export const ActivityLogView: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [factoryTimeZone, setFactoryTimeZone] = useState(import.meta.env.VITE_FACTORY_TIMEZONE || 'UTC');
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    setLoading(true); setError(null);
    try { const data = await apiClient.getActivityLog(250); setEvents(data.events); setFactoryTimeZone(data.factory_time_zone || 'UTC'); setDemoMode(Boolean(data.demo_mode)); }
    catch (reason: any) { setError(reason?.message || 'Activity log is unavailable.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const formatTime = (value: string, localValue?: string) => {
    if (localValue) return new Intl.DateTimeFormat(undefined, { timeZone: factoryTimeZone, dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(localValue));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
      timeZone: factoryTimeZone, dateStyle: 'medium', timeStyle: 'medium',
    }).format(parsed);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-mono uppercase tracking-[0.16em] text-rose-800">Admin · Governance</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Activity Log</h1><p className="mt-1 text-sm text-slate-600">Sign-in activity and audited operational changes. Times are displayed in {factoryTimeZone}.</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-500 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}/>Refresh log</button>
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><ShieldCheck className="h-4 w-4 text-teal-800"/><h2 className="text-sm font-semibold text-slate-900">Recorded events</h2><span className="ml-auto text-[11px] font-mono text-slate-500">Newest first · {events.length} shown</span></div>
        {demoMode && <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">Demo mode does not retain an audit log. Use the configured MySQL authentication service for durable activity records.</p>}
        {error ? <p role="alert" className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700">{error}</p> : loading ? <p className="p-8 text-center text-sm text-slate-600">Loading activity log…</p> : events.length === 0 ? <div className="p-10 text-center"><Activity className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-3 text-sm font-semibold text-slate-700">No recorded events available</p><p className="mt-1 text-xs text-slate-500">Configure the MySQL activity-log migration and authentication service to populate this page.</p></div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[1260px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Timestamp ({factoryTimeZone})</th><th className="px-4 py-3">Employee ID · Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">IP · Device</th><th className="px-4 py-3">Session / Request</th><th className="px-4 py-3">Changed resource</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.id} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">{formatTime(event.occurred_at_utc, event.occurred_at_local)}</td><td className="px-4 py-3 text-slate-800"><span className="font-mono text-slate-700">{event.employee_work_id || (event.employee_id ? `#${event.employee_id}` : 'Unknown')}</span><span className="ml-2">{event.employee_name || 'Unknown employee'}</span></td><td className="px-4 py-3 text-slate-600">{event.role || '—'}</td><td className="px-4 py-3"><span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-700">{event.event_type.replaceAll('_', ' ')}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{typeof event.session_duration_seconds === 'number' ? `${Math.floor(event.session_duration_seconds / 60)}m ${event.session_duration_seconds % 60}s` : 'Not captured'}</td><td className="max-w-[220px] px-4 py-3 text-slate-600"><span className="block font-mono">{event.client_ip || 'Not captured'}</span><span className="mt-1 block truncate text-[10px] text-slate-500" title={event.device_info || ''}>{event.device_info || 'Device not captured'}</span></td><td className="px-4 py-3 font-mono text-[10px] text-slate-500"><span className="block">{event.session_id ? `S ${event.session_id}` : '—'}</span>{event.request_id && <span className="mt-1 block">R {event.request_id}</span>}</td><td className="max-w-[200px] px-4 py-3 text-slate-600">{event.resource_type ? <><span className="font-medium text-slate-700">{event.resource_type}</span><span className="ml-1 font-mono text-[10px]">{event.resource_id || ''}</span>{event.changed_fields?.length ? <span className="mt-1 block text-[10px]">Fields: {event.changed_fields.join(', ')}</span> : null}</> : '—'}</td><td className="max-w-xs truncate px-4 py-3 text-slate-600" title={event.details || ''}>{event.details || '—'}</td></tr>)}</tbody></table></div>
        )}
        <p className="border-t border-slate-200 px-4 py-3 text-[11px] leading-relaxed text-slate-500">Audit timestamps are stored in UTC. Failed sign-ins for unknown employee IDs are logged without employee identity. This log is append-only through the application API.</p>
      </section>
    </div>
  );
};
