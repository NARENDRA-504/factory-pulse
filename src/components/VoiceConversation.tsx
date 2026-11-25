import React,{useEffect,useRef,useState} from 'react';
import {AudioLines,Mic,MicOff,PhoneOff,Play,Square} from 'lucide-react';
import {useVoiceDictation,VoiceLanguage} from './useVoiceDictation';
import {apiClient} from '../services/apiClient';
import {localVoiceFor} from '../utils/voicePlayback';

/** Bounded voice turns over the existing authenticated RAG API, not a live audio socket. */
export function VoiceConversation({machineId,priorQuestions,onTurn,onClose}:{machineId?:string;priorQuestions:string[];onTurn:(question:string,result:any)=>void;onClose:()=>void}){
 const [phase,setPhase]=useState<'ready'|'thinking'|'speaking'|'paused'|'error'>('ready'),[muted,setMuted]=useState(false),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[notice,setNotice]=useState(''),[playBlocked,setPlayBlocked]=useState(false),[quickReplies,setQuickReplies]=useState(true);
 const active=useRef(true),muteRef=useRef(false),generation=useRef(0),request=useRef<AbortController|null>(null),player=useRef<HTMLAudioElement|null>(null),audioUrl=useRef(''),nextTimer=useRef<ReturnType<typeof setTimeout>|null>(null),startNext=useRef<()=>void>(()=>{}),history=useRef(priorQuestions.slice(-4)),turnCallback=useRef(onTurn);
 turnCallback.current=onTurn;
 const utterance=useRef<SpeechSynthesisUtterance|null>(null);
 const releaseAudio=()=>{if(utterance.current){utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}if(player.current){player.current.pause();player.current.onended=null;player.current.onerror=null;player.current=null;}if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current='';};
 const finishReply=()=>{releaseAudio();if(!active.current)return;setPhase(muteRef.current?'paused':'ready');if(!muteRef.current)nextTimer.current=setTimeout(()=>startNext.current(),200);};
 const respond=async(text:string,language:VoiceLanguage)=>{
  if(!active.current||muteRef.current)return;
  const ticket=++generation.current;setQuestion(text);setAnswer('');setNotice('');setPhase('thinking');const controller=new AbortController();request.current=controller;
  try{
   const deviceVoice=quickReplies&&typeof window.speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined'?localVoiceFor(language,window.speechSynthesis.getVoices()):undefined;
   const result=await apiClient.queryFactoryVoice(text,language,machineId,history.current,controller.signal,!deviceVoice);
   if(!active.current||ticket!==generation.current)return;
   history.current=[...history.current,text].slice(-4);setAnswer(result.generated_analysis||result.answer||'No answer was returned.');turnCallback.current(text,{...result,conversation_audio_played:true});
   const audio=result.audio;
   if(deviceVoice&&audio?.status==='device'){
    releaseAudio();const speech=new SpeechSynthesisUtterance((result.spoken_text||result.answer||'').replace(/\[[A-Za-z0-9-]+\]/g,''));utterance.current=speech;speech.voice=deviceVoice;speech.lang=deviceVoice.lang;speech.rate=1.05;speech.onend=finishReply;speech.onerror=()=>{if(active.current&&ticket===generation.current){releaseAudio();setPhase('error');setNotice('Device speech is unavailable. Turn off Quick replies to use cloud voice, then ask again.');}};setPhase('speaking');setNotice('Quick reply · on-device voice');window.speechSynthesis.speak(speech);return;
   }
   if(audio?.status!=='ready'||audio.mime_type!=='audio/wav'||!audio.base64||audio.base64.length>9*1024*1024){setPhase('error');setNotice(audio?.message||'Spoken reply is unavailable. Your text answer is shown; tap Speak to try another question.');return;}
   releaseAudio();const bytes=Uint8Array.from(atob(audio.base64),c=>c.charCodeAt(0));audioUrl.current=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const sound=new Audio(audioUrl.current);player.current=sound;sound.onended=finishReply;sound.onerror=()=>{if(active.current){setPhase('error');setNotice('Audio could not play. Your text answer remains available.');releaseAudio();}};setPhase('speaking');
   try{await sound.play();}catch{if(active.current&&ticket===generation.current){setPlayBlocked(true);setNotice('Tap Play reply to allow browser audio.');}}
  }catch(error){if(active.current&&ticket===generation.current){setPhase('error');setNotice(error instanceof Error&&error.name!=='AbortError'?error.message:'Voice request stopped. Tap Speak to try again.');}}
  finally{if(ticket===generation.current)request.current=null;}
 };
 const voice=useVoiceDictation((text,language)=>{void respond(text,language);},machineId,{autoStopOnSilence:true,silenceMs:quickReplies?800:1500});
 const cancelCapture=useRef(voice.cancel);cancelCapture.current=voice.cancel;
 startNext.current=()=>{if(active.current&&!muteRef.current){setPhase('ready');setNotice('');setPlayBlocked(false);void voice.start();}};
 useEffect(()=>{active.current=true;window.speechSynthesis?.getVoices();return()=>{active.current=false;generation.current++;request.current?.abort();if(nextTimer.current)clearTimeout(nextTimer.current);cancelCapture.current();releaseAudio();};},[]);
 const interrupt=()=>{generation.current++;request.current?.abort();request.current=null;if(nextTimer.current)clearTimeout(nextTimer.current);voice.cancel();releaseAudio();setPlayBlocked(false);};
 const toggleMute=()=>{const next=!muteRef.current;muteRef.current=next;setMuted(next);interrupt();setPhase(next?'paused':'ready');setNotice('');};
 const listen=()=>{interrupt();setPhase('ready');setNotice('');void voice.start();};
 const status=voice.listening?'Listening…':voice.processing?'Understanding your voice…':phase==='thinking'?'Finding your answer…':phase==='speaking'?'FactoryPulse is speaking':muted?'Microphone muted':'Ready when you are';
 return <div className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-y-auto bg-gradient-to-b from-blue-50 via-white to-cyan-50 px-5 py-6 sm:px-10" role="region" aria-label="Voice conversation">
  <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-700">FactoryPulse voice</p><p className="mt-1 text-xs text-slate-500">{machineId||'Your authorized workspace'} · Auto language</p></div><button autoFocus type="button" onClick={()=>{interrupt();onClose();}} aria-label="End voice conversation" className="rounded-full border border-red-100 bg-white p-3 text-red-600 hover:bg-red-50"><PhoneOff size={20}/></button></header>
  <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-8 text-center">
   <div className={`flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_20px_70px_#2563eb40] sm:h-44 sm:w-44 ${voice.listening||phase==='speaking'?'motion-safe:animate-pulse':''}`}><AudioLines size={64} strokeWidth={1.5}/></div>
   <h2 className="mt-8 text-2xl font-semibold text-slate-800" role="status">{status}</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">Speak in Telugu, Hindi or English. Pause after your question; your answer plays aloud, then listening resumes.</p>
   {(notice||(!voice.listening&&voice.notice))&&<p role="status" className="mt-4 max-w-lg rounded-xl bg-white px-4 py-3 text-sm text-blue-900">{notice||voice.notice}</p>}
   {question&&<div className="mt-6 w-full rounded-2xl border border-blue-100 bg-white p-5 text-left"><p className="text-xs font-semibold text-blue-600">You</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{question}</p>{answer&&<><p className="mt-4 text-xs font-semibold text-teal-700">FactoryPulse</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{answer}</p></>}</div>}
  </div>
  <footer className="mx-auto w-full max-w-2xl shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] text-center"><div className="flex flex-wrap items-center justify-center gap-3">
   <button type="button" onClick={toggleMute} aria-label={muted?'Unmute voice microphone':'Mute voice microphone'} aria-pressed={muted} className="rounded-full border border-slate-200 bg-white p-4 text-slate-700">{muted?<MicOff size={22}/>:<Mic size={22}/>}</button>
   {!muted&&(voice.listening?<button type="button" onClick={voice.stop} className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-4 text-sm font-semibold text-white"><Square size={18}/>Finish question</button>:<button type="button" onClick={listen} className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-4 text-sm font-semibold text-white"><AudioLines size={20}/>{phase==='speaking'?'Interrupt and speak':'Speak'}</button>)}
   {playBlocked&&<button type="button" onClick={()=>{void player.current?.play().then(()=>{setPlayBlocked(false);setNotice('');}).catch(()=>setNotice('Browser audio is blocked. Check site sound permission.'));}} className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-4 text-sm text-blue-700"><Play size={18}/>Play reply</button>}
  </div><label className="mt-4 inline-flex items-center gap-2 text-xs text-blue-800"><input type="checkbox" checked={quickReplies} onChange={event=>setQuickReplies(event.target.checked)} disabled={voice.listening||voice.processing||phase==='thinking'||phase==='speaking'}/>Quick replies · use a matching on-device voice when available</label><p className="mt-3 text-[11px] leading-relaxed text-slate-500">Voice chat sends each recorded question to Google automatically (up to 20 seconds per turn). Uses your existing machine permissions and RAG guidance. Answers cannot operate machinery.</p><p className="mt-1 text-[11px] text-slate-400">Built-in microphone supported · Silence detection may need Finish question in noisy surroundings.</p></footer>
 </div>;
}
