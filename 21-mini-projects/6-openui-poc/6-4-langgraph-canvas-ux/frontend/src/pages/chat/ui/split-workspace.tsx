"use client";

import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from "react";

const MIN_PANEL = 430;
const HANDLE = 10;

export function SplitWorkspace({chat, canvas}: {chat: ReactNode; canvas: ReactNode}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{pointerId: number; startRatio: number} | null>(null);
  const [ratio, setRatio] = useState(0.5);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const available = Math.max(1, width - HANDLE);
  const minimum = Math.min(0.5, MIN_PANEL / available);
  const clamp = (value: number) => Math.max(minimum, Math.min(1 - minimum, value));
  const displayed = clamp(ratio);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stop = (cancel = false) => {
    if (cancel && drag.current) setRatio(drag.current.startRatio);
    drag.current = null;
    setDragging(false);
  };

  return <div ref={root} className={`workspace-shell${dragging ? " workspace-resizing" : ""}`}
    style={{"--chat-fraction": `${displayed}fr`, "--canvas-fraction": `${1 - displayed}fr`} as CSSProperties}>
    {chat}
    <div className="workspace-splitter" role="separator" tabIndex={0}
      aria-label="Chat과 Canvas 너비 조절" aria-orientation="vertical"
      aria-valuemin={Math.round(minimum * 100)} aria-valuemax={Math.round((1 - minimum) * 100)}
      aria-valuenow={Math.round(displayed * 100)} aria-valuetext={`Chat ${Math.round(displayed * 100)}%, Canvas ${Math.round((1 - displayed) * 100)}%`}
      title="드래그로 너비 조절 · 방향키로 조절 · 더블클릭으로 초기화"
      onPointerDown={event => {
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, startRatio: ratio};
        setDragging(true);
      }}
      onPointerMove={event => {
        if (drag.current?.pointerId !== event.pointerId || !root.current) return;
        const rect = root.current.getBoundingClientRect();
        const space = rect.width - HANDLE;
        if (space <= MIN_PANEL * 2) return;
        setRatio(Math.max(MIN_PANEL / space, Math.min(1 - MIN_PANEL / space, (event.clientX - rect.left - HANDLE / 2) / space)));
      }}
      onPointerUp={event => {
        if (drag.current?.pointerId !== event.pointerId) return;
        stop();
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => stop(true)} onLostPointerCapture={() => stop(true)}
      onDoubleClick={() => setRatio(0.5)}
      onKeyDown={event => {
        if (event.key === "Escape" && drag.current) {
          const pointerId = drag.current.pointerId;
          stop(true);
          event.currentTarget.releasePointerCapture(pointerId);
          return;
        }
        if (drag.current) return;
        const next = {ArrowLeft: displayed - 0.02, ArrowRight: displayed + 0.02, Home: minimum, End: 1 - minimum, Enter: 0.5}[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setRatio(clamp(next));
      }}><span aria-hidden="true"/></div>
    {canvas}
  </div>;
}
