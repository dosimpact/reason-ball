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
  return <section aria-label="현재 수집 작업" className="rounded-xl border bg-card p-4" aria-live="polite">
    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">현재 수집 작업</h2><strong>{labels[run.status]}</strong><time className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</time></div>
    <p className="mt-2 text-sm">대상: {run.kind === "all" ? "티커 보유 전체 기업" : [...names, ...extraCiks, ...(input?.tickers ?? [])].join(", ") || "선택 기업"}</p>
    <p className="text-sm">기간: {input?.since ? `${input.since} 이후` : `최근 ${input?.years ?? 20}년`} · 원문 서버 저장: {input?.downloadDocuments ? "포함" : "제외"}</p>
    <p className="mt-2 text-sm">단계: {phases[String(progress.phase)] ?? (run.status === "active" ? "요청 중" : "종료")} · 처리 기업 {count("companiesProcessed")} · 공시 메타데이터 {count("filingsSynced")} · 원문 저장 {count("downloaded")} · 실패 {count("failed")}</p>
    {run.message && <p className="mt-2 text-sm" role={run.status === "error" ? "alert" : undefined}>{run.message}</p>}
    {run.status === "disconnected" && <p className="mt-2 text-sm">서버 작업이 계속 진행 중일 수 있습니다. 새로고침해 저장 상태를 확인하세요.</p>}
  </section>;
}
