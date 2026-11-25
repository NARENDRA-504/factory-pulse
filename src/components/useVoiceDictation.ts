import {useEffect,useRef,useState} from 'react';
import {apiClient} from '../services/apiClient';
export type VoiceLanguage='en'|'te'|'hi';

/** Owner-approved audio transcription. No language selector or persistent recording. */
export function useVoiceDictation(onTranscript:(text:string,language:VoiceLanguage)=>void,scope?:string,options?:{autoStopOnSilence?:boolean;silenceMs?:number}) {
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[processing,setProcessing]=useState(false),[notice,setNotice]=useState('');
 const callback=useRef(onTranscript);callback.current=onTranscript;
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),upload=useRef<AbortController|null>(null),epoch=useRef(0);
 const capturePending=useRef(false),audioContext=useRef<AudioContext|null>(null),meterFrame=useRef<number|null>(null);
 const releaseMeter=()=>{if(meterFrame.current!==null)cancelAnimationFrame(meterFrame.current);meterFrame.current=null;void audioContext.current?.close().catch(()=>{});audioContext.current=null;};
 const dispose=()=>{
  epoch.current++;
  capturePending.current=false;releaseMeter();
  if(timer.current)clearTimeout(timer.current);
  upload.current?.abort();upload.current=null;
  const active=recorder.current;recorder.current=null;
  if(active){active.onstop=null;active.ondataavailable=null;if(active.state!=='inactive')active.stop();}
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
 };
 useEffect(()=>{setSupported(!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined');return dispose;},[]);
 useEffect(()=>{dispose();setListening(false);setProcessing(false);setNotice('');},[scope]);
 const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
 const cancel=()=>{dispose();setListening(false);setProcessing(false);setNotice('');};
 const start=async()=>{
  if(capturePending.current)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setNotice('Microphone recording is unavailable in this browser. Please type instead.');return;}
  dispose();capturePending.current=true;const current=epoch.current;setProcessing(true);setNotice('Allow access to your built-in or default microphone, then speak in Telugu, Hindi or English.');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(current!==epoch.current){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
   if(!mime)throw new Error('Unsupported recording format');
   const active=new MediaRecorder(media,{mimeType:mime});recorder.current=active;const chunks:Blob[]=[];let bytes=0;
   active.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>2*1024*1024&&active.state==='recording')active.stop();}};
   active.onerror=()=>{if(current===epoch.current){dispose();setListening(false);setProcessing(false);setNotice('Recording failed. Please try again or type instead.');}};
   active.onstop=async()=>{
    releaseMeter();
    if(timer.current)clearTimeout(timer.current);
    media.getTracks().forEach(track=>track.stop());stream.current=null;recorder.current=null;
    if(current!==epoch.current)return;
    setListening(false);setProcessing(true);setNotice('Detecting language and transcribing…');
    const controller=new AbortController();upload.current=controller;const timeout=setTimeout(()=>controller.abort(),55000);
    try{
     if(bytes>2*1024*1024||!bytes)throw new Error('Recording was empty or too large. Please try a short question.');
     const result=await apiClient.transcribeVoice(new Blob(chunks,{type:mime}),controller.signal);
     if(current!==epoch.current)return;
     callback.current(result.text,result.language);setNotice(options?.autoStopOnSilence?`${result.language_name} detected.`:`${result.language_name} detected. Review your question, then send for a text and spoken reply.`);
    }catch(error){if(current===epoch.current)setNotice(error instanceof Error&&error.name!=='AbortError'?error.message:'Voice transcription timed out. Please try again.');}
    finally{clearTimeout(timeout);if(current===epoch.current){upload.current=null;capturePending.current=false;setProcessing(false);}}
   };
   active.start(250);setProcessing(false);setListening(true);setNotice('Listening · language detected automatically · maximum 20 seconds.');timer.current=setTimeout(stop,20000);
   if(options?.autoStopOnSilence&&typeof AudioContext!=='undefined'){
    try{
     const context=new AudioContext();audioContext.current=context;void context.resume().catch(()=>{});
     const analyser=context.createAnalyser();analyser.fftSize=2048;context.createMediaStreamSource(media).connect(analyser);
     const samples=new Float32Array(analyser.fftSize);let heardSpeech=false,lastSpeech=performance.now();const began=lastSpeech;
     const silenceMs=Math.max(700,Math.min(2000,options.silenceMs||1500));
     const measure=()=>{if(current!==epoch.current||active.state!=='recording')return;analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);const now=performance.now();if(rms>.018){heardSpeech=true;lastSpeech=now;}if((heardSpeech&&now-lastSpeech>silenceMs&&now-began>1000)||(!heardSpeech&&now-began>8000)){stop();return;}meterFrame.current=requestAnimationFrame(measure);};meterFrame.current=requestAnimationFrame(measure);
    }catch{releaseMeter();/* Manual stop and the recording cap remain available. */}
   }
  }catch(error){
   if(current!==epoch.current)return;dispose();setListening(false);setProcessing(false);
   const name=error instanceof Error?error.name:'';
   setNotice(name==='NotAllowedError'?'Microphone access was denied. Open the site permissions beside the address bar and allow Microphone, then try again. You can also type.'
    :name==='NotFoundError'?'No microphone was found. Enable your built-in microphone in device sound settings, then try again.'
    :name==='NotReadableError'?'Your microphone is busy or disabled. Close other recording apps and check device microphone privacy settings, then try again.'
    :name==='SecurityError'?'Microphone access requires localhost or HTTPS and permission in your browser.'
    :'Microphone recording could not start. Please try again or type instead.');
  }
 };
 return {supported,listening,processing,notice,start,stop,cancel};
}
