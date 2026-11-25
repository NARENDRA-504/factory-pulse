import React, {useEffect,useRef,useState} from 'react';
import {ArrowUp,Mic,Square,Plus,Search,AudioLines} from 'lucide-react';
import {useVoiceDictation,VoiceLanguage} from './useVoiceDictation';
import {ChatAudioReply} from './ChatAudioReply';
import {AssistantEmblem} from './AssistantEmblem';
import {apiClient} from '../services/apiClient';
import {RetrievalDetails} from './RetrievalDetails';
import {VoiceConversation} from './VoiceConversation';

type Message={id:number;role:'user'|'assistant';text:string;result?:any};
export function FactoryChat({machineId}:{machineId?:string}){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[useAi,setUseAi]=useState(false);
 const version=useRef(0),nextId=useRef(0),bottom=useRef<HTMLDivElement>(null);
 const [voiceOrigin,setVoiceOrigin]=useState<VoiceLanguage|null>(null);
 const [voiceOpen,setVoiceOpen]=useState(false);
 const voice=useVoiceDictation((text,language)=>{setDraft(previous=>((previous.trim()?previous.trim()+' ':'')+text).slice(0,1000));setVoiceOrigin(language);},machineId);
 const clear=()=>{version.current++;setMessages([]);setDraft('');setBusy(false);setUseAi(false);setVoiceOrigin(null);};
 useEffect(()=>{clear();setVoiceOpen(false);},[machineId]);
 useEffect(()=>{if(messages.length||busy)bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages,busy]);
 const send=async(question:string,fromComposer=false)=>{
  question=question.trim();if(busy||question.length<2)return;
  if(voice.listening||voice.processing)return;
  const language=fromComposer?voiceOrigin:null;
  document.querySelectorAll<HTMLAudioElement>('#factory-chat-panel audio').forEach(player=>player.pause());
  const requestVersion=version.current;
  const prior=messages.filter(m=>m.role==='user').slice(-4).map(m=>m.text);
  setMessages(old=>[...old.slice(-18),{id:nextId.current++,role:'user',text:question}]);setDraft('');setVoiceOrigin(null);setBusy(true);
  try{
   const result=language?await apiClient.queryFactoryVoice(question,language,machineId,prior):await apiClient.queryFactoryIntelligence(question,machineId,useAi,prior);
   if(requestVersion!==version.current)return;
   setMessages(old=>[...old,{id:nextId.current++,role:'assistant',text:result.generated_analysis||result.answer,result}]);
  }catch(error){if(requestVersion===version.current)setMessages(old=>[...old,{id:nextId.current++,role:'assistant',text:error instanceof Error?error.message:'Unable to retrieve factory evidence. Please try again.'}]);}
  finally{if(requestVersion===version.current){setBusy(false);setUseAi(false);}}
 };
 if(voiceOpen)return <section className="relative flex min-h-0 flex-1 flex-col" aria-label="FactoryPulse voice workspace"><VoiceConversation key={machineId||'fleet'} machineId={machineId} priorQuestions={messages.filter(m=>m.role==='user').slice(-4).map(m=>m.text)} onClose={()=>setVoiceOpen(false)} onTurn={(question,result)=>setMessages(old=>[...old.slice(-16),{id:nextId.current++,role:'user',text:question},{id:nextId.current++,role:'assistant',text:result.generated_analysis||result.answer,result}])}/></section>;
 return <section className="fp-chat-main flex min-h-0 min-w-0 flex-1 flex-col bg-white" aria-label="FactoryPulse machine and production chatbot">
  <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between gap-3 px-5 py-3"><p className="text-xs text-slate-500">Scope: <strong className="font-medium text-teal-800">{machineId||'Your authorized fleet'}</strong></p><button type="button" onClick={clear} disabled={!messages.length||busy||voice.listening||voice.processing} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Clear machine chat"><Plus size={15}/>New chat</button></div>
  <div role="log" aria-label="Machine chat messages" aria-live="polite" aria-relevant="additions" className="fp-chat-log min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8">
   <div className="mx-auto w-full max-w-3xl space-y-5">
   {!messages.length&&<div className="fp-chat-welcome mx-auto flex max-w-2xl flex-col items-center px-2 pb-6 pt-[min(8vh,70px)] text-center"><AssistantEmblem/><p className="mt-4 text-[11px] font-semibold uppercase tracking-[.2em] text-teal-700">Your factory. In focus.</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-800 sm:text-4xl">What can we help you solve?</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">Explore machine health, understand production, or find the right guidance for your next step.</p><div className="mt-7 grid w-full gap-3 text-left sm:grid-cols-2">{['Latest machine readings','Any machine warnings?','Show temperature SOP instructions','Show vibration SOP instructions'].map(prompt=><button type="button" key={prompt} disabled={busy||voice.listening||voice.processing} onClick={()=>send(prompt)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50"><Search size={17} className="shrink-0 text-teal-600"/>{prompt}</button>)}</div></div>}
   {messages.map(message=><article key={message.id} className={`rounded-2xl px-5 py-4 ${message.role==='user'?'ml-auto max-w-[90%] bg-slate-100 sm:max-w-[80%]':'w-full border border-slate-100 bg-white'}`}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">{message.role==='user'?'You':'FactoryPulse'}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{message.text}</p>
    {message.result&&<><p className="mt-2 text-[10px] text-slate-500">{(message.result.generated_analysis||(message.result.voice_input&&message.result.provider_status==='responded'))?`Google Gemini · ${message.result.provider_model||'generated analysis'} · review recommendations`:message.result.evidence_source} · {new Date(message.result.generated_at).toLocaleTimeString()}</p>{message.result.provider_status==='unavailable'&&<p className="mt-1 text-xs text-slate-700">AI is unavailable; a local answer is shown.</p>}{message.result.provider_status==='unconfigured'&&<p className="mt-1 text-xs text-slate-700">AI is not configured; local conversation and SQL answers remain available.</p>}{!!message.result.facts?.length&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer text-cyan-800">Saved evidence ({message.result.facts.length} readings)</summary>{message.result.facts.slice(0,12).map((row:any)=><p className="mt-1" key={row.reading_id}>{row.machine_id} · {row.sensor_name}: {row.sensor_value??'Unavailable'} {row.sensor_unit} · {new Date(row.timestamp).toLocaleString()}</p>)}</details>}{!!message.result.sources?.length&&<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer text-teal-800">Retrieved sources ({message.result.sources.length})</summary>{message.result.sources.map((source:any)=><div key={source.id} className="mt-2 rounded border border-slate-200 bg-white p-2"><p className="font-semibold">[{source.id}] {source.title}</p><p className="mt-1 whitespace-pre-wrap break-words">{source.excerpt}</p><p className="mt-1 break-words text-[10px]">{source.source}{source.reading_id?` · ${source.reading_id}`:''}{source.age_seconds!=null?` · ${Math.round(source.age_seconds)} seconds old at retrieval`:''}</p></div>)}</details>}{message.result.provider_status==='unsupported_answer'&&<p className="mt-1 text-xs text-amber-800">AI source references could not be verified; retrieved evidence is shown instead.</p>}{message.result.limitations?.map((text:string)=><p key={text} className="mt-1 text-[10px] text-slate-500">{text}</p>)}</>}
    {message.result?.voice_input&&!message.result?.conversation_audio_played&&<ChatAudioReply audio={message.result.audio}/>}
    {message.result?.original_procedure_text&&<details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer">Original procedure text</summary><p className="mt-2 whitespace-pre-wrap">{message.result.original_procedure_text}</p></details>}
    {message.result&&<RetrievalDetails retrieval={message.result.retrieval} sources={message.result.sources} grounding={message.result.grounding}/>}
   </article>)}
   {busy&&<p role="status" className="animate-pulse py-4 text-sm text-teal-800">{useAi?'Thinking with Gemini…':'Finding your answer…'}</p>}<div ref={bottom}/>
   </div>
  </div>
  <div className="fp-chat-composer shrink-0 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-8"><div className="mx-auto w-full max-w-3xl">
  <label className="mb-3 flex items-start gap-2 px-2 text-[11px] leading-relaxed text-slate-500"><input className="mt-0.5" type="checkbox" checked={useAi} disabled={busy||voice.listening||voice.processing} onChange={e=>setUseAi(e.target.checked)}/><span>Use Gemini for my next typed question. Voice questions use Gemini automatically. Sends your question and up to four previous questions to Google. For factory questions, also sends limited telemetry from your selected machine and relevant project guidance passages. Everyday conversation sends no factory records. {machineId?'':'Select a machine for factory AI analysis.'}</span></label>
  <form className={`rounded-[26px] border bg-slate-50 p-3 shadow-sm transition-shadow focus-within:border-teal-400 focus-within:shadow-md ${voice.listening?'border-red-300':'border-slate-200'}`} onSubmit={e=>{e.preventDefault();send(draft,true);}}>
   <label className="block"><span className="sr-only">Your message</span><textarea autoFocus value={draft} onChange={e=>{setDraft(e.target.value);if(!e.target.value.trim())setVoiceOrigin(null);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(draft,true);}}} placeholder="Ask FactoryPulse anything…" rows={2} minLength={2} maxLength={1000} disabled={busy||voice.listening||voice.processing} className="max-h-36 min-h-14 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"/></label>
   <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 px-2 text-xs text-slate-500"><Search size={14}/><span className="hidden sm:inline">Machine knowledge</span><span className="rounded-full bg-white px-2 py-1 text-[10px] text-teal-700">Auto language</span></span><div className="flex items-center gap-2">
    <button type="button" aria-label={voice.listening?'Stop voice typing':'Start voice typing'} aria-pressed={voice.listening} disabled={busy||voice.processing} title={voice.supported?'Voice typing · review before sending':'Voice typing availability depends on your browser'} onClick={()=>{document.querySelectorAll<HTMLAudioElement>('#factory-chat-panel audio').forEach(player=>player.pause());if(voice.listening)voice.stop();else void voice.start();}} className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${voice.listening?'animate-pulse bg-red-100 text-red-700':'text-slate-600 hover:bg-slate-200'}`}>{voice.listening?<Square size={17} fill="currentColor"/>:<Mic size={20}/>}</button>
    <button type="button" aria-label="Open voice conversation" title="Voice conversation · speak and hear answers" disabled={busy||voice.processing} onClick={()=>{voice.cancel();document.querySelectorAll<HTMLAudioElement>('#factory-chat-panel audio').forEach(player=>player.pause());setVoiceOpen(true);}} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40"><AudioLines size={21}/></button>
    <button aria-label="Send machine question" disabled={busy||voice.listening||voice.processing||draft.trim().length<2} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-white transition-colors hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400"><ArrowUp size={21}/></button>
   </div></div>
  </form>
  {voice.notice?<p role="status" className="mt-2 px-2 text-xs text-teal-800">{voice.notice}</p>:<p className="mt-2 px-2 text-xs text-slate-500">Mic: dictate a message. Blue voice button: have a spoken conversation. Telugu, Hindi and English detected automatically.</p>}
  <p className="mt-2 px-2 text-center text-[10px] leading-relaxed text-slate-500">Dictation sends audio to Google for transcription; review the words before sending. The blue voice conversation sends each spoken turn automatically and reads its answer aloud. Answers cannot control equipment.</p>
  <p className="mt-1 text-center text-[10px] text-slate-400">Telugu · Hindi · English detected automatically. Typed questions remain text-only. Chat resets when closed or machine changes.</p>
  </div></div>
 </section>;
}
