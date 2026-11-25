import React,{useEffect,useRef,useState} from 'react';

/** Playback only for a voice-origin answer. Releases its local audio URL on close. */
export function ChatAudioReply({audio}:{audio:any}){
 const player=useRef<HTMLAudioElement>(null),[source,setSource]=useState<{audio:any;url:string}|null>(null),[notice,setNotice]=useState('');
 const url=source&&source.audio===audio?source.url:'';
 useEffect(()=>{
  setSource(null);setNotice('');
  if(audio?.status!=='ready')return;
  if(audio.mime_type!=='audio/wav'||typeof audio.base64!=='string'||!audio.base64.length||audio.base64.length>9*1024*1024){setNotice('Audio could not be loaded. Your text answer is still available.');return;}
  let objectUrl='';
  try{const bytes=Uint8Array.from(atob(audio.base64),c=>c.charCodeAt(0));objectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));setSource({audio,url:objectUrl});}catch{setNotice('Audio could not be loaded. Your text answer is still available.');}
  return ()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[audio]);
 useEffect(()=>{const active=player.current;if(url)active?.play()?.catch(()=>setNotice('Press Play to hear the reply.'));return()=>active?.pause();},[url]);
 return <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3">
  {url?<><p className="mb-2 text-xs font-medium text-teal-800">Spoken reply · {{en:'English',te:'తెలుగు',hi:'हिन्दी'}[audio.language as 'en'|'te'|'hi']||'Detected language'}</p><audio ref={player} src={url} controls preload="metadata" aria-label="Spoken chatbot answer" className="h-10 w-full" onError={()=>setNotice('Audio playback is unavailable. Your text answer is still available.')}/></>:<p className="text-xs text-slate-600">{audio?.message||'Preparing spoken reply…'}</p>}
  {notice&&<p className="mt-2 text-xs text-slate-600">{notice}</p>}
 </div>;
}
