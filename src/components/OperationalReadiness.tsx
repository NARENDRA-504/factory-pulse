import {DemoWalkthrough} from './DemoWalkthrough';
import {FiniteDemoControl} from './FiniteDemoControl';
import {AppScreen} from '../roleNavigation';
import { SensorReliabilityPanel, MaintenanceEffectiveness } from './ReliabilityPanels';

import React,{useEffect,useState} from 'react';

import {apiClient} from '../services/apiClient';

import {UserProfile} from '../types';

const box='min-w-0 rounded-xl border border-slate-200 bg-white p-5';

const button='rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900 disabled:opacity-40';

const err=(e:unknown)=>e instanceof Error?e.message:'Service unavailable';

export function OperationalReadiness({user,onNavigate}:{user:UserProfile;onNavigate?:(screen:AppScreen)=>void}) {

 const admin=['Admin','Super Admin'].includes(user.role);
 const endpoint=admin?'operations/pipeline-monitor':'operations/readiness';
 const [roundTrip,setRoundTrip]=useState<number|null>(null);
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[mid,setMid]=useState(''),[prediction,setPrediction]=useState<any>(null),[checking,setChecking]=useState(false),[check,setCheck]=useState('');

 useEffect(()=>{let active=true,timer:number;const load=async()=>{try{const started=performance.now();const d=await apiClient.operationRequest(endpoint);if(active){setRoundTrip(Math.round(performance.now()-started));setData(d);setError('');setMid(m=>m||d.machines?.[0]?.machine_id||'');}}catch(e){if(active)setError(err(e));}finally{if(active)timer=window.setTimeout(load,5000);}};load();return()=>{active=false;clearTimeout(timer);};},[user.id,user.role]);

 const demoCheck=async()=>{setChecking(true);setCheck('Checking MySQL and observing saved reading IDs for six seconds…');try{const a=await apiClient.operationRequest(endpoint);await new Promise(r=>setTimeout(r,6000));const b=await apiClient.operationRequest(endpoint);setData(b);setCheck(b.mysql!=='reachable'?'Needs attention: MySQL diagnostics failed.':a.fingerprint!==b.fingerprint?'PASS: MySQL is reachable and saved readings advanced during the six-second check.':'MySQL reachable; no saved reading changed during six seconds. Check whether the selected machines are running and delivery is enabled.');}catch(e){setCheck(err(e));}finally{setChecking(false);}};

 const infer=async()=>{setPrediction(null);try{setPrediction(await apiClient.operationRequest('intelligence/health-model/'+encodeURIComponent(mid)));}catch(e){setPrediction({notice:err(e)});}};

 if(!admin)return <div className="space-y-5 text-slate-800"><header className={box}><h1 className="text-2xl font-semibold">Machine Status</h1><p className="mt-2 text-sm text-slate-600">Reading availability for your authorized machines.</p></header>{error&&<p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">Machine status is temporarily unavailable.</p>}{data&&<><section className={box}><h2 className="text-lg font-semibold">{data.status}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.machines.map((m:any)=><div key={m.machine_id} className="rounded-lg border border-slate-200 p-3"><strong>{m.machine_code}</strong><span className="ml-3 rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900">{m.status}</span></div>)}</div>{!data.machines.length&&<p className="mt-3 text-sm text-slate-600">No machines are assigned in your scope.</p>}<p className="mt-3 text-xs text-slate-500">Availability is separate from machine safety or operating condition.</p></section><DemoWalkthrough user={user} readiness={data} onNavigate={onNavigate}/>{data.machines.length>1&&<label className="block text-sm">Handover machine<select aria-label="Handover machine" value={mid} onChange={e=>setMid(e.target.value)} className="ml-3 rounded-lg border p-2">{data.machines.map((m:any)=><option key={m.machine_id} value={m.machine_id}>{m.machine_code}</option>)}</select></label>}{mid&&<HandoverPanel machineId={mid} canPublish={['Operator','Supervisor'].includes(user.role)} canAck={['Operator','Supervisor','Maintenance'].includes(user.role)}/>}</>}</div>;
 return <div className="space-y-5 text-slate-800"><header className={box}><h1 className="text-2xl font-semibold">Pipeline Monitor</h1><p className="mt-2 text-sm text-slate-600">Administrator-only infrastructure diagnostics. Checks are read-only and refresh every five seconds. No readings are generated, deleted or altered here.</p></header>

 {error&&<p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">Could not refresh the monitor. Displayed results may be out of date. {error}</p>}

 {data&&<><DemoWalkthrough user={user} readiness={data} onNavigate={onNavigate}/>{data.notice&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{data.notice}</p>}<section className={box}><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Live data pipeline · {data.monitor_state||data.status}</h2><button className={button} disabled={checking} onClick={demoCheck}>{checking?'Checking…':'Run presentation check'}</button></div>{check&&<p role="status" className="mt-3 rounded-lg bg-sky-50 p-3 text-sm">{check}</p>}

 <div className="mt-4 grid gap-3 sm:grid-cols-4">{[['MySQL',data.mysql],['Machines receiving',`${data.machines_receiving??'—'} / ${data.machines_in_scope??'—'}`],['Latest sensor streams',data.sensor_streams??'—'],['Database check',`${data.query_ms} ms`]].map(([k,v])=><div key={String(k)} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><strong className="mt-1 block text-xl">{v}</strong></div>)}</div>

 <p className="mt-3 text-sm text-slate-600">Latest observation: {data.latest_saved_at?new Date(data.latest_saved_at).toLocaleString():'No saved readings'} · Last checked: {new Date(data.checked_at).toLocaleTimeString()} · Monitor request: {roundTrip==null?'—':roundTrip+' ms'}</p>
 <p className="mt-3 text-xs text-slate-500">Latest saved observation-to-storage delay: median {data.ingestion_delay_ms?.median==null?'unavailable':`${Math.round(data.ingestion_delay_ms.median)} ms`}, p95 {data.ingestion_delay_ms?.p95==null?'unavailable':`${Math.round(data.ingestion_delay_ms.p95)} ms`}. Monitor request time measures this diagnostics request only. Browser chart delay is not measured; these values are not a full end-to-end timing. Future-dated readings: {data.future_dated_readings??'unavailable'}.</p>

 {data.sender&&<div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm"><strong>Sender: {data.sender.status}</strong>{data.sender.has_delivery_error&&<p className="mt-2 font-medium text-amber-800">A recent delivery error was reported. Check queued and retrying counts; error contents are not exposed.</p>}{data.sender.status==='reachable'?<p className="mt-1">Delivery {data.sender.paused?'paused':data.sender.ready?'ready':'not ready'} · queued {data.sender.pending??'—'} · retrying {data.sender.retrying??'—'} · failed {data.sender.failed??'—'} · delivered {data.sender.delivered??'—'}<span className="mt-1 block text-xs">Counts scope: {data.sender.counts_scope||'unavailable'}; these are not necessarily all-time totals.</span></p>:<p>{data.sender.notice}</p>}</div>}

 <div className="mt-4 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Machine','State','Reading age','Fresh / saved streams'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{data.machines.map((m:any)=><tr key={m.machine_id} className="border-t border-slate-100"><td className="p-2 font-medium">{m.machine_code}</td><td className="p-2">{m.state}</td><td className="p-2">{m.age_seconds==null?'—':`${m.age_seconds.toFixed(1)}s`}</td><td className="p-2">{m.fresh_streams} / {m.streams}</td></tr>)}</tbody></table></div></section>

 <section className={box}><h2 className="text-lg font-semibold">Machine-health model · {data.model.model||'unavailable'} · shadow mode</h2><p className="mt-2 text-sm text-slate-600">{data.model.notice} Predictions never create alerts or control machines. Existing threshold-based alerts remain separate.</p>{data.model.test&&<p className="mt-2 text-sm">Synthetic test accuracy {(100*data.model.test.accuracy).toFixed(1)}% · Critical recall {(100*data.model.test.recall.Critical).toFixed(1)}% · Critical precision {(100*data.model.test.precision.Critical).toFixed(1)}% · majority-class baseline {(100*data.model.majority_test_accuracy).toFixed(1)}%. High accuracy alone does not establish a useful fault detector.</p>}

 <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Machine<select aria-label="Readiness machine" className="mt-1 block max-w-full rounded-lg border bg-white p-2" value={mid} onChange={e=>{setMid(e.target.value);setPrediction(null);}}>{data.machines.map((m:any)=><option key={m.machine_id} value={m.machine_id}>{m.machine_code}</option>)}</select></label><button className={button} disabled={!mid} onClick={infer}>Check shadow prediction</button></div>

 {prediction&&<div role="status" className="mt-4 rounded-lg bg-violet-50 p-4 text-sm"><strong>{prediction.classification||prediction.status||'Unavailable'}</strong><p className="mt-2">{prediction.notice}</p>{prediction.missing_or_invalid_sensors?.length>0&&<p>Needs: {prediction.missing_or_invalid_sensors.join(', ')}</p>}{prediction.outside_training_range?.length>0&&<p className="mt-1 text-amber-800">Outside training ranges: {prediction.outside_training_range.join(', ')}</p>}</div>}</section>

 {mid&&<SensorReliabilityPanel machineId={mid}/>}

 {user.role!=='Operator'&&<MaintenanceEffectiveness/>}

 {mid&&<><FiniteDemoControl machineId={mid}/><HandoverPanel machineId={mid} canPublish={['Operator','Supervisor','Super Admin'].includes(user.role)} canAck={['Operator','Supervisor','Maintenance','Super Admin'].includes(user.role)}/></>}

 </>}

 </div>;

}



export function HandoverPanel({machineId,canPublish=false,canAck=false}:{machineId:string;canPublish?:boolean;canAck?:boolean}) {

 const [data,setData]=useState<any>(null),[note,setNote]=useState(''),[restrictions,setRestrictions]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);

 useEffect(()=>{setNote('');setRestrictions('');setMessage('');setError('');},[machineId]);

 useEffect(()=>{if(!machineId)return;let active=true;setData(null);apiClient.operationRequest('operations/handover/'+encodeURIComponent(machineId)).then(d=>{if(active){setData(d);setError('');}}).catch(e=>{if(active)setError(err(e));});return()=>{active=false;};},[machineId,revision]);

 const act=async(path:string,body:any)=>{setBusy(true);try{const d=await apiClient.operationRequest(path,'POST',body);setMessage(d.message);setError('');setNote('');setRevision(n=>n+1);}catch(e){setError(err(e));}finally{setBusy(false);}};

 const current=data?.shift?.machines?.[0];

 return <section className={box+' my-4'} aria-label="Structured handover"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">Shift handover · {data?.machine_code||machineId}</h2><button className={button} disabled={busy} onClick={()=>setRevision(n=>n+1)}>Refresh handover</button></div>

 {error&&<p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}{message&&<p role="status" className="mt-3 text-sm text-teal-800">{message}</p>}

 {data&&<><p className="mt-3 text-sm">{data.shift.label} · good {current?.good??'unavailable'} · scrap {current?.scrap??'unavailable'} · target {current?.target??'unavailable'} · open incidents {data.open_incidents.length} · recorded stopped time in last 12h {(data.downtime.total_seconds/60).toFixed(1)} minutes.</p><p className="mt-2 text-xs text-slate-500">{data.notice}</p>
 <div className="mt-4 grid gap-3 sm:grid-cols-2"><article className="rounded-lg bg-amber-50 p-3"><h3 className="font-semibold">Unresolved alarms / incidents</h3>{data.open_incidents.map((i:any)=><p className="mt-2 text-sm" key={i.id}>#{i.id} · {i.component_area} · {i.severity} · {i.status}</p>)}{!data.open_incidents.length&&<p className="mt-2 text-sm">No unresolved incidents in this machine scope.</p>}</article><article className="rounded-lg bg-sky-50 p-3"><h3 className="font-semibold">Unfinished repairs</h3>{(data.unfinished_work||[]).map((w:any)=><p className="mt-2 text-sm" key={w.order_code}>{w.order_code} · {w.priority} · {w.status}</p>)}{!data.unfinished_work?.length&&<p className="mt-2 text-sm">No unfinished work orders in this scope.</p>}</article></div><ul className="mt-3 list-disc pl-5 text-sm">{(data.next_actions||[]).map((a:string)=><li key={a}>{a}</li>)}</ul><p className="mt-2 text-xs text-slate-500">Queues show at most 20 current records each; handover history below preserves the earlier production snapshot.</p>

 {(canPublish||canAck)&&<div className="mt-4 space-y-3"><label className="block text-sm">Handover / acknowledgement note<input aria-label="Handover note" maxLength={120} value={note} onChange={e=>setNote(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"/></label>{canPublish&&<><label className="block text-sm">Restrictions or unresolved concerns<input aria-label="Handover restrictions" maxLength={70} value={restrictions} onChange={e=>setRestrictions(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"/></label><button disabled={busy||note.trim().length<8} className={button} onClick={()=>act('operations/handovers',{machine_id:machineId,note,restrictions})}>Publish handover snapshot</button></>}</div>}

 <div className="mt-4 space-y-3">{data.history.map((r:any)=><article key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm"><strong>{r.event==='handover_published'?'Published handover':'Acknowledged'} · {r.employee_work_id}</strong><p className="mt-1">{r.note}</p>{r.restrictions&&<p className="mt-1 text-amber-800">Restrictions: {r.restrictions}</p>}{r.event==='handover_published'&&<p className="mt-1 text-xs">Snapshot: {r.good??'—'} good · {r.scrap??'—'} scrap · {r.open_incidents} open incidents · {r.coverage}</p>}<p className="mt-1 text-xs text-slate-500">{new Date(r.at).toLocaleString()}</p>{canAck&&r.event==='handover_published'&&<button disabled={busy||note.trim().length<5} className={button+' mt-2'} onClick={()=>act(`operations/handovers/${r.id}/acknowledge`,{note})}>Acknowledge this handover</button>}</article>)}</div>{!data.history.length&&<p className="mt-4 text-sm text-slate-500">No published handovers in the recent authorized history.</p>}</>}

 </section>;

}



export function IncidentResponsePanel({incidentId,canAcknowledge}:{incidentId:number;canAcknowledge:boolean}) {

 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);

 useEffect(()=>{let active=true;setData(null);setError('');setNote('');setMessage('');apiClient.operationRequest(`operations/incidents/${incidentId}/response`).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(err(e));});return()=>{active=false;};},[incidentId]);

 const ackSop=async(source:any)=>{setBusy(true);try{const d=await apiClient.operationRequest(`operations/incidents/${incidentId}/sop-acknowledge`,'POST',{document_id:source.document_id,sha256:source.sha256,note});setMessage(d.message);setNote('');setData(await apiClient.operationRequest(`operations/incidents/${incidentId}/response`));}catch(e){setError(err(e));}finally{setBusy(false);}};

 const ack=async()=>{setBusy(true);try{const d=await apiClient.operationRequest(`operations/incidents/${incidentId}/acknowledge`,'POST',{note});setMessage(d.message);setError('');setNote('');setData(await apiClient.operationRequest(`operations/incidents/${incidentId}/response`));}catch(e){setError(err(e));}finally{setBusy(false);}};

 return <section className={box}><h3 className="font-semibold">Response steps & relevant SOP</h3>{error&&<p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}{data&&<><div className="mt-3 flex flex-wrap gap-2">{data.stages.map((s:any)=><span key={s.label} className={`rounded-full px-3 py-1 text-xs ${s.done?'bg-teal-50 text-teal-900':'bg-slate-100 text-slate-600'}`}>{s.done?'✓ ':''}{s.label}</span>)}</div>{data.acknowledgements&&<section aria-label="Alert acknowledgement tracking" className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-3"><h4 className="text-sm font-semibold">Alert acknowledgement tracking</h4><div className="mt-3 grid gap-2 sm:grid-cols-3">{data.acknowledgements.roles.map((r:any)=><div key={r.role} className="rounded-lg bg-white p-3"><strong className="text-sm">{r.role}</strong><p className="mt-1 text-xs">{r.status}</p>{r.first_at&&<p className="mt-1 text-xs text-slate-500">First: {new Date(r.first_at).toLocaleString()}</p>}</div>)}</div><p className="mt-2 text-xs text-slate-600">{data.acknowledgements.notice}</p></section>}<p className="mt-3 text-xs text-amber-800">{data.sop.notice}</p>{data.sop.sources.map((s:any)=><div key={s.id} className="mt-3"><h4 className="text-sm font-semibold">{s.title} · {s.section}</h4><p className="mt-1 text-xs text-slate-600">Revision {s.revision} · {s.approval_status}{s.approved_by?' · Approved by '+s.approved_by:''}{s.review_due?' · Review due '+s.review_due:''}</p><ol className="ml-5 mt-2 list-decimal text-sm">{s.steps.map((step:string,i:number)=><li key={i} className="mt-1">{step}</li>)}</ol></div>)}{canAcknowledge&&data.status!=='Closed'&&<div className="mt-4 flex flex-wrap gap-2"><input aria-label="Alert acknowledgement note" value={note} maxLength={120} onChange={e=>setNote(e.target.value)} placeholder="What have you checked?" className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/><button disabled={busy||note.trim().length<5} className={button} onClick={ack}>Acknowledge alert</button>{data.sop.sources.map((s:any)=><button key={s.id} disabled={busy||note.trim().length<5} className={button} onClick={()=>ackSop(s)}>Record guidance read · rev {s.revision}</button>)}</div>}{message&&<p role="status" className="mt-2 text-sm text-teal-800">{message}</p>}<ul className="mt-4 space-y-1 text-xs text-slate-500">{data.history.map((h:any,i:number)=><li key={i}>{h.event.replaceAll('_',' ')} · {h.employee_work_id||'System'} · {new Date(h.at).toLocaleString()}</li>)}</ul></>}</section>;

}

