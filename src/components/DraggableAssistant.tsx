import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

const SIZE = 44;
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
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; startX: number; startY: number; origin: Position; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const remember = (next: Position) => {
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* Optional preference. */ }
  };

  useEffect(() => {
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPosition(previous => bound(previous));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const panelWidth = Math.min(400, viewport.width - MARGIN * 2);
  const panelHeight = Math.min(620, viewport.height - MARGIN * 2);
  const panelLeft = Math.max(MARGIN, Math.min(
    position.x + SIZE + MARGIN + panelWidth <= viewport.width - MARGIN
      ? position.x + SIZE + MARGIN
      : position.x - panelWidth - MARGIN,
    viewport.width - panelWidth - MARGIN,
  ));
  const panelTop = Math.max(MARGIN, Math.min(position.y - 120, viewport.height - panelHeight - MARGIN));

  return <>
    {open && <div id="factory-chat-panel" role="region" aria-label="FactoryPulse assistant"
      onKeyDown={event => { if (event.key === 'Escape') onOpenChange(false); }}
      style={{ left: panelLeft, top: panelTop, width: panelWidth, maxHeight: panelHeight }}
      className="fixed z-[60] overflow-y-auto rounded-xl border border-teal-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-xs font-semibold text-teal-800">{role} assistant</span>
        <button type="button" aria-label="Close assistant" onClick={() => onOpenChange(false)} className="rounded p-2 text-slate-600"><X size={16} /></button>
      </div>
      {children}
    </div>}
    <span id="assistant-drag-help" className="sr-only">Click to open chat. Hold and drag to move. Use arrow keys to move with the keyboard.</span>
    <button type="button" aria-expanded={open} aria-controls="factory-chat-panel" aria-describedby="assistant-drag-help"
      aria-label={open ? 'Close machine assistant' : 'Open machine assistant'} title="Click to chat · hold and drag to move"
      style={{ left: position.x, top: position.y, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      className="fixed z-[61] flex h-11 w-11 select-none items-center justify-center rounded-full border border-white bg-teal-700 text-white shadow-lg hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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
      <MessageSquare size={21} /><span className="sr-only">FactoryPulse assistant</span>
    </button>
  </>;
}
