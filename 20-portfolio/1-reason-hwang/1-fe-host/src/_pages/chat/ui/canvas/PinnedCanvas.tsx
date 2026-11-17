"use client";

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { OutputView } from "@/shared/ui/intelligent-ui";
import type { CanvasContext } from "../../model/canvas";
import { moveItem, type PinnedCanvasItem } from "../../model/pinnedCanvas";

type Props = {
  items: PinnedCanvasItem[];
  queryEndpoint?: string;
  busy: boolean;
  onChange: (update: (items: PinnedCanvasItem[]) => PinnedCanvasItem[]) => void;
  onClose: () => void;
  onAsk: (question: string, context: CanvasContext) => void;
};

function queryLabel(item: PinnedCanvasItem): string {
  const args = item.successfulArgs ?? item.initialState;
  if (!args) return "조회 조건: 요소를 추가한 시점의 설정";
  return `조회 조건: ${String(args.ticker ?? "—")} · ${String(args.interval ?? "—")} · ${String(args.count ?? "—")}봉`;
}

export function PinnedCanvas({ items, queryEndpoint, busy, onChange, onClose, onAsk }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ id: string; text: string } | null>(null);
  const [queryStatuses, setQueryStatuses] = useState<Record<string, "loading" | "success" | "error">>({});
  const resizing = useRef<{ id: string; x: number; y: number; columns: 1 | 2; height: number } | null>(null);
  const printBlocked = items.some(item => item.program.includes("technical_analysis_chart") && queryStatuses[item.id] !== "success");

  function updateItem(id: string, patch: Partial<PinnedCanvasItem>) {
    onChange(current => current.map(item => item.id === id && Object.entries(patch).some(([key, value]) => JSON.stringify(item[key as keyof PinnedCanvasItem]) !== JSON.stringify(value)) ? { ...item, ...patch } : item));
  }

  function captureQuote(id: string, container: HTMLElement) {
    const selection = window.getSelection();
    const text = selection?.toString().trim().slice(0, 2000) ?? "";
    const node = selection?.anchorNode;
    if (text && node && container.contains(node)) setQuote({ id, text });
  }

  function askAboutQuote(item: PinnedCanvasItem) {
    if (busy || !quote || quote.id !== item.id) return;
    onAsk(`선택한 문장을 이 분석 요소의 근거와 조회 조건에 연결해서 설명해 줘: “${quote.text}”`, {
      reportId: item.reportId,
      elementId: item.id,
      quote: quote.text,
    });
    setQuote(null);
  }

  function finishResize(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resizing.current;
    if (!start) return;
    updateItem(start.id, resizeDimensions(start, event.clientX, event.clientY));
    resizing.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resizeDimensions(start: NonNullable<typeof resizing.current>, x: number, y: number): Pick<PinnedCanvasItem, "columns" | "height"> {
    return {
      columns: x - start.x > 130 ? 2 : x - start.x < -130 ? 1 : start.columns,
      height: Math.max(220, Math.min(1000, Math.round(start.height + y - start.y))),
    };
  }

  function previewResize(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resizing.current;
    const tile = event.currentTarget.closest<HTMLElement>(".ta-canvas-item");
    if (!start || !tile) return;
    const dimensions = resizeDimensions(start, event.clientX, event.clientY);
    tile.style.gridColumn = `span ${dimensions.columns}`;
    tile.style.height = `${dimensions.height}px`;
  }

  return <section className="ta-canvas-panel" aria-label="기술적 분석 Canvas">
    <header className="ta-canvas-heading">
      <h2>분석 Canvas <span className="text-xs font-normal text-muted-foreground">{items.length}개 요소</span></h2>
      <div className="ta-canvas-controls">
        <Button variant="outline" size="sm" disabled={printBlocked} onClick={() => window.print()}>PDF 저장 / 인쇄</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>접기</Button>
      </div>
    </header>
    {printBlocked && <p role="status" className="ta-canvas-print-status">차트 조회가 완료되면 PDF를 저장할 수 있습니다. 실패한 차트는 다시 조회해 주세요.</p>}
    <div className="ta-canvas-grid-scroll">
      <div className="ta-canvas-grid">
        {items.map(item => <article key={item.id} className="ta-canvas-item" style={{ gridColumn: `span ${item.columns}`, height: item.height }}
          onDragOver={event => { if (draggedId && draggedId !== item.id) event.preventDefault(); }}
          onDrop={event => { event.preventDefault(); if (draggedId) onChange(current => moveItem(current, draggedId, item.id)); setDraggedId(null); }}
          onMouseUp={event => captureQuote(item.id, event.currentTarget)}>
          <div className="ta-canvas-item-heading">
            <span className="ta-canvas-drag" draggable role="button" tabIndex={0} onDragStart={event => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggedId(null)} onKeyDown={event => { const index = items.findIndex(entry => entry.id === item.id); const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1; if (target >= 0 && target < items.length) { event.preventDefault(); onChange(current => moveItem(current, item.id, items[target].id)); } }} title="드래그 또는 방향키로 순서 변경" aria-label={`${item.title} 이동`}>⋮⋮</span>
            <strong>{item.title}</strong>
            <Button variant="ghost" size="sm" aria-label={`${item.title} 제거`} onClick={() => onChange(current => current.filter(entry => entry.id !== item.id))}>×</Button>
          </div>
          <div className="ta-canvas-item-meta"><span>{queryLabel(item)}</span><span>추가 {new Date(item.addedAt).toLocaleString("ko-KR")}</span><span>설명은 원래 분석 시점 기준이며 차트 조건 변경 시 자동 갱신되지 않습니다.</span></div>
          {quote?.id === item.id && <div className="ta-canvas-quote"><span>“{quote.text.slice(0, 100)}{quote.text.length > 100 ? "…" : ""}”</span><Button variant="outline" size="sm" disabled={busy} onClick={() => askAboutQuote(item)}>채팅에 물어보기</Button></div>}
          <div className="ta-canvas-item-content"><OutputView key={item.id} program={item.program} queryEndpoint={queryEndpoint} active initialState={{ ...item.initialState, ...item.reactiveState, $chart_refresh_seconds: 0 }} onStateUpdate={state => updateItem(item.id, { reactiveState: state })} onQuerySuccess={args => updateItem(item.id, { successfulArgs: args })} onQueryStatusChange={status => setQueryStatuses(previous => previous[item.id] === status ? previous : { ...previous, [item.id]: status })} /></div>
          <button type="button" className="ta-canvas-item-resize" aria-label={`${item.title} 크기 조절`} title="드래그하여 크기 조절" onPointerDown={event => { if (event.button !== 0) return; resizing.current = { id: item.id, x: event.clientX, y: event.clientY, columns: item.columns, height: item.height }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={previewResize} onPointerUp={finishResize} onPointerCancel={event => { resizing.current = null; const tile = event.currentTarget.closest<HTMLElement>(".ta-canvas-item"); if (tile) { tile.style.gridColumn = `span ${item.columns}`; tile.style.height = `${item.height}px`; } }} onKeyDown={event => { if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return; event.preventDefault(); if (event.key === "ArrowRight") updateItem(item.id, { columns: 2 }); if (event.key === "ArrowLeft") updateItem(item.id, { columns: 1 }); if (event.key === "ArrowDown") updateItem(item.id, { height: Math.min(1000, item.height + 40) }); if (event.key === "ArrowUp") updateItem(item.id, { height: Math.max(220, item.height - 40) }); }} />
        </article>)}
      </div>
    </div>
  </section>;
}
