"use client";
import { useCallback, useEffect, useRef, useState } from "react";
const sizeKey = "ta-canvas-split-v1";
function savePreferred(value: { width: number; height: number }) {
  try { window.localStorage.setItem(sizeKey, JSON.stringify(value)); } catch { /* Keep the current layout when storage is unavailable. */ }
}
export function CanvasSplitter() {
  const ref = useRef<HTMLDivElement>(null);
  const preferred = useRef({ width: 420, height: 0 });
  const dragging = useRef(false);
  const [range, setRange] = useState({ vertical: true, value: 420, min: 280, max: 1000 });
  const measure = useCallback((value?: number) => {
    const root = ref.current?.parentElement; if (!root) return;
    const vertical = window.matchMedia("(min-width: 900px)").matches;
    const total = vertical ? root.clientWidth : root.clientHeight;
    const min = vertical ? Math.min(280, total / 3) : Math.min(160, total / 3);
    const max = Math.max(min, total - 8 - (vertical ? 360 : 240));
    const key = vertical ? "width" : "height";
    if (value !== undefined) {
      preferred.current[key] = Math.max(min, Math.min(max, value));
      savePreferred(preferred.current);
    }
    const size = Math.round(Math.max(min, Math.min(max, preferred.current[key] || total * 0.42)));
    root.style.setProperty(vertical ? "--ta-chat-width" : "--ta-chat-height", `${size}px`);
    setRange(previous => previous.vertical === vertical && previous.value === size && previous.min === min && previous.max === max ? previous : { vertical, value: size, min, max });
  }, []);
  useEffect(() => { const root = ref.current?.parentElement; if (!root) return; try { const saved = JSON.parse(window.localStorage.getItem(sizeKey) ?? "null") as { width?: unknown; height?: unknown } | null; if (saved && typeof saved.width === "number" && typeof saved.height === "number") preferred.current = { width: saved.width, height: saved.height }; } catch { /* Ignore invalid local preference. */ } const observer = new ResizeObserver(() => measure()); observer.observe(root); measure(); return () => { observer.disconnect(); root.classList.remove("ta-is-resizing"); }; }, [measure]);
  return <div ref={ref} role="separator" tabIndex={0} aria-label="채팅과 Canvas 크기 조절" aria-orientation={range.vertical ? "vertical" : "horizontal"} aria-valuemin={Math.round(range.min)} aria-valuemax={Math.round(range.max)} aria-valuenow={range.value} aria-valuetext={`채팅 ${range.value}px`} className="ta-canvas-splitter" title="드래그 또는 방향키로 크기 조절 · 두 번 클릭하여 초기화" onPointerDown={event => { if (event.button !== 0) return; dragging.current = true; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.parentElement?.classList.add("ta-is-resizing"); }} onPointerMove={event => { if (!dragging.current) return; const box = event.currentTarget.parentElement?.getBoundingClientRect(); if (box) measure(range.vertical ? event.clientX - box.left : event.clientY - box.top); }} onPointerUp={event => { dragging.current = false; event.currentTarget.parentElement?.classList.remove("ta-is-resizing"); }} onPointerCancel={() => { dragging.current = false; ref.current?.parentElement?.classList.remove("ta-is-resizing"); }} onLostPointerCapture={() => { dragging.current = false; ref.current?.parentElement?.classList.remove("ta-is-resizing"); }} onKeyDown={event => { const keys = range.vertical ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]; if (keys.includes(event.key)) { event.preventDefault(); measure(range.value + (event.key === keys[0] ? -1 : 1) * (event.shiftKey ? 40 : 16)); } else if (event.key === "Home" || event.key === "End") { event.preventDefault(); measure(event.key === "Home" ? range.min : range.max); } }} onDoubleClick={() => { preferred.current = { width: 420, height: 0 }; savePreferred(preferred.current); measure(); }}><span /></div>;
}
