"use client";

import { useRef, useState } from "react";
import { FileChartColumn, X } from "lucide-react";
import { useThread, useThreadList, GenUIUserMessage, type UserMessage } from "@openuidev/react-ui";
import { buildReportMessage, REPORT_MARKER } from "./report-prompt";
import { readReportDocument } from "./read-document";

export function ReportDocumentInput() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [document, setDocument] = useState<{ name: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const isRunning = useThread((s) => s.isRunning);
  const processMessage = useThread((s) => s.processMessage);
  const newThread = useThreadList((s) => s.switchToNewThread);

  return <>
    <button className="report-open" type="button" onClick={() => dialog.current?.showModal()}>
      <FileChartColumn size={16} aria-hidden /> 보고서 만들기
    </button>
    <dialog ref={dialog} className="report-dialog" aria-label="문서로 보고서 만들기">
      <div className="report-dialog-heading">
        <h2>문서로 보고서 만들기</h2>
        <button type="button" aria-label="닫기" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <p>문서 주제에 맞는 요약·분석·권고·근거를 갖춘 인터랙티브 보고서를 만듭니다.</p>
      <label className="report-file-label">
        분석 문서 선택
        <input type="file" accept=".md,.markdown,.txt,.html,.htm" disabled={reading || isRunning}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setDocument(null);
            setError("");
            if (!file) return;
            setReading(true);
            try { setDocument({ name: file.name, text: await readReportDocument(file) }); }
            catch (e) { setError(e instanceof Error ? e.message : "파일을 읽을 수 없습니다."); }
            finally { setReading(false); }
          }} />
      </label>
      <p className="report-hint">Markdown · HTML · TXT / 최대 500KB. 선택한 본문은 보고서 생성을 위해 모델로 전달됩니다.</p>
      {document && <div className="report-file-summary" role="status">
        <strong>{document.name}</strong><span>{document.text.length.toLocaleString()}자 · 새 대화에 생성</span>
      </div>}
      {error && <p role="alert">{error}</p>}
      <button className="report-generate" type="button" disabled={!document || reading || isRunning}
        onClick={() => {
          if (!document) return;
          const content = buildReportMessage(document.name, document.text);
          newThread();
          dialog.current?.close();
          void processMessage({ role: "user", content });
        }}>인터랙티브 보고서 생성</button>
      <p className="report-hint">수치 충돌은 확인 대상으로 표시합니다. 생성과 구성 검증에 잠시 시간이 걸릴 수 있습니다.</p>
    </dialog>
  </>;
}

export function ReportUserMessage({ message }: { message: UserMessage }) {
  const content = typeof message.content === "string" ? message.content : "";
  if (!content.startsWith(REPORT_MARKER)) return <GenUIUserMessage message={message} />;
  const title = content.split("\n", 1)[0].slice(REPORT_MARKER.length).trim();
  return <div className="report-source-message">
    <FileChartColumn size={20} aria-hidden />
    <div><strong>{title}</strong><p>원문 기반 인터랙티브 보고서 생성</p>
      <details><summary>전달한 문서와 요청 보기</summary><pre>{content}</pre></details>
    </div>
  </div>;
}
