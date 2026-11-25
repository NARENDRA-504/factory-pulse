import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AssistantEmblem } from './AssistantEmblem';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const SIZE = 72;
const MARGIN = 12;
const POSITION_KEY = 'factorypulse-assistant-position';
type Position = { x: number; y: number };

function bound(position: Position): Position {
  return {
    x: Math.max(MARGIN, Math.min(position.x, window.innerWidth - SIZE - MARGIN)),
    y: Math.max(MARGIN, Math.min(position.y, window.innerHeight - SIZE - MARGIN)),
  };
}

function initialPosition(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return bound(saved);
  } catch { /* Storage may be disabled; the icon still works. */ }
  return bound({ x: MARGIN, y: window.innerHeight / 2 - SIZE / 2 });
}

export function DraggableAssistant({ open, onOpenChange, role, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  children: React.ReactNode;
}) {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useReducedMotion();
  const gesture = useRef<{ id: number; startX: number; startY: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const remember = (next: Position) => {
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* Optional preference. */ }
  };

  useEffect(() => {
    const resize = () => {
      setPosition(previous => bound(previous));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
    return ()=>{cancelAnimationFrame(frame);document.body.style.overflow=previousOverflow;launcher.current?.focus();};
  },[open]);

  return <>
    <AnimatePresence>
    {open && <motion.div ref={panel} id="factory-chat-panel" role="dialog" aria-modal="true" aria-label="FactoryPulse assistant"
      initial={reducedMotion ? {opacity:0} : {opacity:0, scale:.82, y:24, filter:'blur(8px)'}}
      animate={{opacity:1, scale:1, y:0, filter:'blur(0px)'}}
      exit={reducedMotion ? {opacity:0} : {opacity:0, scale:.94, y:12, filter:'blur(4px)'}}
      transition={{duration:reducedMotion ? .1 : .38, ease:[.22,1,.36,1]}}
      onKeyDown={event => {
        if(event.key==='Escape')onOpenChange(false);
        if(event.key==='Tab'){
          const targets=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')||[]).filter(element=>element.getClientRects().length>0);
          const first=targets[0],last=targets[targets.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }
      }}
      style={{ inset:0, height:'100dvh', transformOrigin:`${position.x+SIZE/2}px ${position.y+SIZE/2}px` }}
      className="fp-chat-workspace fixed z-[80] flex min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-xs font-bold text-white">FP</span><div><p className="text-sm font-semibold text-slate-800">FactoryPulse assistant</p><p className="text-xs text-slate-500">{role} workspace</p></div></div>
        <button type="button" aria-label="Close assistant" onClick={() => onOpenChange(false)} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><X size={20} /></button>
      </div>
      {children}
    </motion.div>}
    </AnimatePresence>
    <span id="assistant-drag-help" className="sr-only">Click to open chat. Hold and drag to move. Use arrow keys to move with the keyboard.</span>
    <button ref={launcher} type="button" tabIndex={open?-1:0} aria-hidden={open||undefined} aria-expanded={open} aria-controls="factory-chat-panel" aria-describedby="assistant-drag-help"
      aria-label={open ? 'Close machine assistant' : 'Open machine assistant'} title="Click to chat · hold and drag to move"
      style={{ left: position.x, top: position.y, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', visibility:open?'hidden':'visible' }}
      className={`fp-assistant-avatar ${open?'fp-assistant-is-open':''} fixed z-[61] flex select-none items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700`}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, origin: position, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.startX;
        const dy = event.clientY - active.startY;
        if (!active.moved && Math.hypot(dx, dy) < 6) return;
        active.moved = true;
        suppressClick.current = true;
        setDragging(true);
        setPosition(bound({ x: active.origin.x + dx, y: active.origin.y + dy }));
      }}
      onPointerUp={event => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        if (active.moved) remember(bound({ x: active.origin.x + event.clientX - active.startX, y: active.origin.y + event.clientY - active.startY }));
        gesture.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => { gesture.current = null; setDragging(false); }}
      onLostPointerCapture={() => { gesture.current = null; setDragging(false); }}
      onClick={() => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        onOpenChange(!open);
      }}
      onKeyDown={event => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (direction) {
          event.preventDefault();
          const step = event.shiftKey ? 40 : 10;
          const next = bound({ x: position.x + direction[0] * step, y: position.y + direction[1] * step });
          setPosition(next); remember(next);
        } else if (event.key === 'Escape') onOpenChange(false);
      }}>
      {open&&<span className="fp-assistant-burst" aria-hidden="true"><i/><i/><i/></span>}
      <motion.span className="relative flex items-center justify-center" key={open?'close':'emblem'}
        initial={reducedMotion?false:{opacity:0,rotate:open?-90:35,scale:.5}}
        animate={{opacity:1,rotate:0,scale:1}} transition={{duration:reducedMotion?0:.36,type:'spring',bounce:.25}}>
       {open ? <X size={27} aria-hidden="true" /> : <AssistantEmblem />}
      </motion.span><span className="sr-only">FactoryPulse assistant</span>
    </button>
  </>;
}
