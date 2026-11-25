import React,{useEffect,useRef,useState} from 'react';
import {BellRing,BellOff,Volume2} from 'lucide-react';

export function advanceAlerts(previous:Set<string>|null, alerts:any[]) {
 const keys=alerts.map(a=>`${a.id}:${a.level}`);
 const fresh=previous===null?[]:alerts.filter(a=>!previous.has(`${a.id}:${a.level}`)&&!a.acknowledged_at&&['Critical','Suspect'].includes(a.level));
 const next=new Set(previous||[]);keys.forEach(k=>next.add(k));
 return {next:new Set([...next].slice(-1000)),level:fresh.some(a=>a.level==='Critical')?'Critical':fresh.length?'Suspect':null};
}

/** Only server-authorized, committed incidents can reach this sound control. */
export function AlertSoundControl({alerts,owner}:{alerts:any[]|null;owner:string}) {
 const pref='factorypulse.alertSound.'+owner;
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(pref)==='on';}catch{return false;}});
 const [notice,setNotice]=useState('');
 const seen=useRef<Set<string>|null>(null),last=useRef(0),player=useRef<HTMLAudioElement|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;player.current?.pause();};},[]);
 const play=async(level:string)=>{
  player.current?.pause();
  const audio=new Audio(level==='Critical'?'/sounds/critical-alert.wav?v=3':'/sounds/suspect-alert.wav?v=2');
  audio.volume=1;player.current=audio;
  try{await audio.play();if(alive.current)setNotice('');}catch{if(alive.current)setNotice('Sound blocked. Click Test sound to enable audio in this browser.');}
 };
 useEffect(()=>{
  if(alerts===null)return;
  const update=advanceAlerts(seen.current,alerts);seen.current=update.next;
  if(update.level&&enabled&&Date.now()-last.current>=10000){last.current=Date.now();void play(update.level);}
 },[alerts,enabled]);
 const toggle=()=>{const next=!enabled;setEnabled(next);try{localStorage.setItem(pref,next?'on':'off');}catch{/* session preference still works */}if(next)void play('Suspect');else{player.current?.pause();setNotice('');}};
 return <aside className="flex flex-wrap items-center justify-end gap-2 border-b border-teal-100 bg-teal-50 px-4 py-1.5 text-xs" aria-label="Alert audio settings">
  <div className="flex flex-wrap items-center gap-2">
  <button type="button" title={enabled?'Mute incident alert sounds':'Enable incident alert sounds'} onClick={toggle} aria-pressed={enabled} className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-1.5 font-semibold text-teal-900">{enabled?<BellRing size={16}/>:<BellOff size={16}/>}Alert sound {enabled?'on':'off'}</button>
  <button type="button" onClick={()=>void play('Critical')} className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-teal-900"><Volume2 size={16} aria-hidden="true"/>Test sound</button>
  </div>
  {notice&&<span role="status" className="text-amber-800">{notice}</span>}
 </aside>;
}
