"use client";

import { useRef, useState } from "react";
import { AnswerView } from "./AnswerView";
import { readAnswer } from "./stream";
import "./sec-chat.css";

type Company = { cik: string; name: string; ticker: string };
type Prepared = { threadId: string; filing: { accessionNo: string; filingDate: string }; checkedAt: string | null; missingItems: string[] };
type Turn = { question: string; program: string };
const prompts = [
  "Item 1 Business의 소제목을 원문에서 추출해줘.",
  "방금 추출한 소제목별로 요약해줘. 주요 제품/서비스, 고객, 공급망 관계를 정리해줘.",
  "Item 1A Risk Factors의 사업과 실적 위험을 정리해줘.",
  "Item 3 Legal Proceedings의 중요한 법적 분쟁과 규제 내용을 정리해줘.",
  "Item 7 MD&A의 사업 실적, 다음 회계연도 목표, 경영 방침, 리스크와 불확실성을 정리해줘. 보고서에 없는 목표치는 없다고 밝혀줘.",
  "Item 8 재무제표와 주석에서 가치평가에 필요한 수치, 기간, 단위와 회계상 유의점을 정리해줘.",
  "기업 가치평가 기반 자료를 추출해줘. Item 1, 1A, 3, 7, 8을 각각 정리하고 원문 근거와 한계를 보여줘.",
];

async function jsonRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/sec-chat/${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "요청에 실패했습니다.");
  return result;
}

export function SecChat() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company>();
  const [prepared, setPrepared] = useState<Prepared>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  async function search() {
    setBusy("기업 검색 중"); setError("");
    try { setCompanies((await jsonRequest(`companies?q=${encodeURIComponent(query)}`)).items); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  async function prepare(selected: Company, refresh: boolean) {
    setBusy(refresh ? "SEC 최신 공시 확인 및 다운로드 중 · 수 분 걸릴 수 있습니다" : "저장된 10-K 준비 중"); setError("");
    try {
      const next = await jsonRequest("prepare", { cik: selected.cik, refresh });
      if (prepared) await fetch(`/api/sec-chat/threads/${prepared.threadId}`, { method: "DELETE" });
      setPrepared(next); setCompany(selected); setTurns([]); setQuestion("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  async function ask(text: string) {
    if (!prepared || !text.trim() || busy) return;
    setBusy("보고서 근거를 읽고 답변 생성 중"); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/sec-chat/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: prepared.threadId, message: text }), signal: controller.signal });
      const program = await readAnswer(response);
      setTurns((previous) => [...previous, { question: text, program }]); setQuestion("");
    } catch (e) { setError(controller.signal.aborted ? "답변 생성을 중단했습니다." : (e as Error).message); }
    finally { abort.current = null; setBusy(""); }
  }
  return <main className="sec-chat">
    <header><p className="sec-eyebrow">SEC RESEARCH · INTELLIGENT UI</p><h1>사업보고서와 대화하기</h1><p>기업의 최신 10-K에서 가치평가의 기반 자료를 찾고, 원문 근거를 확인하세요.</p></header>
    <form className="sec-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <label htmlFor="sec-company">기업명 또는 티커</label><input id="sec-company" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AAPL, Microsoft, NVIDIA…" disabled={!!busy} /><button disabled={!!busy}>기업 검색</button>
    </form>
    <ul className="sec-companies">{companies.map((item) => <li key={item.cik}><span><strong>{item.ticker}</strong> {item.name}</span><button disabled={!!busy} onClick={() => void prepare(item, true)}>최신 10-K 다운로드</button><button disabled={!!busy} onClick={() => void prepare(item, false)}>저장 문서 열기</button></li>)}</ul>
    {prepared && <section className="sec-selected"><h2>{company?.name} ({company?.ticker})</h2><p>10-K · {prepared.filing.filingDate} · {prepared.filing.accessionNo}</p><p>{prepared.checkedAt ? `SEC 동기화 확인: ${prepared.checkedAt}` : "저장 문서 기준 — SEC 최신성 미확인"}</p>{prepared.missingItems.length > 0 && <p>추출하지 못한 Item: {prepared.missingItems.join(", ")}</p>}</section>}
    {prepared && <details className="sec-prompts" open={turns.length === 0}><summary>분석 질문 가이드</summary>{prompts.map((prompt, index) => <button key={prompt} disabled={!!busy} onClick={() => void ask(prompt)}>{index + 1}. {prompt}</button>)}</details>}
    <div aria-live="polite" role="status">{busy}</div>{error && <p role="alert" className="sec-error">{error}</p>}
    <section aria-label="사업보고서 대화">{turns.map((turn, index) => <article className="sec-turn" key={index}><h2 className="sec-question">{turn.question}</h2><AnswerView program={turn.program} onError={() => setError("Intelligent UI 렌더링 오류가 발생했습니다.")} /></article>)}</section>
    {prepared && <form className="sec-composer" onSubmit={(event) => { event.preventDefault(); void ask(question); }}><label htmlFor="sec-question">보고서 질문</label><textarea id="sec-question" value={question} maxLength={4000} onChange={(event) => setQuestion(event.target.value)} disabled={!!busy} placeholder="이 기업의 사업보고서에 대해 질문하세요." /><button disabled={!!busy || !question.trim()}>질문 보내기</button>{abort.current && <button type="button" onClick={() => abort.current?.abort()}>중단</button>}</form>}
  </main>;
}
