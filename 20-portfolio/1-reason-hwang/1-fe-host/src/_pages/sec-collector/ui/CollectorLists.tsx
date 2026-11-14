import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import type { useSecCollector } from "./useSecCollector";
import { controlClass, ErrorNotice, Field, PageNav, Section } from "./collector-primitives";
type Controller = ReturnType<typeof useSecCollector>;
const cell = "border-b px-3 py-2 text-left text-sm align-top";

export function CompanyList({ controller: c }: { controller: Controller }) {
  const [query, setQuery] = useState("");
  return <Section title="기업 목록" action={<span className="text-sm text-muted-foreground">선택 {c.selected.length}개</span>}>
    <form className="mb-3 flex items-end gap-2" onSubmit={event => { event.preventDefault(); c.setCompanyFilters(previous => ({ ...previous, page: 1, q: query.trim() || undefined })); }}><div className="flex-1"><Field label="기업 검색"><input className={controlClass} placeholder="티커 또는 기업명" value={query} onChange={event => setQuery(event.target.value)} /></Field></div><Button type="submit" disabled={c.loading.companies}>검색</Button></form>
    <ErrorNotice text={c.errors.companies} />
    {(c.loading.companies || c.errors.companies) && c.companies && <p className="mb-2 text-xs text-muted-foreground">이전 성공 조회 결과를 표시합니다. 새 조회가 완료되면 갱신됩니다.</p>}
    <div className="overflow-x-auto" aria-busy={c.loading.companies}><table className="w-full"><caption className="sr-only">SEC 기업 목록</caption><thead><tr><th className={cell}>선택</th><th className={cell}>기업 · CIK</th><th className={cell}>공시</th></tr></thead><tbody>
      {c.companies?.items.map(company => <tr key={company.cik}><td className={cell}><input type="checkbox" aria-label={`기업 선택 ${company.ticker ?? company.cik}`} checked={c.selected.some(item => item.cik === company.cik)} onChange={event => c.setSelected(previous => event.target.checked ? [...previous.filter(item => item.cik !== company.cik), company] : previous.filter(item => item.cik !== company.cik))} /></td><td className={cell}><strong>{company.ticker}</strong><div className="max-w-64 break-words">{company.name}</div><div className="text-xs text-muted-foreground">{company.cik} · SIC {company.sic ?? "—"}</div></td><td className={cell}><Button variant="outline" aria-label={`공시 보기 ${company.ticker}`} onClick={() => c.setFilingFilters(previous => ({ ...previous, page: 1, cik: company.cik, ticker: undefined }))}>공시 보기</Button></td></tr>)}
      {!c.companies?.items.length && <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">{c.loading.companies ? "기업을 조회하는 중…" : "조건에 맞는 기업이 없습니다."}</td></tr>}
    </tbody></table></div>
    {c.companies && <PageNav {...c.companies.pagination} busy={c.loading.companies} onPage={page => c.setCompanyFilters(previous => ({ ...previous, page }))} />}
    {!!c.selected.length && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">수집 대상</span>{c.selected.map(company => <Badge key={company.cik} variant="secondary">{company.ticker ?? company.cik}</Badge>)}<Button variant="ghost" onClick={() => c.setSelected([])}>선택 해제</Button></div>}
  </Section>;
}

export function FilingList({ controller: c }: { controller: Controller }) {
  const [draft, setDraft] = useState(c.filingFilters);
  const [parserMode, setParserMode] = useState("all");
  const [filterError, setFilterError] = useState("");
  useEffect(() => {
    setDraft(c.filingFilters);
    setParserMode(c.filingFilters.parserStatus === undefined ? "all" : c.filingFilters.parserStatus === "" ? "unprocessed" : "custom");
    setFilterError("");
  }, [c.filingFilters]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cik = draft.cik?.trim();
    if (draft.includeFormerRegistrants && !/^\d{1,10}$/.test(cik ?? "")) { setFilterError("이전 법인 공시를 포함하려면 CIK를 명시하세요."); return; }
    setFilterError("");
    c.setFilingFilters({ ...draft, page: 1, cik: cik || undefined, ticker: draft.ticker?.trim() || undefined, parserStatus: parserMode === "unprocessed" ? "" : parserMode === "custom" ? draft.parserStatus ?? "" : undefined });
  }
  return <Section title="수집된 공시" action={<Button variant="outline" onClick={() => { c.setFilingFilters({ page: 1, pageSize: 10 }); }}>전체 공시</Button>}>
    <p className="mb-3 text-sm text-muted-foreground">현재 조회 범위: {c.filingFilters.cik ? `CIK ${c.filingFilters.cik}` : c.filingFilters.ticker ?? "티커가 있는 전체 기업"}</p>
    <form onSubmit={submit} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="CIK"><input name="cik" className={controlClass} value={draft.cik ?? ""} placeholder="예: 0000320193" onChange={event => setDraft(previous => ({ ...previous, cik: event.target.value }))} /></Field>
      <Field label="티커"><input className={controlClass} value={draft.ticker ?? ""} placeholder="예: AAPL" onChange={event => setDraft(previous => ({ ...previous, ticker: event.target.value }))} /></Field>
      <Field label="양식"><input name="formType" className={controlClass} value={draft.formType ?? ""} onChange={event => setDraft(previous => ({ ...previous, formType: event.target.value || undefined }))} placeholder="전체 · 예: 10-K, 10-K/A" /></Field>
      <Field label="제출일 이후"><input name="since" type="date" className={controlClass} value={draft.since ?? ""} onChange={event => setDraft(previous => ({ ...previous, since: event.target.value || undefined }))} /></Field>
      <Field label="다운로드 상태"><select name="status" className={controlClass} value={draft.status ?? ""} onChange={event => setDraft(previous => ({ ...previous, status: event.target.value as "pending" | "downloaded" | "failed" || undefined }))}><option value="">전체</option><option value="downloaded">완료</option><option value="pending">대기</option><option value="failed">실패</option></select></Field>
      <Field label="파서 상태 필터"><select className={controlClass} value={parserMode} onChange={event => setParserMode(event.target.value)}><option value="all">전체</option><option value="unprocessed">미처리</option><option value="custom">직접 입력</option></select></Field>
      {parserMode === "custom" && <Field label="파서 상태 값"><input name="parserStatus" className={controlClass} value={draft.parserStatus ?? ""} onChange={event => setDraft(previous => ({ ...previous, parserStatus: event.target.value }))} placeholder="상태 문자열" /></Field>}
      <details className="sm:col-span-2 lg:col-span-3"><summary className="cursor-pointer text-sm">고급: 이전 법인</summary><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.includeFormerRegistrants} onChange={event => setDraft(previous => ({ ...previous, includeFormerRegistrants: event.target.checked }))} />명시한 CIK의 이전 법인 공시 포함</label></details>
      <Button type="submit" disabled={c.loading.filings}>공시 조회</Button>
    </form>
    <ErrorNotice text={filterError || c.errors.filings} />
    {(c.loading.filings || c.errors.filings) && c.filings && <p className="mb-2 text-xs text-muted-foreground">이전 성공 조회 결과를 표시합니다. 새 조회가 완료되면 갱신됩니다.</p>}
    <div className="overflow-x-auto" aria-busy={c.loading.filings}><table className="w-full"><caption className="sr-only">저장된 공시 목록</caption><thead><tr><th className={cell}>양식 · 제출일</th><th className={cell}>CIK · 접수번호</th><th className={cell}>다운로드 · 파서</th><th className={cell}>상세</th></tr></thead><tbody>
      {c.filings?.items.map(filing => <tr key={`${filing.cik}:${filing.accessionNo}`}><td className={cell}><strong>{filing.formType}</strong><div>{filing.filingDate ?? "—"}</div><div className="text-xs text-muted-foreground">보고일 {filing.reportDate ?? "—"}</div></td><td className={`${cell} max-w-60 break-all`}>{filing.cik}<div>{filing.accessionNo}</div></td><td className={cell}><Badge variant={filing.status === "failed" ? "destructive" : "secondary"}>{filing.status}</Badge><div className="mt-1 text-xs">{filing.parserStatus || "파서 미처리"}</div></td><td className={cell}><Button variant="outline" aria-label={`공시 상세 ${filing.accessionNo}`} onClick={() => c.setDetail(filing)}>상세</Button></td></tr>)}
      {!c.filings?.items.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">{c.loading.filings ? "공시를 조회하는 중…" : "조건에 맞는 공시가 없습니다."}</td></tr>}
    </tbody></table></div>
    {c.filings && <PageNav {...c.filings.pagination} busy={c.loading.filings} onPage={page => c.setFilingFilters(previous => ({ ...previous, page }))} />}
    <p className="mt-3 text-xs text-muted-foreground">원본과 수정본은 각각 표시합니다. 수정본을 자동 병합하지 않습니다.</p>
  </Section>;
}
