import { Fragment, useState } from "react";
import { Button } from "@/shared/ui/button";
import type { useSecCollector } from "./useSecCollector";
import { controlClass, ErrorNotice, Field, PageNav, Section } from "./collector-primitives";
import { filingContentUrl } from "../api/secCollectorApi";

type Controller = ReturnType<typeof useSecCollector>;
const cell = "border-b px-3 py-2.5 text-left text-sm align-top";

function FilingFilters({ controller: c }: { controller: Controller }) {
  const [formType, setFormType] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  return <form className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={event => {
    event.preventDefault();
    if (since && until && since > until) { setError("시작일은 종료일보다 늦을 수 없습니다."); return; }
    setError(""); c.setFilingFilters(previous => ({ ...previous, page: 1, formType: formType.trim() || undefined, since: since || undefined, until: until || undefined, hasContent: content === "" ? undefined : content === "true" }));
  }}>
    <Field label="공시 양식"><input className={controlClass} value={formType} onChange={event => setFormType(event.target.value)} placeholder="예: 10-K" /></Field>
    <Field label="제출 시작일"><input type="date" className={controlClass} value={since} onChange={event => setSince(event.target.value)} /></Field>
    <Field label="제출 종료일"><input type="date" className={controlClass} value={until} onChange={event => setUntil(event.target.value)} /></Field>
    <Field label="원문 보유"><select className={controlClass} value={content} onChange={event => setContent(event.target.value)}><option value="">전체</option><option value="true">보유</option><option value="false">미보유</option></select></Field>
    <Button type="submit" disabled={c.loading.filings}>공시 검색</Button><ErrorNotice text={error} />
  </form>;
}

