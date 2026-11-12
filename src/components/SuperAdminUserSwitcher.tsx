import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { apiClient } from '../services/apiClient';

type Employee = {id:number;work_id:string;full_name:string;role:string;is_active:boolean};
export function SuperAdminUserSwitcher({user}:{user:UserProfile}) {
 const [users,setUsers]=useState<Employee[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [reason,setReason]=useState(''),[minutes,setMinutes]=useState(15);
 const visible=user.role==='Super Admin'||!!user.viewOwnerWorkId;
 useEffect(()=>{if(!visible)return;let active=true;apiClient.operationRequest('super-admin/users').then(rows=>{if(active)setUsers(rows);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[visible,user.id]);
 if(!visible)return null;
 const change=async(employee_id:number|null)=>{setBusy(true);setError('');try{await apiClient.operationRequest('super-admin/user-view','POST',{employee_id,reason,minutes});window.location.reload();}catch(e){setError(e instanceof Error?e.message:'Could not change employee view');setBusy(false);}};
 return <aside aria-label="Super Admin employee view" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-slate-800 sm:px-6">
  <div className="flex flex-wrap items-center gap-3">
   <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-amber-900">Super Admin · {user.viewOwnerWorkId||user.workId}</p><p className="mt-1 text-xs">{user.viewOwnerWorkId?`Viewing ${user.fullName} · ${user.workId} (${user.role}). Actions are recorded as your Super Admin account.`:'Open an employee workspace without their password. Actions remain attributed to you.'}</p></div>
   <label className="text-xs">Reason for access<input aria-label="Reason for access" maxLength={160} value={reason} onChange={e=>setReason(e.target.value)} placeholder="At least 8 characters" className="mt-1 block rounded-lg border bg-white p-2 text-sm"/></label>
   <label className="text-xs">Time limit<select aria-label="Employee view time limit" value={minutes} onChange={e=>setMinutes(Number(e.target.value))} className="mt-1 block rounded-lg border bg-white p-2">{[5,15,30].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>
   <label className="flex w-full flex-col gap-1 text-xs font-medium sm:w-80">Jump to user<select aria-label="Jump to user" disabled={busy||reason.trim().length<8} value={user.viewOwnerWorkId?user.id:''} onChange={e=>change(e.target.value?Number(e.target.value):null)} className="max-w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"><option value="">My Super Admin workspace</option>{users.filter(u=>u.work_id!==(user.viewOwnerWorkId||user.workId)).map(u=><option key={u.id} value={u.id} disabled={!u.is_active}>{u.full_name} · {u.work_id} · {u.role}{!u.is_active?' (inactive)':''}</option>)}</select></label>
   {user.viewOwnerWorkId&&<button type="button" disabled={busy} onClick={()=>change(null)} className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Return to Super Admin</button>}
  </div>
  {user.viewOwnerWorkId&&<p className="mt-2 text-xs">View expires in approximately {Math.ceil((user.viewRemainingSeconds||0)/60)} minutes · {user.viewReason}. The server checks expiry on every request.</p>}
  {busy&&<p role="status" className="mt-2 text-xs">Changing employee view…</p>}
  {error&&<p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}
 </aside>;
}
