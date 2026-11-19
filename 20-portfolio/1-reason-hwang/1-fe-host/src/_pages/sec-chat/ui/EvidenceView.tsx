"use client";
import { useState } from "react";
import { periodLabel, unitLabel } from "../model/evidenceLabels";

export type ModelingSource = {
  id?: string; evidenceId?: string; filingId: string; generationId?: string; itemCode?: string;
  text?: string; conceptQName?: string; value?: string | number | null; rawValue?: string | number | null;
  normalizedValue?: string | number | null; unit?: unknown; period?: unknown; context?: unknown;
  sourceType?: string; sourceTool?: string; textTruncated?: boolean; metadataTruncated?: boolean;
};

type ModelingEvidence = { filingId: string; status: "available" | "empty" | "unavailable"; toolCalls: string[]; sources: ModelingSource[]; limitations: string[] };

function PublishedModelingEvidence({ evidence }: { evidence: ModelingEvidence }) {
  const label = { available: "선택한 모델링 근거", empty: "선택된 모델링 근거 없음", unavailable: "모델링 조회 불가" }[evidence.status];
  return <section aria-label="모델링 검색 근거" className="sec-quotes">
    <h3>{label}</h3>
    <p>대상 공시 {evidence.filingId}</p>
    {evidence.status !== "available" && <p>모델링되지 않았거나 조회가 불가능한 상태는 공시가 없다는 의미가 아닙니다.</p>}
    {evidence.sources.map((source, index) => {
      const period = periodLabel(source.period) ?? periodLabel(source.context);
      const unit = unitLabel(source.unit);
      const raw = source.normalizedValue ?? source.value ?? source.rawValue;
      const value = typeof raw === "string" || typeof raw === "number" ? raw : undefined;
      return <blockquote className="break-words" key={source.evidenceId ?? source.id ?? index}>
        <p><strong>{source.conceptQName ?? (source.itemCode ? `Item ${source.itemCode}` : "게시된 모델링 근거")}</strong></p>
        <dl>
          {value !== undefined && value !== null && <><dt>값</dt><dd>{value}</dd></>}
          {source.rawValue != null && source.rawValue !== value && <><dt>원문 값</dt><dd>{source.rawValue}</dd></>}
          {period && <><dt>기간</dt><dd>{period}</dd></>}
          {unit && <><dt>단위</dt><dd>{unit}</dd></>}
          <dt>공시 ID</dt><dd>{source.filingId}</dd>
          {(source.evidenceId ?? source.id) && <><dt>근거 ID</dt><dd>{source.evidenceId ?? source.id}</dd></>}
        </dl>
        {source.text && <p>{source.text}</p>}
        {(source.textTruncated || source.metadataTruncated) && <p>표시 근거는 크기 제한에 따라 일부 요약됐습니다.</p>}
      </blockquote>;
    })}
    {evidence.limitations.map((limitation, index) => <p key={index}>{limitation}</p>)}
  </section>;
}

export type Evidence = {
  filing: { cik: string; accessionNo: string; filingDate: string };
  sourceUrl: string; checkedAt: string | null; issuerNote?: string; limitations: string;
  coverage: Record<string, { used: number; total: number }>;
  findings: { item: string; heading: string; quote: string }[];
  modeling?: ModelingEvidence;
};

export function EvidenceView({ evidence }: { evidence: Evidence }) {
  const [show, setShow] = useState(true);
  return <aside className="sec-evidence" aria-label="검증된 원문 근거">
    <p>CIK {evidence.filing.cik} · 10-K {evidence.filing.accessionNo} · 제출 {evidence.filing.filingDate}</p>
    <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">SEC 원문 공시</a>
    <p>{evidence.checkedAt ? `SEC 동기화 확인: ${evidence.checkedAt}` : "저장 문서 기준 · SEC 최신성 미확인"}</p>
    {evidence.issuerNote && <p>{evidence.issuerNote}</p>}
    <p>{Object.entries(evidence.coverage).map(([item, range]) => `Item ${item}: ${range.used.toLocaleString()}/${range.total.toLocaleString()}자`).join(" · ")}</p>
    <label><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> 원문 인용 표시</label>
    {show && <div className="sec-quotes">{evidence.findings.map((finding, index) => <blockquote key={index}><span className="iui-badge">Item {finding.item} · {finding.heading}</span><p>{finding.quote}</p></blockquote>)}</div>}
    {evidence.modeling && <PublishedModelingEvidence evidence={evidence.modeling} />}
    <p><strong>분석 범위와 한계</strong> · {evidence.limitations || "원문 인용과 모델의 요약·시각화를 함께 확인하세요."}</p>
  </aside>;
}
