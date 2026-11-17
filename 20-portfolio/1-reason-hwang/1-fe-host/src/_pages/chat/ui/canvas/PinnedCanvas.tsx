"use client";

import { useEffect, useRef, useState } from "react";
import ReactGridLayout, { noCompactor, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Button } from "@/shared/ui/button";
import { OutputView } from "@/shared/ui/intelligent-ui";
import type { CanvasContext } from "../../model/canvas";
import { applyLayouts, type PinnedCanvasItem } from "../../model/pinnedCanvas";

import { displayLayouts, keyboardLayout } from "../../model/canvasGrid";

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
  const { width, containerRef, mounted } = useContainerWidth();
  const narrow = width < 600;
  const gestureActive = useRef(false);
  const [gestureVersion, setGestureVersion] = useState(0);
  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key !== "Escape" || !gestureActive.current) return;
      event.preventDefault();
      gestureActive.current = false;
      setGestureVersion(version => version + 1);
    }
    document.addEventListener("keydown", cancel, true);
    return () => document.removeEventListener("keydown", cancel, true);
  }, []);
  const [quote, setQuote] = useState<{ id: string; text: string } | null>(null);
  const [queryStatuses, setQueryStatuses] = useState<Record<string, "loading" | "success" | "error">>({});
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
      elementId: item.sourceElementId,
      quote: quote.text,
    });
    setQuote(null);
  }

  function persistLayout(layout: Layout) {
    if (narrow || !gestureActive.current) return;
    gestureActive.current = false;
    onChange(current => applyLayouts(current, [...layout]));
  }

  function adjustWithKeyboard(item: PinnedCanvasItem, event: React.KeyboardEvent, resize: boolean) {
    if (narrow || item.pinned || busy) return;
    const layout = keyboardLayout(item.layout, event.key, resize);
    if (!layout) return;
    event.preventDefault();
    onChange(current => applyLayouts(current, [{ i: item.id, ...layout }]));
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
      <div ref={containerRef} className="ta-canvas-grid">
        {mounted && <ReactGridLayout key={gestureVersion} width={width} layout={displayLayouts(items, narrow)}
          gridConfig={{ cols: 24, rowHeight: 28, margin: [12, 12], containerPadding: [0, 0] }}
          compactor={noCompactor}
          dragConfig={{ enabled: !busy && !narrow, handle: ".ta-canvas-drag" }}
          resizeConfig={{ enabled: !busy && !narrow, handles: ["se"] }}
          onDragStart={() => { gestureActive.current = true; }} onResizeStart={() => { gestureActive.current = true; }}
          onDragStop={persistLayout} onResizeStop={persistLayout}>
        {items.map(item => <article key={item.id} className="ta-canvas-item" data-canvas-id={item.id} data-pinned={item.pinned}>
          <div className="ta-canvas-item-heading">
            <button type="button" className="ta-canvas-drag" disabled={narrow || item.pinned || busy} onKeyDown={event => adjustWithKeyboard(item, event, false)} title="드래그 또는 방향키로 위치 이동" aria-label={`${item.title} 이동`}>⋮⋮</button>
            <strong>{item.title}</strong>
            <Button variant="ghost" size="sm" aria-label={`${item.title} 위치 ${item.pinned ? "고정 해제" : "고정"}`} aria-pressed={item.pinned} onClick={() => updateItem(item.id, { pinned: !item.pinned })}>{item.pinned ? "고정 해제" : "고정"}</Button>
            <Button variant="ghost" size="sm" aria-label={`${item.title} 제거`} onClick={() => onChange(current => current.filter(entry => entry.id !== item.id))}>×</Button>
          </div>
          <div className="ta-canvas-item-meta"><span>{queryLabel(item)}</span><span>추가 {new Date(item.addedAt).toLocaleString("ko-KR")}</span><span>설명은 원래 분석 시점 기준이며 차트 조건 변경 시 자동 갱신되지 않습니다.</span></div>
          {quote?.id === item.id && <div className="ta-canvas-quote"><span>“{quote.text.slice(0, 100)}{quote.text.length > 100 ? "…" : ""}”</span><Button variant="outline" size="sm" disabled={busy} onClick={() => askAboutQuote(item)}>채팅에 물어보기</Button></div>}
          <div className="ta-canvas-item-content" onMouseUp={event => captureQuote(item.id, event.currentTarget)}><OutputView key={item.id} program={item.program} queryEndpoint={queryEndpoint} active initialState={{ ...item.initialState, ...item.reactiveState, $chart_refresh_seconds: 0 }} onStateUpdate={state => updateItem(item.id, { reactiveState: state })} onQuerySuccess={args => updateItem(item.id, { successfulArgs: args })} onQueryStatusChange={status => setQueryStatuses(previous => previous[item.id] === status ? previous : { ...previous, [item.id]: status })} /></div>
          <button type="button" className="ta-canvas-keyboard-resize" disabled={narrow || item.pinned || busy} aria-label={`${item.title} 크기 조절`} title="방향키로 크기 조절" onKeyDown={event => adjustWithKeyboard(item, event, true)}>크기</button>
        </article>)}
        </ReactGridLayout>}
      </div>
    </div>
  </section>;
}
