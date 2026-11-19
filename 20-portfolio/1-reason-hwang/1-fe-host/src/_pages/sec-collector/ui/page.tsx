"use client";

import { useState } from "react";
import { ApiTesting, type ApiTestExecutor } from "./ApiTesting";
import { useExecutionLock } from "./useExecutionLock";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CompanyList } from "./CollectorLists";
import { CollectionControls } from "./CollectionControls";
import { collectorServices, useSecCollector, type CollectorServices } from "./useSecCollector";
import { ErrorNotice } from "./collector-primitives";
import { CurrentCollection } from "./CurrentCollection";
import { DebugDrawer } from "./DebugDrawer";

const metricLabels = { companies: "전체 기업", tickerCompanies: "티커 보유 기업", totalFilings: "전체 공시", contentFilings: "원문 보유 공시" } as const;
function CollectorDashboard({ controller: c }: { controller: ReturnType<typeof useSecCollector> }) {
  const fetching = Object.values(c.loading).some(Boolean);
  return <div className="grid min-w-0 gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">SEC 수집 관리</h1><p className="mt-1 text-sm text-muted-foreground">기업과 저장된 공시를 조회하고 SEC 수집 API를 실행합니다.</p></div><div className="flex gap-2"><Button disabled={c.busy} onClick={() => void c.execute("directory")}>기업 목록 동기화</Button><Button variant="outline" disabled={fetching} onClick={c.refresh}><RefreshCw aria-hidden="true" />새로고침</Button></div></header>
    <section aria-label="수집 현황" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(metricLabels).map(([key, label]) => <div key={key} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{c.overview ? c.overview[key as keyof typeof metricLabels].toLocaleString() : "—"}</p></div>)}</section>
    <p className="text-sm text-muted-foreground">기업 목록 동기화는 기업 목록만 갱신합니다. 공시는 수집하지 않습니다.</p>
    {c.runs.find(run => run.kind === "directory") && <p role="status">{(() => { const run = c.runs.find(item => item.kind === "directory")!; return run.status === "active" ? "기업 목록 동기화 중…" : run.status === "completed" ? `동기화 완료: ${Number((run.result as { syncedCount?: number })?.syncedCount ?? 0).toLocaleString()}건 처리` : `동기화 실패: ${run.message ?? "다시 시도하세요."} 버튼으로 재시도할 수 있습니다.`; })()}</p>}
    <p className="text-xs text-muted-foreground">통계 마지막 성공 조회: {c.overview?.retrievedAt ? new Date(c.overview.retrievedAt).toLocaleString() : "없음"}{c.loading.overview ? " · 갱신 중" : c.errors.overview ? " · 갱신 실패 (이전 통계)" : ""}</p>
    <ErrorNotice text={c.errors.overview} />{c.errors.overview && <Button variant="outline" onClick={c.refresh}>통계 재시도</Button>}
    <CurrentCollection run={c.runs[0]} />
    <details aria-label="공시 양식별 통계" className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">양식별 공시</summary>{c.overview?.forms.map(form => <p key={form.formType}>{form.formType}: 메타데이터 {form.total.toLocaleString()} / 원문 보유 {form.content.toLocaleString()}</p>)}</details>
    <CompanyList controller={c} />
    <details id="bulk-collection" className="rounded-xl border bg-card p-2"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">일괄 수집 작업</summary><div className="pt-2"><CollectionControls controller={c} /></div></details>
  </div>;
}

export default function SecCollectorPage({ services = collectorServices, apiExecutor }: { services?: CollectorServices; apiExecutor?: ApiTestExecutor }) {
  const execution = useExecutionLock();
  const controller = useSecCollector(services, execution);
  const [tab, setTab] = useState("collection");
  return <main className="mx-auto max-w-[1600px] p-4 pb-20 md:p-6" aria-label="SEC 수집 관리">
    <DebugDrawer controller={controller} />
    <div role="tablist" aria-label="SEC 수집 관리 화면" className="mb-5 flex flex-wrap gap-2 border-b pb-3">
      {[{ id: "collection", label: "수집 관리" }, { id: "api", label: "API Testing" }].map(item => <Button key={item.id} role="tab" id={`collector-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`collector-panel-${item.id}`} variant={tab === item.id ? "default" : "outline"} tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "collection" : event.key === "End" ? "api" : item.id === "collection" ? "api" : "collection";
        setTab(next); document.getElementById(`collector-tab-${next}`)?.focus();
      }} onClick={() => setTab(item.id)}>{item.label}</Button>)}
      {execution.owner && <span role="status" className="self-center text-xs text-muted-foreground">{execution.owner === "collection" ? "수집 요청 실행 중" : "API 요청 실행 중"}</span>}
    </div>
    <div role="tabpanel" id="collector-panel-collection" aria-labelledby="collector-tab-collection" hidden={tab !== "collection"}><CollectorDashboard controller={controller} /></div>
    <div role="tabpanel" id="collector-panel-api" aria-labelledby="collector-tab-api" hidden={tab !== "api"}><ApiTesting execution={execution} execute={apiExecutor} onComplete={controller.refresh} /></div>
  </main>;
}
