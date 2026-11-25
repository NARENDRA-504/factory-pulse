import React,{useEffect,useState} from 'react';
import {apiClient} from '../services/apiClient';

export function MachineHealthPrediction({machineId}:{machineId:string}) {
 const [state,setState]=useState<{owner:string;data:any;error:string}>({owner:'',data:null,error:''});
 useEffect(()=>{let active=true;let timer:number;setState({owner:machineId,data:null,error:''});
  const load=async()=>{try{const data=await apiClient.operationRequest('intelligence/health-model/'+encodeURIComponent(machineId));if(active)setState({owner:machineId,data,error:''});}
   catch(e){if(active)setState({owner:machineId,data:null,error:e instanceof Error?e.message:'Model unavailable'});}
   finally{if(active)timer=window.setTimeout(load,10000);}};
  if(machineId)void load();return()=>{active=false;clearTimeout(timer);};
 },[machineId]);
 const result=state.owner===machineId?state.data:null;
 return <section aria-label="Machine health model" className="rounded-xl border border-violet-200 bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">Machine health early warning</h2><span className="rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-900">ML shadow mode</span></div>
  <p className="mt-2 text-sm text-slate-700">{result?.classification?`${machineId} · ${result.classification} · ${result.model||'Local model'}`:result?.status==='insufficient_data'?'Waiting for seven fresh, aligned sensor channels':result?.status?result.status.replaceAll('_',' '):state.error||'Checking saved machine readings…'}</p>
  <p className="mt-2 text-xs text-slate-500">{result?.notice||'Synthetic-data classifier for human review. Predictions never control equipment or create incident alerts.'}</p>
  {result&&<div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600" aria-label="Prediction monitoring">
   <span>Model version: {result.version??'unavailable'}</span>
   <span>Checked: {result.checked_at?new Date(result.checked_at).toLocaleTimeString():'unavailable'}</span>
   <span>Newest input: {result.latest_reading_at?new Date(result.latest_reading_at).toLocaleTimeString():'no eligible input'}</span>
   {result.latest_reading_at&&<span>Input age at display: {Math.max(0,Math.round((Date.now()-Date.parse(result.latest_reading_at))/1000))}s</span>}
   <span>Input freshness limit: {result.max_reading_age_seconds??30}s</span>
   <span>Advisory only · automatic model alerts off</span>
  </div>}
  {result?.relative_scores&&<div className="mt-3 grid gap-3 sm:grid-cols-3">{Object.entries(result.relative_scores).map(([label,score])=><div key={label}><div className="flex justify-between text-xs"><span>{label}</span><span>{(Number(score)*100).toFixed(1)} score</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{width:`${Number(score)*100}%`}}/></div></div>)}</div>}
  {result?.relative_scores&&<p className="mt-2 text-xs text-slate-500">Uncalibrated model scores, not failure probabilities. Critical is the training label for a failure within 30 minutes; Suspect is 30–120 minutes.</p>}
  {!!result?.missing_or_invalid_sensors?.length&&<p className="mt-2 text-xs text-amber-800">Needs: {result.missing_or_invalid_sensors.join(', ')}</p>}
  {!!result?.outside_training_range?.length&&<p className="mt-2 text-xs text-amber-800">Outside training distribution: {result.outside_training_range.join(', ')}. Human review required.</p>}
 </section>;
}
