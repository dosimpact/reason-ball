"use client";
import { Fragment, useEffect, useState } from "react";
import { canStart, startBlockReason, statusLabel, initialModelingFilters, isActive, stageNames, stages, type ExtractionModel, type ModelingFiling, type ModelingRun, type ResultPage, type Stage, type ModelingEvent, type ModelingFilters, type ModelingOverview } from "../model/types";

const button = "rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed";
const panel = "rounded-xl border bg-card p-5 space-y-4";
export interface ModelingViewProps {
  filings: ModelingFiling[]; cikFilter: string; applyFilter: (cik: string) => void; filingPage: number; filingTotal: number; setFilingPage: (page: number) => void; selected: ModelingFiling | null; runs: ModelingRun[];
  run: ModelingRun | null; events: ModelingEvent[]; result: ResultPage | null;
  stage: Stage; page: number; loading: boolean; busy: boolean; error: string;
  filters?: ModelingFilters; applyFilters?: (filters: ModelingFilters) => void; collapse?: () => void; overview?: ModelingOverview; overviewLoading?: boolean; overviewError?: string; listError?: string; detailLoading?: boolean; detailError?: string;
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
      {stage === 3 && <div className="my-3 space-y-2 text-sm">
        <p className="font-medium">분류: {String(item.analysisCategory ?? "분류 정보 없음")}</p>
        <p>선정 정책 판정: {String(item.selectionReason ?? "—")}</p>
        {typeof item.importanceProbability === "number" && <p>중요도 확률: {(item.importanceProbability * 100).toFixed(1)}%</p>}
        {typeof item.categoryConfidence === "number" && <p>분류 신뢰도: {(item.categoryConfidence * 100).toFixed(1)}%</p>}
        {item.categoryProbabilities != null && <details><summary>분류별 확률</summary><JsonDetail value={item.categoryProbabilities} /></details>}
        <p className="text-xs text-muted-foreground">선정 정책: {String(item.selectionPolicyVersion ?? "—")}</p>
        {Array.isArray(item.evidence) && item.evidence.map((value, evidenceIndex) => {
          const evidence = value as Record<string, unknown>;
          return <blockquote key={String(evidence.id ?? evidenceIndex)} className="space-y-1 border-l-2 pl-3">
            <p className="text-xs text-muted-foreground">원문 fact: {String(evidence.sourceFactId ?? item.sourceFactId ?? "—")}</p>
            {Boolean(evidence.tableHeader) && <p>{String(evidence.tableHeader)}</p>}
            {Boolean(evidence.precedingText) && <p>{String(evidence.precedingText)}</p>}
            <p className="whitespace-pre-wrap">{String(evidence.text ?? "")}</p>
            {Boolean(evidence.continuationText) && <p className="whitespace-pre-wrap">{String(evidence.continuationText)}</p>}
            {evidence.truncated === true && <p className="text-xs">근거 일부가 길이 제한으로 생략되었습니다.</p>}
          </blockquote>;
        })}
      </div>}
      {typeof item.text === "string" && <pre className="my-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm">{item.text}</pre>}
      <details><summary className="cursor-pointer text-sm">구조화 데이터</summary><JsonDetail value={item} /></details>
    </details>)}
  </div>;
}
function StageState({ filing, stage }: { filing: ModelingFiling; stage: Stage }) {
  const state = filing.stages[String(stage)];
  const publication = state?.status === "unavailable" || state?.status === "unsupported" ? state.status : state?.readiness ?? (state?.generationId ? "ready" : "unprocessed");
  return <div className="space-y-1"><span className={publication === "ready" ? "text-emerald-700 dark:text-emerald-400" : publication === "stale" || publication === "unavailable" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>게시: {statusLabel(publication)}</span><p className="text-xs">최근 실행: {state?.latestRun ? statusLabel(state.latestRun.status) : isActive(state?.status) ? statusLabel(state?.status) : "없음"}</p>{state?.resultCount !== undefined && <p className="text-xs">결과 {state.resultCount.toLocaleString()}건</p>}</div>;
}
export function ModelingView(props: ModelingViewProps) {
  const [draft, setDraft] = useState<ModelingFilters>(props.filters ?? { ...initialModelingFilters, cik: props.cikFilter });
  const totalPages = Math.max(1, Math.ceil(props.filingTotal / 20));
  const overview = props.overview;
  const activeJobs = overview ? Object.values(overview.stages).reduce((total, stage) => total + stage.latestRuns.QUEUED + stage.latestRuns.RUNNING, 0) : undefined;
  const failedJobs = overview ? Object.values(overview.stages).reduce((total, stage) => total + stage.latestRuns.FAILED, 0) : undefined;
  const apply = (filters: ModelingFilters) => props.applyFilters ? props.applyFilters(filters) : props.applyFilter(filters.cik);
  return <main className="mx-auto max-w-[1600px] space-y-5 p-4 pb-20 md:p-6" aria-label="SEC 모델링 관리">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">SEC 모델링 관리</h1><p className="mt-1 text-sm text-muted-foreground">공시를 펼쳐 수집 여부와 모델링 1·2·3의 게시 결과 및 실행 이력을 확인합니다.</p></div><button className={button} onClick={props.refresh} disabled={props.loading || props.overviewLoading}>새로고침</button></header>
    {props.error && <div role="alert" className="rounded border border-destructive/40 p-4 text-destructive">{props.error}</div>}
    <section aria-label="모델링 통계" aria-busy={props.overviewLoading} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["필터 범위 공시", overview?.totalFilings], ["원문 수집 완료", overview?.sourceCollected], ["원문 미보유", overview?.sourceMissing], ["진행 중 단계 작업", activeJobs], ["실패한 최근 단계 작업", failedJobs]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString() : "—"}</p></div>)}</section>
    <p className="text-xs text-muted-foreground">통계는 적용된 필터의 전체 PostgreSQL 공시 범위입니다. 최근 실행 성공은 현재 게시 결과가 있다는 뜻이 아닙니다. {props.overviewLoading ? "집계 갱신 중…" : overview ? `조회 기준: ${new Date(overview.retrievedAt).toLocaleString("ko-KR")}` : "집계 대기"}</p>
    {props.overviewError && <p role="alert" className="text-sm text-destructive">통계 조회 실패: {props.overviewError}</p>}
    {overview && <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">단계별 최근 실행 집계</summary><div className="mt-3 grid gap-3 md:grid-cols-3">{stages.map(stage => { const counts = overview.stages[String(stage)]; return counts && <div key={stage}><strong>모델링 {stage} · {stageNames[stage]}</strong><p className="text-sm">지원 공시 {counts.supported.toLocaleString()} · 미지원 {counts.unsupported.toLocaleString()}</p><p className="text-xs">대기 {counts.latestRuns.QUEUED} · 실행 {counts.latestRuns.RUNNING} · 성공 {counts.latestRuns.SUCCEEDED} · 실패 {counts.latestRuns.FAILED} · 취소 {counts.latestRuns.CANCELLED} · 실행 이력 없음 {counts.latestRuns.unprocessed}</p></div>; })}</div></details>}
    <section aria-label="모델링 공시 목록" className={panel}>
      <h2 className="font-semibold">공시별 진행 상태</h2>
      <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={event => { event.preventDefault(); if (!props.busy && !props.loading) apply(draft); }}>
        <label className="grid gap-1 text-sm">기업·공시 검색<input className="min-w-0 rounded border bg-background p-2" value={draft.q} maxLength={100} onChange={event => setDraft(previous => ({ ...previous, q: event.target.value }))} placeholder="티커·기업명·CIK·접수번호" /></label>
        <label className="grid gap-1 text-sm">CIK 필터<input aria-label="CIK 필터" className="min-w-0 rounded border bg-background p-2" inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} value={draft.cik} onChange={event => setDraft(previous => ({ ...previous, cik: event.target.value }))} placeholder="예: 1834584" /></label>
        <label className="grid gap-1 text-sm">공시 양식<select className="rounded border bg-background p-2" value={draft.formType} onChange={event => setDraft(previous => ({ ...previous, formType: event.target.value }))}><option value="">전체 지원 양식</option>{["10-K", "10-K/A", "10-Q"].map(form => <option key={form}>{form}</option>)}</select></label>
        <label className="grid gap-1 text-sm">원문 수집<select className="rounded border bg-background p-2" value={draft.sourceStatus} onChange={event => setDraft(previous => ({ ...previous, sourceStatus: event.target.value as ModelingFilters["sourceStatus"] }))}><option value="all">전체</option><option value="collected">수집 완료</option><option value="missing">미보유</option></select></label>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={props.loading || props.busy}>공시 필터 적용</button><button type="button" className={button} disabled={props.busy} onClick={() => { setDraft(initialModelingFilters); apply(initialModelingFilters); }}>전체 공시</button></div>
      </form>
      <p className="text-xs text-muted-foreground">입력한 조건은 필터 적용 후 반영됩니다. 현재 적용: CIK {props.filters?.cik || props.cikFilter || "전체"} · 검색 {props.filters?.q || "없음"} · 양식 {props.filters?.formType || "전체"} · 원문 {props.filters?.sourceStatus === "collected" ? "수집 완료" : props.filters?.sourceStatus === "missing" ? "미보유" : "전체"}</p>
      <p className="text-xs text-muted-foreground">양식별 실행 지원 범위는 다릅니다. 원문 수집 완료·현재 게시 상태·최근 실행 상태를 각각 구분합니다.</p>
      {props.loading && <p role="status">공시를 불러오는 중입니다. 이전 행은 조회가 끝날 때까지 조작할 수 없습니다.</p>}
      {props.listError && <p role="alert" className="text-destructive">공시 조회 실패: {props.listError}</p>}
      {!props.loading && !props.filings.length && !props.listError && <p>조건에 맞는 공시가 없습니다. <a className="underline" href="/sec-collector">SEC 수집 관리</a>에서 원문을 수집할 수 있습니다.</p>}
      <div className="overflow-x-auto" aria-busy={props.loading}><table className="w-full text-left text-sm"><caption className="sr-only">공시별 수집 및 모델링 진행 상태</caption><thead><tr>{["상세", "기업", "양식", "제출일 / 보고일", "접수번호", "원문 수집"].map(title => <th className="p-2" key={title}>{title}</th>)}{stages.map(stage => <th className="p-2" key={stage}>모델링 {stage}<span className="block text-xs font-normal">{stageNames[stage]}</span></th>)}</tr></thead><tbody>
        {props.filings.map(filing => { const key = `${filing.cik}/${filing.accessionNo}`; const expanded = props.selected?.cik === filing.cik && props.selected.accessionNo === filing.accessionNo; const region = `modeling-${filing.cik}-${filing.accessionNo}`; return <Fragment key={key}><tr className={expanded ? "border-t bg-muted/40" : "border-t"}>
          <td className="p-2 align-top"><button type="button" className={button} disabled={props.busy || props.loading || !!props.listError} aria-label={`${filing.ticker || filing.companyName} ${filing.accessionNo} ${expanded ? "접기" : "모델링 펼치기"}`} aria-expanded={expanded} aria-controls={region} onClick={() => expanded && props.collapse ? props.collapse() : props.select(filing)}>{expanded ? "접기" : "펼치기"}</button></td>
          <td className="p-2 align-top"><strong>{filing.ticker || "티커 없음"}</strong><p>{filing.companyName}</p><p className="text-xs text-muted-foreground">CIK {filing.cik}</p></td><td className="p-2 align-top">{filing.formType}</td><td className="whitespace-nowrap p-2 align-top text-xs">{filing.filingDate || "—"}<br />{filing.reportDate || "—"}</td><td className="break-all p-2 align-top text-xs">{filing.accessionNo}</td><td className="p-2 align-top">{filing.hasSource ? "수집 완료" : "미보유"}</td>{stages.map(stage => <td className="p-2 align-top" key={stage}><StageState filing={filing} stage={stage} /></td>)}
        </tr>{expanded && <tr><td colSpan={9} className="border-b bg-muted/20 p-3"><section id={region} aria-label={`${filing.ticker || filing.companyName} 공시 모델링 상세`}><FilingWorkspace key={key} {...props} /></section></td></tr>}</Fragment>; })}
      </tbody></table></div>
      <nav aria-label="공시 페이지" className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>총 {props.filingTotal.toLocaleString()}건 · {props.filingPage} / {totalPages} 페이지 · 20건씩</span><div className="flex gap-2"><button className={button} disabled={props.loading || props.busy || props.filingPage <= 1} onClick={() => props.setFilingPage(props.filingPage - 1)}>이전 공시</button><button className={button} disabled={props.loading || props.busy || props.filingPage >= totalPages} onClick={() => props.setFilingPage(props.filingPage + 1)}>다음 공시</button></div></nav>
    </section>
  </main>;
}

