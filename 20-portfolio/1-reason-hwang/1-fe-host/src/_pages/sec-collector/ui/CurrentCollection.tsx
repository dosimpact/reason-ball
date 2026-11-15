import type { SessionRun } from "./useSecCollector";

const labels = { active: "진행 중", completed: "완료", partial: "일부 실패", error: "실패", disconnected: "연결 중단" } as const;
const phases: Record<string, string> = { archive: "SEC 자료 준비", metadata: "공시 목록 수집", documents: "원문 저장" };

export function CurrentCollection({ run }: { run?: SessionRun }) {
  if (!run) return null;
  const progress = Object.assign({}, ...run.events.map(event => event.data), typeof run.result === "object" && run.result ? run.result : {}) as Record<string, unknown>;
  const count = (key: string) => typeof progress[key] === "number" ? Number(progress[key]).toLocaleString() : "—";
  const input = run.input;
  const names = run.targetNames ?? [];
  const extraCiks = (input?.ciks ?? []).filter(cik => !names.some(name => name.includes(cik)));
  const bulk = run.kind === "all" || run.kind === "selected";
  const title = run.status === "active" ? "현재 수집 작업" : "최근 수집 작업";
  const kindLabel = run.kind === "directory" ? "기업 목록 동기화" : run.kind === "filing" ? "단일 공시 원문 수집" : run.kind === "all" ? "전체 기업 공시 수집" : "선택 기업 공시 수집";
  return <section aria-label={title} className="rounded-xl border bg-card p-4" aria-live="polite">
    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{title}</h2><strong>{labels[run.status]}</strong><time className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</time></div>
    <p className="mt-2 text-sm font-medium">작업: {kindLabel}</p>
    <p className="mt-2 text-sm">대상: {run.kind === "directory" ? "SEC 기업 목록" : run.kind === "filing" ? [...names, run.accessionNo].filter(Boolean).join(" · ") : run.kind === "all" ? "티커 보유 전체 기업" : [...names, ...extraCiks, ...(input?.tickers ?? [])].join(", ") || "선택 기업"}</p>
    {bulk && <p className="text-sm">기간: {input?.since ? `${input.since} 이후` : input?.years !== undefined ? `최근 ${input.years}년` : "—"} · 원문 서버 저장: {input?.downloadDocuments === undefined ? "—" : input.downloadDocuments ? "포함" : "제외"}</p>}
    {run.kind === "directory" ? <p className="mt-2 text-sm">동기화 처리 기업 {count("syncedCount")}</p> : <p className="mt-2 text-sm">단계: {phases[String(progress.phase)] ?? (run.status === "active" ? "요청 중" : "종료")}{bulk && <> · 처리 기업 {count("companiesProcessed")} / {count("totalCompanies")} · 공시 메타데이터 {count("filingsSynced")}</>} · 원문 저장 {count("downloaded")} · 실패 {count("failed")}</p>}
    {run.kind === "all" && <p className="text-sm">ZIP 처리 항목 {count("processedEntries")} · 기업 저장 {count("companiesUpserted")} · 공시 저장 {count("filingsUpserted")} · ZIP 수신 bytes {count("archiveBytes")}</p>}
    <p className="mt-3 text-xs text-muted-foreground">현재 브라우저 세션의 기록입니다. 페이지를 다시 열면 사라지며 자동 재연결·재개를 제공하지 않습니다. 서버가 보내지 않은 수치는 —로 표시합니다.</p>
    {run.message && <p className="mt-2 text-sm" role={run.status === "error" ? "alert" : undefined}>{run.message}</p>}
    {run.status === "disconnected" && <p className="mt-2 text-sm">서버 작업이 계속 진행 중일 수 있습니다. 새로고침해 저장 상태를 확인하세요.</p>}
  </section>;
}
