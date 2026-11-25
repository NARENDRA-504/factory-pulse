import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { AppScreen } from '../roleNavigation';
import { UserProfile } from '../types';

type Procedure = {response_plan?: {summary:string;owner:string;immediate_action:string;capture:string[];release_gate:string;avoid:string}; selection_reason?:string; assessment?: {fresh_valid:number;unreliable:number;notice:string;checks:{sensor_name:string;sensor_value:number|null;sensor_unit:string;comparison:string;configured_range:string;usable:boolean;issues:string[]}[]}; status: string; notice: string; machine_id?: string; level?: string; detection_source?: string; sources: {id: string; title: string; revision: string; approval_status?:string; review_due?:string; section: string; source: string; steps: string[]}[]};
type Guidance = {notice: string; source: string; revision: string; procedure?: Procedure; sections: {title: string; steps: string[]}[]};
export function SopGuidancePanel({screen, user, machineId}: {screen: AppScreen; user: UserProfile; machineId?: string}) {
  const [data, setData] = useState<Guidance | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [topic, setTopic] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    apiClient.getSopGuidance(screen, controller.signal, machineId, topic).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('SOP instructions unavailable. Refer to your approved site procedure or supervisor.');
    });
    return () => controller.abort();
  }, [screen, user.workId, user.role, machineId, topic, retry]);
  const moduleSection = data?.sections[data.sections.length - 1];
  return <aside className="fp-sop-panel mb-5 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-slate-800" aria-label="SOP instructions">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold text-teal-900"><BookOpen className="h-4 w-4 shrink-0"/>SOP · What to do next</h2>
        <p className="mt-1 text-sm">{error || moduleSection?.steps[0] || 'Loading instructions for this module…'}</p>
        <span className="mt-1 inline-block text-[11px] text-slate-500">Site approval required</span>{data?.procedure?.response_plan && ['critical', 'suspect', 'warning'].includes((data.procedure.level || '').toLowerCase()) && <p className="fp-sop-summary" role="alert">{data.procedure.response_plan.summary}</p>}
      </div>
      {error ? <button type="button" onClick={() => setRetry(n => n + 1)} aria-label="Retry SOP instructions" className="rounded-lg border border-teal-200 bg-white p-2"><RefreshCw className="h-4 w-4"/></button>
        : <button type="button" onClick={() => setExpanded(v => !v)} disabled={!data} aria-expanded={expanded} aria-controls="sop-instructions" className="flex shrink-0 items-center gap-1 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-medium disabled:opacity-50">{expanded ? 'Hide steps' : 'View steps'}{expanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</button>}
    </div>
    {expanded && data && <div id="sop-instructions" className="mt-4 border-t border-teal-200 pt-3">
      <p className="mb-3 text-xs text-slate-600">{data.notice}</p><div className="mb-3 flex flex-wrap items-center gap-2"><label className="text-xs font-medium">Procedure topic <select aria-label="SOP topic" value={topic} onChange={e=>setTopic(e.target.value)} className="ml-2 rounded-lg border border-teal-200 bg-white p-2"><option value="">Reported condition / general</option><option value="temperature">Temperature</option><option value="vibration">Vibration</option><option value="rpm">Spindle speed / RPM</option><option value="pressure">Pressure</option><option value="coolant">Coolant flow / temperature</option><option value="electrical">Current / voltage</option><option value="torque load">Torque / load</option><option value="missing quality">Missing / unreliable data</option></select></label><button type="button" onClick={()=>setRetry(n=>n+1)} className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs">Refresh guidance</button></div>
      {data.procedure?.response_plan&&<section className="fp-response-plan mb-4" aria-label="Evidence-based response plan"><h3 className="text-sm font-semibold">Recommended next actions · {user.role}</h3><p className="mt-2 text-sm">{data.procedure.response_plan.summary}</p><div className="fp-response-grid"><div><small>First response</small><p>{data.procedure.response_plan.immediate_action}</p></div><div><small>Responsible team</small><p>{data.procedure.response_plan.owner}</p></div><div><small>Capture for the investigation</small><ul className="list-disc pl-4 text-xs leading-6">{data.procedure.response_plan.capture.map(item=><li key={item}>{item}</li>)}</ul></div><div><small>Before restart</small><p>{data.procedure.response_plan.release_gate}</p></div></div><p className="mt-3 text-xs text-amber-900">{data.procedure.response_plan.avoid}</p><details className="mt-3"><summary className="cursor-pointer text-xs font-medium">Why this guidance was selected</summary><p className="mt-2 text-xs">{data.procedure.selection_reason}. Fresh validated channels: {data.procedure.assessment?.fresh_valid??0}; unreliable channels: {data.procedure.assessment?.unreliable??0}.</p><div className="fp-evidence-list">{data.procedure.assessment?.checks.map(row=><div key={row.sensor_name}><strong>{row.sensor_name}</strong> · {row.sensor_value??'Unavailable'} {row.sensor_unit} · {row.usable?row.comparison.replaceAll('_',' '):row.issues.join(', ').replaceAll('_',' ')}<p className="mt-1">Configured comparison: {row.configured_range}</p></div>)}</div><p className="mt-2 text-xs">{data.procedure.assessment?.notice}</p></details></section>}
      {data.procedure && <section className="mb-4 rounded-lg border border-amber-200 bg-white p-3" aria-label="Retrieved SOP procedure"><p className="text-xs font-semibold">{data.procedure.machine_id || 'Select a machine for equipment-specific matching'} · Received status: {data.procedure.level || 'Unavailable'}</p><p className="mt-2 text-sm">{data.procedure.notice}</p>{data.procedure.sources.map(source=><div className="mt-3" key={source.id}><h3 className="text-sm font-semibold">{source.title} · {source.section}</h3><p className="mt-1 text-xs text-amber-800">{source.approval_status==='approved'?'Approved applicable procedure':'Training guidance · approval pending'} · Review due: {source.review_due||'Not set'}</p><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{source.steps.map(step=><li key={step}>{step}</li>)}</ol><p className="mt-2 break-words text-xs text-slate-600">[{source.id}] Revision {source.revision} · {source.source}</p></div>)}<p className="mt-2 text-xs text-slate-600">{data.procedure.detection_source} Refresh to update the evidence. SOP retrieval sends no notifications and controls no equipment.</p></section>}
      <div className={`grid gap-4 ${data.sections.length > 1 ? 'md:grid-cols-2' : ''}`}>{data.sections.map(section => <section key={section.title}><h3 className="text-sm font-semibold capitalize">{section.title} instructions</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">{section.steps.map(step => <li key={step}>{step}</li>)}</ol></section>)}</div>
      <p className="mt-3 break-words text-xs text-slate-600">Source: {data.source} · Revision {data.revision} · General module instructions; the response plan uses only the validated readings shown above.</p>
    </div>}
  </aside>;
}