function FilingWorkspace(props: ModelingViewProps) {
  const [model, setModel] = useState<ExtractionModel>("gpt-5.6-sol");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<unknown>();
  const [evidenceResult, setEvidenceResult] = useState<unknown>();
  useEffect(() => { setSearchResult(undefined); setEvidenceResult(undefined); }, [props.selected?.cik, props.selected?.accessionNo]);
  return <div className="grid min-w-0 gap-4 text-left">
    {props.selected && <>
      <section className={panel} aria-label="공시 모델링 제어"><h2 className="font-semibold">{props.selected.ticker} · {props.selected.accessionNo}</h2>{props.selected.serviceError && <p role="alert" className="text-amber-700 dark:text-amber-400">현재 게시 상태를 확인하지 못했습니다. 최근 실행 이력과 게시 상태는 다릅니다.</p>}
        <label className="flex items-center gap-3 text-sm">모델링 1·2 추출 모델<select className="rounded border bg-background p-2" value={model} onChange={event => setModel(event.target.value as ExtractionModel)}><option value="gpt-5.6-sol">sol</option><option value="gpt-5.6-luna">luna</option></select></label>
        <div className="flex flex-wrap gap-2">{stages.map(stage => <button key={stage} className={button} disabled={props.busy || !canStart(props.selected!, stage)} title={startBlockReason(props.selected!, stage) ?? undefined} onClick={() => props.start(stage, stage === 3 ? "gpt-6-luna" : model)}>모델링 {stage} 실행</button>)}</div>
        <ul className="text-xs text-muted-foreground">{stages.map(stage => { const reason = startBlockReason(props.selected!, stage); return reason ? <li key={stage}>모델링 {stage}: {reason}</li> : null; })}</ul><p className="text-xs text-muted-foreground">모델링 2는 모델링 1의 공개된 결과가 필요합니다. 모델링 3은 모든 CIK의 10-K·10-Q 원본에서 중요한 XBRL 사실을 OpenAI Decisions API의 gpt-6-luna로 선별합니다. 표시되는 선정 사유는 확률과 임계값에 따른 정책 판정입니다. 재실행 실패 시 기존 성공 결과를 유지합니다.</p>
      </section>
      <section className={panel} aria-label="모델링 결과"><h2 className="font-semibold">가공 결과</h2><div className="flex flex-wrap gap-2">{stages.map(stage => <button className={button} aria-pressed={stage === props.stage} key={stage} onClick={() => props.changeStage(stage)}>{stageNames[stage]}</button>)}</div>{props.detailError && <p role="alert" className="text-destructive">{props.detailError}</p>}{props.detailLoading && <p role="status">게시 결과와 실행 이력을 갱신 중…</p>}{!props.result && (props.detailLoading || props.detailError) ? null : <Results result={props.result} stage={props.stage} />}<div className="flex items-center gap-3"><button className={button} disabled={props.page === 1} onClick={() => props.setPage(props.page - 1)}>이전 결과</button><span>{props.page} 페이지</span><button className={button} disabled={!props.result || props.result.items.length < 20 || (props.result.total !== undefined && props.page * 20 >= props.result.total)} onClick={() => props.setPage(props.page + 1)}>다음 결과</button></div></section>
      <section className={panel} aria-label="실행 이력"><h2 className="font-semibold">실행 이력</h2>{!props.runs.length && <p>실행 기록이 없습니다. 기존 결과를 성공 실행으로 간주하지 않습니다.</p>}{props.runs.map(run => <button className={`${button} mr-2`} key={run.id} disabled={props.busy} onClick={() => props.inspectRun(run)}>모델링 {run.stage} · {statusLabel(run.status)} · {run.createdAt}</button>)}</section>
      <section className={panel} aria-label="검색 테스트"><h2 className="font-semibold">선택 공시 검색 테스트</h2><form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearchResult(undefined); setEvidenceResult(undefined); void props.search(query).then(setSearchResult); }}><input className="min-w-0 flex-1 rounded border bg-background p-2" aria-label="검색 질문" value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 주요 사업 위험은 무엇인가요?" /><button className={button} disabled={props.busy || !query.trim()}>검색</button></form>{searchResult !== undefined && <SearchEvidence result={searchResult} evidence={evidenceResult} busy={props.busy} inspect={id => { setEvidenceResult(undefined); void props.inspectEvidence(id).then(setEvidenceResult); }} />}</section>
    </>}
    {props.run && <section className={panel} aria-label="실행 상세"><h2 className="font-semibold">실행 상세 · {statusLabel(props.run.status)}</h2><p className="break-all text-xs">{props.run.runId ?? props.run.id}</p><div className="flex gap-2"><button className={button} disabled={props.busy || !isActive(props.run.status)} onClick={() => props.mutateRun("cancel")}>실행 취소</button><button className={button} disabled={props.busy || !["FAILED", "CANCELLED"].includes(props.run.status)} onClick={() => props.mutateRun("retry")}>실패 작업 재시도</button></div>{props.run.error ? <JsonDetail value={props.run.error} /> : null}<details><summary>작업 단위</summary><JsonDetail value={props.run.workUnits ?? []} /></details><ol className="space-y-2">{props.events.map(event => <li className="rounded border p-2 text-xs" key={event.id}>{event.createdAt} · {event.type}<JsonDetail value={event.payload} /></li>)}</ol>{props.moreEvents && <button className={button} onClick={props.moreEvents}>이벤트 더 보기</button>}</section>}
  </div>;
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
