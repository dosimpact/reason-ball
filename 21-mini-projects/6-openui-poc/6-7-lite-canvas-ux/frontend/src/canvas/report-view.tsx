"use client";

import { Component, useCallback, useRef, useState, type ReactNode } from "react";
import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { Download, Link2, MessageSquareQuote, X, LoaderCircle } from "lucide-react";
import { library } from "@/lib/library";
import { runLibraryAction } from "@/lib/actions";
import { ThemeToggle } from "./theme";
import type { Quote, Report } from "./state";

export class RenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.error ? <p role="alert">리포트를 렌더링하지 못했습니다. 다시 생성해 주세요.</p> : this.props.children;
  }
}

// 작업 Canvas와 공개 링크가 같은 Renderer를 사용해 동일한 프로그램을 표시합니다.
export function ReportView({ report, onQuote, onClose, publicView = false }: {
  report: Report; onQuote?: (quote: Quote) => void; onClose?: () => void; publicView?: boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState("");
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState(false);
  const streaming = !["ready", "error"].includes(report.status);
  // 서버 생성 완료와 브라우저 렌더링 오류 여부를 함께 확인하여 인쇄·발행·인용 버튼을 제어합니다.
  const ready = report.status === "ready" && renderErrors.length === 0;
  const onError = useCallback((errors: OpenUIError[]) => {
    if (!streaming) setRenderErrors(previous => {
      const next = errors.map(e => e.message);
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [streaming]);

  // 리포트 본문 안에서 선택한 텍스트만 인용하며 전송 시 현재 report ID와 함께 묶습니다.
  function captureSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !body.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    setSelected(selection.toString().trim().slice(0, 2000));
  }
  // 서버 발행 성공 후 현재 서비스 origin으로 공개 조회 URL을 만듭니다.
  async function publish() {
    setPublishing(true); setNotice("");
    try {
      const response = await fetch(`/api/reports/${report.id}/publish`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const url = `${window.location.origin}/reports/${report.id}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setNotice("공유 링크를 복사했습니다."); }
      catch { setNotice("아래 링크를 복사해 공유하세요."); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "발행에 실패했습니다."); }
    finally { setPublishing(false); }
  }
  async function print() {
    await document.fonts.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  return <section className={`report-panel ${publicView ? "public-report" : ""}`} aria-label="리포트 Canvas" data-report-id={report.id} data-status={report.status} data-report-mode={report.report_mode ?? "interactive"}>
    <header className="canvas-toolbar no-print">
      <div><span className="eyebrow">{report.report_mode === "pdf" ? "PDF REPORT CANVAS" : "REPORT CANVAS"}</span><h2>{report.title}</h2></div>
      <div className="toolbar-actions">
        {publicView && <ThemeToggle />}
        <button onClick={print} disabled={!ready} title="브라우저 인쇄에서 PDF로 저장"><Download size={16} />PDF 저장</button>
        {!publicView && <button onClick={publish} disabled={!ready || publishing}><Link2 size={16} />{publishing ? "발행 중" : "공유 링크"}</button>}
        {onClose && <button className="icon-button" onClick={onClose} aria-label="Canvas 닫기"><X size={18} /></button>}
      </div>
    </header>
    {(notice || shareUrl) && <div className="share-notice no-print" role="status">{notice}{shareUrl && <a href={shareUrl} target="_blank" rel="noopener noreferrer">{shareUrl}</a>}</div>}
    {selected && onQuote && ready && <div className="selection-bar no-print"><span>{selected.slice(0, 90)}</span><button onClick={() => { onQuote({ reportId: report.id, text: selected }); setSelected(""); window.getSelection()?.removeAllRanges(); }}><MessageSquareQuote size={16} />채팅에 물어보기</button></div>}
    <div className="report-scroll">
      {streaming && <div className="generation-status no-print" role="status"><LoaderCircle size={16} className="spin" />{report.status === "validating" ? "OpenUI 결과를 검증하고 있습니다" : report.status === "reviewing" ? "원문과 리포트 수치를 대조하고 있습니다" : report.status === "repairing" ? "표현 오류를 수정하고 있습니다" : "자료를 분석하고 리포트를 구성하고 있습니다"}</div>}
      {report.status === "error" && <p className="error-notice" role="alert">{report.error}</p>}
      {renderErrors.length > 0 && <p className="error-notice" role="alert">렌더링 오류: {renderErrors.join(" · ")}</p>}
      <article lang={report.report_language ?? "ko"} className="report-paper" ref={body} onMouseUp={captureSelection} onKeyUp={captureSelection} aria-label="리포트 본문">
        {report.program ? <RenderBoundary key={`${report.id}:${streaming}`} onFailure={() => { if (!streaming) setRenderErrors(["컴포넌트 실행에 실패했습니다."]); }}><Renderer response={report.program} library={library} isStreaming={streaming} onError={onError} onAction={event => { void runLibraryAction(event); }} /></RenderBoundary> : <div className="report-skeleton"><div /><div /><div /></div>}
        {ready && <footer className="report-source">{report.report_language === "en" ? "Source: " : "근거: "}{report.source_file} · {report.report_language === "en" ? "AI-generated visualization. Figures requiring verification are identified in the report." : "AI가 구성한 시각화입니다. 원문 수치 확인이 필요한 항목은 본문에 표시합니다."}</footer>}
      </article>
    </div>
  </section>;
}
