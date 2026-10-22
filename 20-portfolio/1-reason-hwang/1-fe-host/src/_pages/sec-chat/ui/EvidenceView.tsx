"use client";
import { useState } from "react";

export type Evidence = {
  filing: { cik: string; accessionNo: string; filingDate: string };
  sourceUrl: string; checkedAt: string | null; issuerNote?: string; limitations: string;
  coverage: Record<string, { used: number; total: number }>;
  findings: { item: string; heading: string; quote: string }[];
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
    <p><strong>분석 범위와 한계</strong> · {evidence.limitations || "원문 인용과 모델의 요약·시각화를 함께 확인하세요."}</p>
  </aside>;
}
