import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { Incident, UserProfile } from '../types';

/** Uses the incident transaction, which completes linked orders in the same commit. */
export function MaintenanceTicketClosure({ user, onSaved }: { user: UserProfile; onSaved?: () => void }) {
  const [tickets, setTickets] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (user.role !== 'Maintenance') return;
    let active = true;
    const load = () => apiClient.getIncidents().then(rows => { if (active) { setTickets(rows); setError(''); } }).catch(e => { if (active) setError(e.message); });
    load(); const timer = window.setInterval(load, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user.id, user.role]);
  if (user.role !== 'Maintenance') return null;
  const assigned = tickets.filter(i => i.assignedToId === user.id && i.status !== 'Closed');
  const resolve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || busy || notes.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      const updated = await apiClient.closeIncident(selected.id, notes.trim(), user);
      setTickets(rows => rows.map(row => row.id === updated.id ? updated : row));
      setMessage(`${updated.incidentCode} resolved. Linked work orders are completed.`);
      setSelected(null); setNotes('');
      window.dispatchEvent(new Event('factorypulse:incidents-changed'));
      onSaved?.();
    } catch (e: any) { setError(e.message || 'Unable to close ticket. Please retry.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm" aria-label="Complete assigned incidents">
    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><CheckCircle2 size={20} className="text-emerald-700"/>Complete repair &amp; close ticket</h2>
    <p className="mt-1 text-xs text-slate-600">Close your assigned incident after checking the repair. Resolution notes, your name and the closure time are saved in MySQL. Other roles see it as resolved on their next refresh.</p>
    {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="mt-3 space-y-2">{assigned.map(ticket => <article key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <div className="min-w-0"><strong className="text-sm">{ticket.incidentCode} · {ticket.machineCode}</strong><p className="mt-1 text-xs text-slate-600">{ticket.severity} · {ticket.symptomDescription}</p></div>
      <button onClick={() => { setSelected(ticket); setNotes(''); setError(''); }} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Close ticket · Resolve incident</button>
    </article>)}{!assigned.length && !error && <p className="py-3 text-sm text-slate-500">No open incidents assigned to you. A supervisor must assign a ticket before you can close it.</p>}</div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-500/30 p-4"><form onSubmit={resolve} role="dialog" aria-modal="true" aria-labelledby="repair-close-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between gap-2"><h3 id="repair-close-title" className="font-semibold">Resolve {selected.incidentCode}</h3><button type="button" disabled={busy} aria-label="Cancel ticket closure" onClick={() => setSelected(null)}><X size={20}/></button></div>
      <p className="mt-2 text-xs text-slate-600">This resolves the incident and completes all its linked work orders. It does not clear a live sensor fault or start the machine.</p>
      <label className="mt-4 block text-sm font-medium">Repair and verification notes<textarea autoFocus required minLength={3} maxLength={8000} rows={4} value={notes} onChange={e => setNotes(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Describe the repair and checks performed."/></label>
      {error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
      <div className="mt-4 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setSelected(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy || notes.trim().length < 3} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Confirm resolution & close ticket'}</button></div>
    </form></div>}
  </section>;
}
