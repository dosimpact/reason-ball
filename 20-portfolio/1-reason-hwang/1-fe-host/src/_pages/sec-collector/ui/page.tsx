"use client";

import { RefreshCw, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { CompanyList, FilingList } from "./CollectorLists";
import { CollectionControls } from "./CollectionControls";
import { collectorServices, useSecCollector, type CollectorServices } from "./useSecCollector";
import { ErrorNotice, Section } from "./collector-primitives";
import { filingContentUrl } from "../api/secCollectorApi";

const statusLabels = { active: "실행 중", completed: "완료", partial: "일부 실패", error: "오류", disconnected: "연결 중단" };
const metricLabels = { companies: "기업", totalFilings: "전체 공시", downloaded: "원문 완료", pending: "다운로드 대기", failed: "다운로드 실패" } as const;
export default function SecCollectorPage({ services = collectorServices }: { services?: CollectorServices }) {
  const c = useSecCollector(services);
  const fetching = Object.values(c.loading).some(Boolean);
  return <main className="mx-auto grid max-w-[1600px] gap-5 p-4 pb-20 md:p-6" aria-label="SEC 수집 관리">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">SEC 수집 관리</h1><p className="mt-1 text-sm text-muted-foreground">기업과 저장된 공시를 조회하고 SEC 수집 API를 실행합니다.</p></div><Button variant="outline" disabled={fetching} onClick={c.refresh}><RefreshCw aria-hidden="true" />새로고침</Button></header>
    <section aria-label="수집 현황" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Object.entries(metricLabels).map(([key, label]) => <div key={key} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{c.overview ? c.overview[key as keyof typeof metricLabels].toLocaleString() : "—"}</p></div>)}</section>
    <div><p className="text-xs text-muted-foreground">집계 범위: 현재 티커가 있는 기업과 공시 · 서버 전체 건수 · 조회 시각 {c.overview?.retrievedAt ? new Date(c.overview.retrievedAt).toLocaleString() : "조회 중"}. 집계 요청은 여러 개로 나뉘므로 동일 트랜잭션 스냅샷은 아닙니다.</p><ErrorNotice text={c.errors.overview} /></div>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.8fr)]"><CompanyList controller={c} /><FilingList controller={c} /></div>
    {c.detail && <Section title="공시 상세" action={<Button variant="ghost" onClick={() => c.setDetail(undefined)}>상세 닫기</Button>}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{Object.entries({ "CIK": c.detail.cik, "접수번호": c.detail.accessionNo, "양식": c.detail.formType, "제출일": c.detail.filingDate, "보고일": c.detail.reportDate, "다운로드 상태": c.detail.status, "파서 상태": c.detail.parserStatus || "미처리", "실제 원문 크기(bytes)": c.detail.documentSizeBytes, "원문 저장 시각": c.detail.documentDownloadedAt, "재시도 횟수": c.detail.retryCount, "수정본 연결": c.detail.amendmentLinkStatus }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value ?? "—"}</dd></div>)}</dl>
      {c.detail.errorMessage && <p role="alert" className="mt-3 break-words text-sm text-destructive">{c.detail.errorMessage}</p>}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">{c.detail.status === "downloaded" ? <a className="inline-flex items-center gap-1 underline" href={filingContentUrl(c.detail.cik, c.detail.accessionNo)} target="_blank" rel="noopener noreferrer">저장 원문 새 탭에서 열기<ExternalLink size={14} aria-hidden="true" /></a> : <span className="text-muted-foreground">원문 다운로드 완료 후 열 수 있습니다.</span>}{/^https:\/\/([\w-]+\.)?sec\.gov\//i.test(c.detail.filingUrl) && <a className="underline" href={c.detail.filingUrl} target="_blank" rel="noopener noreferrer">SEC 출처</a>}</div>
      {!!c.detail.original && <p className="mt-3 text-sm">연결된 원본: {c.detail.original.accessionNo}</p>}{!!c.detail.amendments?.length && <p className="mt-2 break-all text-sm">연결된 수정본: {c.detail.amendments.map(item => item.accessionNo).join(", ")}</p>}
    </Section>}
    <CollectionControls controller={c} />
    <Section title="현재 세션 실행 기록"><p className="mb-3 text-xs text-muted-foreground">이 화면을 연 이후의 실행만 표시합니다. 새로고침하거나 화면을 떠나면 기록이 사라집니다.</p>{!c.runs.length ? <p className="text-sm text-muted-foreground">아직 실행한 수집 요청이 없습니다.</p> : <ol className="grid gap-3">{c.runs.map(run => <li key={run.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{run.kind === "directory" ? "기업 디렉터리 동기화" : run.kind === "selected" ? "선택 기업 수집" : "전체 기업 수집"}</strong><Badge variant={run.status === "error" || run.status === "partial" || run.status === "disconnected" ? "destructive" : "secondary"}>{statusLabels[run.status]}</Badge><time className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</time></div>{run.message && <p className="mt-2 text-sm" role={run.status === "error" ? "alert" : "status"}>{run.message}</p>}<div aria-live="polite" className="mt-2 max-h-48 overflow-auto text-xs">{run.events.map((event, index) => <p key={index} className="mb-1 break-all"><strong>{event.type}</strong> {JSON.stringify(event.data)}</p>)}</div>{run.result !== undefined && <details className="mt-2 text-sm"><summary className="cursor-pointer">실행 결과 JSON</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(run.result, null, 2)}</pre></details>}</li>)}</ol>}</Section>
    <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">요청 / 응답 검사</summary><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">고정된 SEC API 요청만 표시합니다. 원문 본문은 목록·검사 데이터에 포함하지 않습니다.</p><Button variant="outline" onClick={() => void c.copyInspection()}><Copy aria-hidden="true" />{c.copied ? "복사됨" : "요청·응답 복사"}</Button></div><ErrorNotice text={c.errors.copy} /><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify({ request: c.inspection ?? "실행 요청 없음", http: c.traces, reads: { overview: c.overview, companies: { filters: c.companyFilters, response: c.companies }, filings: { filters: c.filingFilters, response: c.filings } }, errors: c.errors }, null, 2)}</pre></details>
  </main>;
}
