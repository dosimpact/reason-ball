"use client";
import { useEffect, useState } from "react";
import { canStart, isActive, stageNames, stages, type ExtractionModel, type ModelingFiling, type ModelingRun, type ResultPage, type Stage, type ModelingEvent } from "../model/types";

const button = "rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed";
const panel = "rounded-xl border bg-card p-5 space-y-4";
export interface ModelingViewProps {
  filings: ModelingFiling[]; cikFilter: string; applyFilter: (cik: string) => void; filingPage: number; filingTotal: number; setFilingPage: (page: number) => void; selected: ModelingFiling | null; runs: ModelingRun[];
  run: ModelingRun | null; events: ModelingEvent[]; result: ResultPage | null;
  stage: Stage; page: number; loading: boolean; busy: boolean; error: string;
  refresh: () => void; select: (filing: ModelingFiling) => void; changeStage: (stage: Stage) => void;
  setPage: (page: number) => void; inspectRun: (run: ModelingRun) => void;
  start: (stage: Stage, model: ExtractionModel) => unknown;
  mutateRun: (operation: "retry" | "cancel") => unknown;
  moreEvents?: () => unknown; inspectEvidence: (id: string) => Promise<unknown>; search: (query: string) => Promise<unknown>;
}
function JsonDetail({ value }: { value: unknown }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>;
}
function resultTitle(item: Record<string, unknown>, index: number, stage: Stage) {
  if (stage !== 3) return `${String(item.itemCode ?? item.type ?? index + 1)} ${String(item.title ?? item.text ?? "").slice(0, 130)}`;
  const concept = String(item.label ?? item.localName ?? item.conceptQName ?? "XBRL").split("}").pop();
  const context = (item.context ?? {}) as Record<string, unknown>;
  const unit = (item.unit ?? {}) as { numerator?: string[]; denominator?: string[] };
  const displayUnit = (unit.numerator ?? []).map(value => value.split("}").pop()).join(" × ");
  const period = context.instantDate ?? [context.startDate, context.endDate].filter(Boolean).join(" ~ ");
  const value = item.isNil ? "nil (보고값 없음)" : item.valueType === "text" ? "텍스트 공시" : String(item.normalizedValue ?? item.rawValue ?? "");
  return `${concept} · ${value} ${displayUnit} · ${period}`.slice(0, 220);
}
function Results({ result, stage }: { result: ResultPage | null; stage: Stage }) {
  if (!result) return <p role="status" className="text-muted-foreground">결과를 불러오는 중이거나 아직 생성되지 않았습니다.</p>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">활성 결과 {result.generationId ?? "없음"} · {result.total ?? result.items.length}건</p>
    {!result.items.length && <p>이 단계의 공개된 결과가 없습니다.</p>}
    {result.items.map((item, index) => <details className="rounded border p-3" key={String(item.id ?? index)}>
      <summary className="cursor-pointer font-medium">{resultTitle(item, index, stage)}</summary>
      {stage === 1 && typeof item.displayHtml === "string" && <iframe title={`Item 미리보기 ${item.itemCode ?? index + 1}`} sandbox="" referrerPolicy="no-referrer" className="mt-3 h-96 w-full rounded border bg-white" srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{font-family:system-ui;padding:16px;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ddd;padding:4px}</style>${item.displayHtml}`} />}
      {typeof item.text === "string" && <pre className="my-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm">{item.text}</pre>}
      <details><summary className="cursor-pointer text-sm">구조화 데이터</summary><JsonDetail value={item} /></details>
    </details>)}
  </div>;
}
export function ModelingView(props: ModelingViewProps) {
  const [filterInput, setFilterInput] = useState(props.cikFilter);
  const [model, setModel] = useState<ExtractionModel>("gpt-5.6-sol");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<unknown>();
  const [evidenceResult, setEvidenceResult] = useState<unknown>();
  useEffect(() => { setSearchResult(undefined); setEvidenceResult(undefined); }, [props.selected?.cik, props.selected?.accessionNo]);
  return <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">SEC 모델링 관리</h1><p className="mt-1 text-sm text-muted-foreground">문서 구조 → 본문 검색·근거 · 독립 XBRL 분석</p></div><button className={button} onClick={props.refresh} disabled={props.loading}>새로고침</button></header>
    {props.error && <div role="alert" className="rounded border border-red-400 p-4 text-red-600">{props.error}</div>}
    <section aria-label="모델링 공시 목록" className={panel}>
      <h2 className="font-semibold">공시별 진행 상태</h2><form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); props.applyFilter(filterInput); }}><label className="text-sm">CIK 필터 <input aria-label="CIK 필터" className="rounded border bg-background p-2" inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} value={filterInput} onChange={event => setFilterInput(event.target.value)} placeholder="예: 1834584" /></label><button className={button} disabled={props.loading}>공시 필터 적용</button><button type="button" className={button} onClick={() => { setFilterInput(""); props.applyFilter(""); }}>전체 공시</button></form>
      {props.loading && <p role="status">공시를 불러오는 중입니다.</p>}
      {!props.loading && !props.filings.length && <p>분석할 공시가 없습니다. SEC 수집 관리에서 원본을 수집하세요.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">기업 / 공시</th>{stages.map(stage => <th className="p-2" key={stage}>모델링 {stage}<div className="font-normal text-muted-foreground">{stageNames[stage]}</div></th>)}</tr></thead><tbody>
        {props.filings.map(filing => <tr key={`${filing.cik}/${filing.accessionNo}`} className="border-t"><td className="p-2"><button className="text-left underline underline-offset-4" aria-label={`공시 선택 ${filing.ticker} ${filing.accessionNo}`} disabled={props.busy} onClick={() => props.select(filing)}>{filing.ticker || filing.companyName} · {filing.formType}<span className="block text-xs text-muted-foreground">{filing.reportDate} · {filing.accessionNo}</span></button>{!filing.hasSource && <span className="text-xs">원본 입력 필요</span>}</td>{stages.map(stage => { const state = filing.stages[String(stage)]; return <td className="p-2" key={stage}><span>{state?.status ?? "미처리"}</span>{(state?.stale || state?.readiness === "stale") && <span> · 재처리 필요</span>}{state?.resultCount !== undefined && <span> · {state.resultCount}건</span>}</td>; })}</tr>)}
      </tbody></table></div><div className="flex items-center gap-3"><button className={button} disabled={props.loading || props.filingPage === 1} onClick={() => props.setFilingPage(props.filingPage - 1)}>이전 공시</button><span>{props.filingPage} 페이지 · {props.filingTotal}건</span><button className={button} disabled={props.loading || props.filingPage * 20 >= props.filingTotal} onClick={() => props.setFilingPage(props.filingPage + 1)}>다음 공시</button></div>
    </section>
    {props.selected && <>
      <section className={panel} aria-label="공시 모델링 제어"><h2 className="font-semibold">{props.selected.ticker} · {props.selected.accessionNo}</h2>
        <label className="flex items-center gap-3 text-sm">지식 추출 모델<select className="rounded border bg-background p-2" value={model} onChange={event => setModel(event.target.value as ExtractionModel)}><option value="gpt-5.6-sol">sol</option><option value="gpt-5.6-luna">luna</option></select></label>
        <div className="flex flex-wrap gap-2">{stages.map(stage => <button key={stage} className={button} disabled={props.busy || !canStart(props.selected!, stage)} onClick={() => props.start(stage, model)}>모델링 {stage} 실행</button>)}</div>
        <p className="text-xs text-muted-foreground">모델링 2는 모델링 1의 공개된 결과가 필요합니다. 모델링 3은 원본 XBRL을 독립적으로 처리합니다. 재실행 실패 시 기존 성공 결과를 유지합니다.</p>
      </section>
      <section className={panel} aria-label="모델링 결과"><h2 className="font-semibold">가공 결과</h2><div className="flex flex-wrap gap-2">{stages.map(stage => <button className={button} aria-pressed={stage === props.stage} key={stage} onClick={() => props.changeStage(stage)}>{stageNames[stage]}</button>)}</div><Results result={props.result} stage={props.stage} /><div className="flex items-center gap-3"><button className={button} disabled={props.page === 1} onClick={() => props.setPage(props.page - 1)}>이전 결과</button><span>{props.page} 페이지</span><button className={button} disabled={!props.result || props.result.items.length < 20 || (props.result.total !== undefined && props.page * 20 >= props.result.total)} onClick={() => props.setPage(props.page + 1)}>다음 결과</button></div></section>
      <section className={panel} aria-label="실행 이력"><h2 className="font-semibold">실행 이력</h2>{!props.runs.length && <p>실행 기록이 없습니다. 기존 결과를 성공 실행으로 간주하지 않습니다.</p>}{props.runs.map(run => <button className={`${button} mr-2`} key={run.id} onClick={() => props.inspectRun(run)}>모델링 {run.stage} · {run.status} · {run.createdAt}</button>)}</section>
      <section className={panel} aria-label="검색 테스트"><h2 className="font-semibold">선택 공시 검색 테스트</h2><form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearchResult(undefined); setEvidenceResult(undefined); void props.search(query).then(setSearchResult); }}><input className="min-w-0 flex-1 rounded border bg-background p-2" aria-label="검색 질문" value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 주요 사업 위험은 무엇인가요?" /><button className={button} disabled={props.busy || !query.trim()}>검색</button></form>{searchResult !== undefined && <SearchEvidence result={searchResult} evidence={evidenceResult} busy={props.busy} inspect={id => { setEvidenceResult(undefined); void props.inspectEvidence(id).then(setEvidenceResult); }} />}</section>
    </>}
    {props.run && <section className={panel} aria-label="실행 상세"><h2 className="font-semibold">실행 상세 · {props.run.status}</h2><p className="break-all text-xs">{props.run.runId ?? props.run.id}</p><div className="flex gap-2"><button className={button} disabled={props.busy || !isActive(props.run.status)} onClick={() => props.mutateRun("cancel")}>실행 취소</button><button className={button} disabled={props.busy || !["FAILED", "CANCELLED"].includes(props.run.status)} onClick={() => props.mutateRun("retry")}>실패 작업 재시도</button></div>{props.run.error ? <JsonDetail value={props.run.error} /> : null}<details><summary>작업 단위</summary><JsonDetail value={props.run.workUnits ?? []} /></details><ol className="space-y-2">{props.events.map(event => <li className="rounded border p-2 text-xs" key={event.id}>{event.createdAt} · {event.type}<JsonDetail value={event.payload} /></li>)}</ol>{props.moreEvents && <button className={button} onClick={props.moreEvents}>이벤트 더 보기</button>}</section>}
  </main>;
}

function SearchEvidence({ result, evidence, busy, inspect }: { result: unknown; evidence: unknown; busy: boolean; inspect: (id: string) => void }) {
  const rows = result && typeof result === "object" && "items" in result && Array.isArray(result.items) ? result.items as Record<string, unknown>[] : [];
  const detail = evidence && typeof evidence === "object" ? evidence as Record<string, unknown> : null;
  const chunks = detail && Array.isArray(detail.supportingChunks) ? detail.supportingChunks as Record<string, unknown>[] : [];
  return <div className="space-y-4">
    {!rows.length && <p>검색 결과가 없습니다.</p>}
    <ol className="space-y-3">{rows.map((row, index) => <li className="space-y-2 rounded border p-3" key={String(row.evidenceId ?? row.id ?? index)}>
      <p className="text-sm font-medium">{String(row.type ?? "근거")} · Item {String(row.itemCode ?? "—")}</p>
      <p className="whitespace-pre-wrap text-sm">{String(row.text ?? "")}</p>
      <button type="button" className={button} disabled={busy || !(row.evidenceId || row.id)} onClick={() => inspect(String(row.evidenceId ?? row.id))}>근거 보기 {index + 1}</button>
    </li>)}</ol>
    {detail && <section aria-label="검색 근거 상세" className="space-y-3 rounded border p-4">
      <h3 className="font-semibold">검색 근거 상세</h3>
      <p className="text-sm">{detail.isActive === true ? "현재 공개 결과" : detail.isActive === false ? "과거 공개 결과" : "공개 상태 확인 필요"}</p>
      <p className="break-all text-xs text-muted-foreground">Item {String(detail.itemId ?? "—")} · {String(detail.generationId ?? "")}</p>
      <p className="whitespace-pre-wrap text-sm">{String(detail.text ?? "")}</p>
      <h4 className="font-medium">연결된 Chunk 원문</h4>
      {chunks.length ? chunks.map((chunk, index) => <pre key={String(chunk.id ?? index)} className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm">{String(chunk.text ?? "")}</pre>) : <p>연결된 Chunk가 없습니다.</p>}
      {typeof detail.displayHtml === "string" && detail.displayHtml && <iframe title="검색 근거 Item 미리보기" sandbox="" referrerPolicy="no-referrer" className="h-96 w-full rounded border bg-white" srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{font-family:system-ui;padding:16px;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ddd;padding:4px}</style>${detail.displayHtml}`} />}
      <details><summary>근거 구조화 데이터</summary><JsonDetail value={detail} /></details>
    </section>}
    <details><summary>검색 구조화 데이터</summary><JsonDetail value={result} /></details>
  </div>;
}