export function CompanyList({ controller: c }: { controller: Controller }) {
  const [query, setQuery] = useState("");
  const expanded = c.filingFilters.cik;
  const currentResults = JSON.stringify(c.companyFilters) === JSON.stringify(c.appliedCompanyFilters) && !c.loading.companies && !c.errors.companies;
  const resetCompany = () => c.setFilingFilters({ page: 1, pageSize: 10 });
  return <Section title="기업 및 공시">
    <p className="mb-3 text-sm text-muted-foreground">티커가 있는 기업만 표시합니다. 티커 보유 여부는 상장 여부를 의미하지 않습니다.</p>
    <form className="mb-3 flex items-end gap-2" onSubmit={event => { event.preventDefault(); resetCompany(); c.setCompanyFilters(previous => ({ ...previous, page: 1, q: query.trim() || undefined })); }}>
      <div className="min-w-0 flex-1"><Field label="기업 검색"><input className={controlClass} placeholder="티커 또는 기업명" value={query} onChange={event => setQuery(event.target.value)} /></Field></div><Button type="submit" disabled={c.loading.companies}>검색</Button>
    </form>
    <ErrorNotice text={c.errors.companies} />
    {!!c.selected.length && <div className="mt-4 rounded-lg border bg-muted/40 p-3" aria-label="선택 기업 작업"><div className="flex flex-wrap items-center gap-3"><strong>선택한 기업 {c.selected.length}개</strong><details><summary className="cursor-pointer text-sm">목록 확인</summary><ul className="mt-2 grid gap-2">{c.selected.map(company => <li key={company.cik} className="flex items-center gap-2 text-sm">{company.name} ({company.ticker ?? company.cik}) <Button variant="ghost" aria-label={`${company.name} 선택 해제`} onClick={() => c.setSelected(previous => previous.filter(item => item.cik !== company.cik))}>선택 해제</Button></li>)}</ul></details><Button onClick={() => { const panel = document.getElementById("bulk-collection") as HTMLDetailsElement | null; if (panel) { panel.open = true; panel.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("prepare-selected-collection")?.focus(); } }}>선택 기업 수집</Button><Button variant="ghost" onClick={() => c.setSelected([])}>모두 선택 해제</Button></div></div>}
    <div className="overflow-x-auto" aria-busy={c.loading.companies}><table className="w-full"><caption className="sr-only">기업 및 공시 목록</caption><thead><tr><th className={cell}>일괄 수집</th><th className={cell}>티커</th><th className={cell}>기업명</th><th className={cell}>CIK</th><th className={cell}>공시</th></tr></thead><tbody>
      {currentResults && c.companies?.items.map(company => <Fragment key={company.cik}>
        <tr><td className={cell}><input type="checkbox" aria-label={`일괄 수집 대상 ${company.ticker ?? company.cik}`} checked={c.selected.some(item => item.cik === company.cik)} onChange={event => c.setSelected(previous => event.target.checked ? [...previous.filter(item => item.cik !== company.cik), company] : previous.filter(item => item.cik !== company.cik))} /></td><td className={cell}>{company.ticker}</td><td className={cell}>{company.name}</td><td className={cell}>{company.cik}</td><td className={cell}><Button variant="outline" aria-expanded={expanded === company.cik} onClick={() => c.setFilingFilters({ page: 1, pageSize: 10, cik: expanded === company.cik ? undefined : company.cik })}>{expanded === company.cik ? "접기" : "공시 펼치기"}</Button></td></tr>
        {expanded === company.cik && <tr><td colSpan={5} className="border-b p-3"><FilingFilters key={company.cik} controller={c} /><ErrorNotice text={c.errors.filings} />{(c.loading.filings || (c.filings?.items.length && c.filings.items.some(item => item.cik !== company.cik))) ? <p>공시 조회 중…</p> : c.errors.filings ? <p>공시 조회에 실패했습니다. 다시 펼쳐 주세요.</p> : !c.filings?.items.length ? <p>공시가 없습니다.</p> : <><div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">{company.name} 공시</caption><thead><tr><th className={cell}>양식</th><th className={cell}>제출일</th><th className={cell}>보고일</th><th className={cell}>접수번호</th><th className={cell}>원문</th><th className={cell}>작업</th></tr></thead><tbody>{c.filings.items.map(filing => { const run = c.runs.find(item => item.kind === "filing" && item.accessionNo === filing.accessionNo); return <tr key={filing.accessionNo}><td className={cell}>{filing.formType}</td><td className={cell}>{filing.filingDate ?? "—"}</td><td className={cell}>{filing.reportDate ?? "—"}</td><td className={cell}>{filing.accessionNo}</td><td className={cell}>{filing.hasContent ? "보유" : "미보유"}</td><td className={cell}>{filing.hasContent ? <a className="underline" href={filingContentUrl(filing.cik, filing.accessionNo)} target="_blank" rel="noopener noreferrer">원문 보기</a> : <Button disabled={c.busy} onClick={() => void c.executeFilingDownload(filing)}>{filing.status === "failed" ? "원문 수집 재시도" : "원문 수집"}</Button>}{filing.hasContent && <a className="ml-3 underline" href={`/sec-viewer?${new URLSearchParams({ cik: filing.cik, accessionNo: filing.accessionNo })}`} target="_blank" rel="noopener noreferrer">XBRL 보기</a>}{!filing.hasContent && filing.errorMessage && <p role="alert" className="mt-1 text-xs text-destructive">{filing.errorMessage}</p>}{run && <p role="status" className="mt-1 text-xs">{run.status === "active" ? "수집 중" : run.status === "completed" ? "완료 확인" : `수집 실패 또는 연결 중단: ${run.message ?? "다시 시도하세요."}`}</p>}</td></tr>; })}</tbody></table></div><PageNav {...c.filings.pagination} busy={c.loading.filings} onPage={page => c.setFilingFilters(previous => ({ ...previous, page }))} /></>}</td></tr>}
      </Fragment>)}
      {(!currentResults || !c.companies?.items.length) && <tr><td colSpan={5} className="p-6 text-center">{c.loading.companies ? "기업 조회 중…" : c.errors.companies ? "기업 조회에 실패했습니다." : "조건에 맞는 기업이 없습니다."}</td></tr>}
    </tbody></table></div>
    {currentResults && c.companies && <PageNav {...c.companies.pagination} busy={c.loading.companies} onPage={page => { resetCompany(); c.setCompanyFilters(previous => ({ ...previous, page })); }} />}

  </Section>;
}
