import React, {useId} from 'react';

/** FactoryPulse factory + live signal identity. No external assets. */
export function AssistantEmblem() {
 const id=useId().replace(/:/g,'');
 return <svg viewBox="0 0 96 96" width="72" height="72" fill="none" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={`${id}-shell`} x1="16" y1="8" x2="77" y2="89" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".48" stopColor="#e9f7f8"/><stop offset="1" stopColor="#9cc9d4"/></linearGradient>
   <linearGradient id={`${id}-core`} x1="26" y1="16" x2="71" y2="79" gradientUnits="userSpaceOnUse"><stop stopColor="#359dad"/><stop offset=".48" stopColor="#167c86"/><stop offset="1" stopColor="#155a71"/></linearGradient>
   <linearGradient id={`${id}-signal`} x1="24" y1="46" x2="78" y2="58" gradientUnits="userSpaceOnUse"><stop stopColor="#c4fff1"/><stop offset=".5" stopColor="#fff"/><stop offset="1" stopColor="#7fe9d2"/></linearGradient>
   <filter id={`${id}-glow`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>
  <circle cx="48" cy="48" r="45" fill={`url(#${id}-shell)`} stroke="#fff" strokeWidth="1.5"/>
  <circle cx="48" cy="48" r="39" stroke="#81b9c4" strokeWidth=".7"/>
  <g className="fp-assistant-orbit" stroke="#38a69f" strokeWidth="2" strokeLinecap="round"><path d="M10 35a40 40 0 0 1 19-22M67 83a40 40 0 0 0 19-24"/></g>
  <rect x="18" y="18" width="60" height="60" rx="22" fill={`url(#${id}-core)`}/>
  <path d="M26 30c5-7 13-9 22-9" stroke="#b6f4f4" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
  <path d="M28 65V39h8v10l12-8v8l13-8v24H28Z" fill="#e4fffa" fillOpacity=".14" stroke="#bcf1ec" strokeWidth="1.4" strokeLinejoin="round"/>
  <path d="M32 38v-8h4v8" stroke="#bcf1ec" strokeWidth="1.4" strokeLinejoin="round"/>
  <g fill="#d3fff5" opacity=".75"><rect x="33" y="59" width="4" height="4" rx=".8"/><rect x="43" y="59" width="4" height="4" rx=".8"/><rect x="53" y="59" width="4" height="4" rx=".8"/></g>
  <path d="M23 53h13l5-8 7 15 7-11 4 4h14" stroke="#96fff1" strokeWidth="4" filter={`url(#${id}-glow)`} opacity=".5"/>
  <path className="fp-assistant-signal" d="M23 53h13l5-8 7 15 7-11 4 4h14" stroke={`url(#${id}-signal)`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  <circle className="fp-assistant-signal-dot" cx="73" cy="53" r="2.8" fill="#e1fff9"/>
  <path d="m71 23 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#e0fff4" stroke="#7ec6bf" strokeWidth=".5"/>
  <path d="M35 84h26" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
 </svg>;
}
