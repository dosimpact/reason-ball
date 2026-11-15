import { Copy, PanelRightOpen } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ErrorNotice } from "./collector-primitives";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import type { useSecCollector } from "./useSecCollector";

const statusLabels = { active: "실행 중", completed: "완료", partial: "일부 실패", error: "오류", disconnected: "연결 중단" };
const kindLabels: Record<string, string> = { directory: "기업 목록 동기화", selected: "선택 기업 수집", all: "전체 기업 수집", filing: "단일 공시 수집" };

export function DebugDrawer({ controller: c }: { controller: ReturnType<typeof useSecCollector> }) {
  return <Sheet>
    <SheetTrigger render={<Button aria-label="디버깅 패널 열기" className="fixed right-0 top-1/2 z-40 h-auto -translate-y-1/2 gap-2 rounded-r-none rounded-l-lg px-3 py-4 shadow-lg"><PanelRightOpen aria-hidden="true" className="size-4" /><span className="[writing-mode:vertical-rl]">디버깅</span></Button>} />
    <SheetContent side="right" className="w-[min(94vw,42rem)] overflow-y-auto sm:max-w-none">
      <SheetHeader className="border-b pr-14">
        <SheetTitle>SEC 수집 디버깅</SheetTitle>
        <SheetDescription>현재 세션의 실행 이벤트와 API 요청·응답 정보입니다. 이 패널은 요청 시에만 엽니다.</SheetDescription>
      </SheetHeader>
      <div className="grid gap-4 p-4">
        <section aria-labelledby="collector-session-runs" className="rounded-xl border bg-card p-4">
          <h2 id="collector-session-runs" className="mb-3 text-base font-semibold">현재 세션 실행 기록</h2>
          <p className="mb-3 text-xs text-muted-foreground">이 화면을 연 이후의 실행만 표시합니다. 새로고침하거나 화면을 떠나면 기록이 사라집니다.</p>
          {!c.runs.length ? <p className="text-sm text-muted-foreground">아직 실행한 수집 요청이 없습니다.</p> : <ol className="grid gap-3">{c.runs.map(run => <li key={run.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{kindLabels[run.kind] ?? run.kind}</strong><span className={`rounded-full px-2 py-0.5 text-xs ${run.status === "error" || run.status === "partial" || run.status === "disconnected" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>{statusLabels[run.status]}</span><time className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</time></div>
            {run.message && <p className="mt-2 text-sm" role={run.status === "error" ? "alert" : "status"}>{run.message}</p>}
            <div aria-live="polite" className="mt-2 max-h-48 overflow-auto text-xs">{run.events.map((event, index) => <p key={index} className="mb-1 break-all"><strong>{event.type}</strong> {JSON.stringify(event.data)}</p>)}</div>
            {run.result !== undefined && <details className="mt-2 text-sm"><summary className="cursor-pointer">실행 결과 JSON</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(run.result, null, 2)}</pre></details>}
          </li>)}</ol>}
        </section>
        <section aria-labelledby="collector-request-inspection" className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 id="collector-request-inspection" className="text-base font-semibold">요청 / 응답 검사</h2><Button variant="outline" onClick={() => void c.copyInspection()}><Copy aria-hidden="true" />{c.copied ? "복사됨" : "요청·응답 복사"}</Button></div>
          <p className="text-xs text-muted-foreground">고정된 SEC API 요청만 표시합니다. 원문 본문은 검사 데이터에 포함하지 않습니다.</p>
          <ErrorNotice text={c.errors.copy} />
          <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">{JSON.stringify({ request: c.inspection ?? "실행 요청 없음", http: c.traces, reads: { overview: c.overview, companies: { filters: c.companyFilters, response: c.companies }, filings: { filters: c.filingFilters, response: c.filings } }, errors: c.errors }, null, 2)}</pre>
        </section>
      </div>
    </SheetContent>
  </Sheet>;
}
