import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { apiClient } from '../services/apiClient';

type Change = { id:number; operator_work_id:string; operator_name:string; from_machine_code:string; to_machine_code:string; reason:string; status:string; created_at_utc:string; review_note?:string; reviewed_by_name?:string };
type Options = { supervisor_work_id:string; current_machine:string; machines:{ machine_id:string; machine_code:string; name:string }[] };
export function MachineChangeView({user}:{user:UserProfile}) {
 const [rows,setRows]=useState<Change[]>([]),[options,setOptions]=useState<Options|null>(null);
 const [target,setTarget]=useState(''),[reason,setReason]=useState(''),[notes,setNotes]=useState<Record<number,string>>({});
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const operator=user.role==='Operator', reviewer=user.role==='Supervisor'||user.role==='Super Admin';
 const refresh=async()=>{
  try { const requests=await apiClient.operationRequest('machine-change/requests'); setRows(requests);
   if(operator)setOptions(await apiClient.operationRequest('machine-change/options'));setError('');
  }catch(e){setError(e instanceof Error?e.message:'Requests are unavailable');}finally{setLoading(false);}
 };
 useEffect(()=>{refresh();const timer=setInterval(refresh,10000);return()=>clearInterval(timer);},[user.id,user.role]);
 const pending=rows.some(r=>r.status==='Pending');
 const send=async(action:()=>Promise<any>)=>{setBusy(true);setError('');setMessage('');try{const result=await action();setMessage(result.message);await refresh();}catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}};
 const box='rounded-xl border border-slate-200 bg-white p-5';
 const input='w-full rounded-lg border border-slate-300 bg-white p-3 text-sm';
 return <div className="space-y-5 p-4 text-slate-800 md:p-6">
  <header className={box}><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Machine assignment</p><h1 className="mt-2 text-2xl font-semibold">{operator?'Request a machine change':reviewer?'Machine change approvals':'Machine change oversight'}</h1><p className="mt-2 text-sm text-slate-600">Requests stay within the Operator’s Supervisor team. Assignments change only after approval. A machine occupied by another Operator in the same shift requires coverage to be resolved first.</p></header>
  {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</p>}
  {message&&<p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-900">{message}</p>}
  {operator&&<form className={box+' space-y-4'} onSubmit={e=>{e.preventDefault();send(()=>apiClient.operationRequest('machine-change/requests','POST',{machine_id:target,reason}));}}>
   <p className="text-sm">Current machine: <strong>{options?.current_machine||user.assignedMachine||'Unassigned'}</strong> · Supervisor: <strong>{options?.supervisor_work_id||'Loading'}</strong></p>
   <label className="block text-sm">Requested machine<select required className={input+' mt-1'} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose another machine in your team</option>{options?.machines.map(m=><option key={m.machine_id} value={m.machine_id}>{m.machine_code} · {m.name}</option>)}</select></label>
   <label className="block text-sm">Reason<textarea required minLength={8} maxLength={1000} className={input+' mt-1'} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why a change is needed"/></label>
   <button disabled={busy||pending||!options} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending?'A request is already pending':'Send to Supervisor'}</button>
  </form>}
  <section className={box}><div className="flex items-center justify-between"><h2 className="font-semibold">Request history</h2><button type="button" disabled={busy} onClick={refresh} className="rounded-lg border px-3 py-2 text-sm">Refresh</button></div>
   {loading?<p className="py-4">Loading requests…</p>:!rows.length?<p className="py-4 text-sm text-slate-500">No machine-change requests in your authorized scope.</p>:<div className="mt-4 space-y-4">{rows.map(r=><article key={r.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{r.operator_name} · {r.operator_work_id}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{r.status}</span></div><p className="mt-2 text-sm font-semibold">{r.from_machine_code} → {r.to_machine_code}</p><p className="mt-2 whitespace-pre-wrap text-sm">{r.reason}</p><p className="mt-2 text-xs text-slate-500">#{r.id} · {new Date(r.created_at_utc).toLocaleString()}</p>{r.review_note&&<p className="mt-3 text-sm">Decision: {r.review_note} {r.reviewed_by_name&&`· ${r.reviewed_by_name}`}</p>}
    {r.status==='Pending'&&(operator||reviewer)&&<div className="mt-4 space-y-3"><label className="block text-sm">{operator?'Cancellation reason':'Decision note'}<input aria-label={`Decision note for request ${r.id}`} minLength={5} maxLength={1000} className={input+' mt-1'} value={notes[r.id]||''} onChange={e=>setNotes({...notes,[r.id]:e.target.value})}/></label><div className="flex flex-wrap gap-2">{(operator?['Cancelled']:['Approved','Rejected']).map(decision=><button key={decision} type="button" disabled={busy||(notes[r.id]||'').trim().length<5} onClick={()=>send(()=>apiClient.operationRequest(`machine-change/requests/${r.id}`,'PATCH',{decision,note:notes[r.id]}))} className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40">{decision==='Approved'?'Approve':decision==='Rejected'?'Reject':'Cancel request'}</button>)}</div></div>}
   </article>)}</div>}
  </section>
 </div>;
}
