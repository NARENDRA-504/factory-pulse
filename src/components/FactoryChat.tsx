import React, {useEffect,useRef,useState} from 'react';
import {MessageSquare,Send,Trash2} from 'lucide-react';
import {apiClient} from '../services/apiClient';

type Message={id:number;role:'user'|'assistant';text:string;result?:any};
export function FactoryChat({machineId}:{machineId?:string}){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[useAi,setUseAi]=useState(false);
 const version=useRef(0),nextId=useRef(0),bottom=useRef<HTMLDivElement>(null);
 const clear=()=>{version.current++;setMessages([]);setDraft('');setBusy(false);setUseAi(false);};
 useEffect(()=>{clear();},[machineId]);
 useEffect(()=>{if(messages.length||busy)bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages,busy]);
 const send=async(question:string)=>{
  question=question.trim();if(busy||question.length<3)return;
  const requestVersion=version.current;
  const prior=messages.filter(m=>m.role==='user').slice(-4).map(m=>m.text);
  setMessages(old=>[...old.slice(-18),{id:nextId.current++,role:'user',text:question}]);setDraft('');setBusy(true);
  try{
   const result=await apiClient.queryFactoryIntelligence(question,machineId,useAi,prior);
   if(requestVersion!==version.current)return;
   setMessages(old=>[...old,{id:nextId.current++,role:'assistant',text:result.generated_analysis||result.answer,result}]);
  }catch(error){if(requestVersion===version.current)setMessages(old=>[...old,{id:nextId.current++,role:'assistant',text:error instanceof Error?error.message:'Unable to retrieve factory evidence. Please try again.'}]);}
  finally{if(requestVersion===version.current)setBusy(false);}
 };
 return <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="FactoryPulse machine and production chatbot">
  <div className="flex items-start justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MessageSquare className="h-4 w-4"/>FactoryPulse Chat</h2><p className="mt-1 text-xs text-slate-600">Machines & production only · {machineId||'your authorized fleet'}</p></div><button type="button" onClick={clear} disabled={!messages.length||busy} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40" aria-label="Clear machine chat"><Trash2 className="h-4 w-4"/></button></div>
  <p className="mt-3 text-[11px] leading-relaxed text-slate-600">Available to every role. Your account permissions still apply. Answers cannot control equipment. Chat stays in this page and resets when you change machine.</p>
  <div role="log" aria-label="Machine chat messages" aria-live="polite" aria-relevant="additions" className="my-3 h-80 space-y-3 overflow-y-auto rounded-lg bg-slate-100 p-3">
   {!messages.length&&<div className="space-y-3 text-sm text-slate-600"><p>Hello! Ask about sensor readings, machine condition, maintenance, downtime or production information.</p><p className="text-xs">I use authorized MySQL evidence. If production counts or another measurement are missing, I will say so.</p></div>}
   {messages.map(message=><article key={message.id} className={`rounded-lg p-3 ${message.role==='user'?'ml-6 border border-slate-200 bg-teal-50':'mr-3 border border-slate-200 bg-slate-50'}`}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">{message.role==='user'?'You':'FactoryPulse'}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{message.text}</p>
    {message.result&&<><p className="mt-2 text-[10px] text-slate-500">{message.result.generated_analysis?`Google Gemini · ${message.result.provider_model||'generated analysis'} · review recommendations`:message.result.evidence_source} · {new Date(message.result.generated_at).toLocaleTimeString()}</p>{message.result.provider_status==='unavailable'&&<p className="mt-1 text-xs text-slate-700">AI is unavailable; the answer above uses SQL evidence.</p>}{message.result.provider_status==='unconfigured'&&<p className="mt-1 text-xs text-slate-700">AI is not configured; local SQL answers remain available.</p>}{!!message.result.facts?.length&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer text-cyan-800">Saved evidence ({message.result.facts.length} readings)</summary>{message.result.facts.slice(0,12).map((row:any)=><p className="mt-1" key={row.reading_id}>{row.machine_id} · {row.sensor_name}: {row.sensor_value??'Unavailable'} {row.sensor_unit} · {new Date(row.timestamp).toLocaleString()}</p>)}</details>}{message.result.limitations?.map((text:string)=><p key={text} className="mt-1 text-[10px] text-slate-500">{text}</p>)}</>}
   </article>)}
   {busy&&<p role="status" className="text-xs text-teal-800">{useAi?'Reviewing machine evidence with Gemini...':'Reading saved machine evidence...'}</p>}<div ref={bottom}/>
  </div>
  <div className="mb-3 flex flex-wrap gap-2">{['Latest machine readings','Any machine warnings?','Machine downtime','Production output available?'].map(prompt=><button type="button" key={prompt} disabled={busy} onClick={()=>send(prompt)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:border-teal-600 disabled:opacity-40">{prompt}</button>)}</div>
  <label className="mb-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-600"><input className="mt-0.5" type="checkbox" checked={useAi} disabled={!machineId||busy} onChange={e=>setUseAi(e.target.checked)}/><span>Use Gemini for my next question. Sends the question, up to four previous chat questions and this selected machine's limited telemetry to Google. {machineId?'':'Select a machine to enable AI.'}</span></label>
  <form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();send(draft);}}><label className="min-w-0 flex-1"><span className="sr-only">Machine or production question</span><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(draft);}}} placeholder="Ask about machines or production..." rows={2} minLength={3} maxLength={1000} disabled={busy} className="w-full resize-y rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none"/></label><button aria-label="Send machine question" disabled={busy||draft.trim().length<3} className="mb-1 rounded-lg bg-teal-400 p-3 text-slate-950 disabled:opacity-40"><Send className="h-4 w-4"/></button></form>
 </section>;
}
