"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const STORAGE_KEY = "lite-canvas:split-size";
const HANDLE = 8;

export function CanvasSplitter() {
  const ref = useRef<HTMLDivElement>(null);
  const preferred = useRef({ width: 360, height: 0 });
  const dragging = useRef(false);
  const [range, setRange] = useState({ vertical: true, value: 360, min: 300, max: 1000 });

  // 데스크톱은 폭, 모바일은 높이를 조절하며 두 패널의 최소 크기를 고려해 허용 범위를 계산합니다.
  function measure(value?: number) {
    const handle = ref.current;
    const root = handle?.parentElement;
    if (!root) return;
    const vertical = window.matchMedia("(min-width: 701px)").matches;
    const sidebar = root.querySelector<HTMLElement>(".workspace-sidebar");
    const total = vertical ? root.clientWidth - (sidebar?.getBoundingClientRect().width ?? 0) : root.clientHeight;
    const min = vertical ? 300 : Math.min(180, total / 3);
    const max = Math.max(min, total - HANDLE - (vertical ? 320 : 240));
    const key = vertical ? "width" : "height";
    if (value !== undefined) preferred.current[key] = Math.min(max, Math.max(min, value));
    const desired = preferred.current[key] || total * 0.42;
    const size = Math.round(Math.min(max, Math.max(min, desired)));
    root.style.setProperty(vertical ? "--chat-width" : "--chat-height", `${size}px`);
    setRange(previous => previous.vertical === vertical && previous.value === size && previous.min === min && previous.max === max
      ? previous : { vertical, value: size, min, max });
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferred.current)); } catch { /* Layout works without storage. */ }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      for (const key of ["width", "height"] as const) {
        if (typeof saved[key] === "number" && Number.isFinite(saved[key]) && saved[key] > 0) preferred.current[key] = saved[key];
      }
    } catch { /* Use the default layout. */ }
    const root = ref.current!.parentElement!;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    return () => { observer.disconnect(); root.classList.remove("is-resizing"); };
  }, []);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const root = ref.current!.parentElement!;
    const chat = root.querySelector<HTMLElement>(".chat-panel")!.getBoundingClientRect();
    measure(window.matchMedia("(min-width: 701px)").matches ? event.clientX - chat.left : event.clientY - chat.top);
  }

  // 포인터 종료·취소·캡처 해제에 같은 정리 경로를 사용하고 조절한 크기를 저장합니다.
  function finish() {
    dragging.current = false;
    ref.current?.parentElement?.classList.remove("is-resizing");
    persist();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const decrease = range.vertical ? "ArrowLeft" : "ArrowUp";
    const increase = range.vertical ? "ArrowRight" : "ArrowDown";
    if (![decrease, increase, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 20;
    measure(event.key === "Home" ? range.min : event.key === "End" ? range.max : range.value + (event.key === increase ? step : -step));
    persist();
  }

  return <div ref={ref} className="canvas-splitter no-print" role="separator" tabIndex={0}
    aria-label="채팅과 Canvas 크기 조절" aria-controls="workspace-chat"
    aria-orientation={range.vertical ? "vertical" : "horizontal"}
    aria-valuemin={Math.round(range.min)} aria-valuemax={Math.round(range.max)} aria-valuenow={range.value}
    aria-valuetext={`채팅 ${range.value}px`} title="드래그 또는 방향키로 크기 조절 · 더블클릭으로 초기화"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      event.currentTarget.parentElement?.classList.add("is-resizing");
    }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={onKeyDown} onDoubleClick={() => {
      preferred.current = { width: 360, height: 0 }; measure(); persist();
    }}><span /></div>;
}
