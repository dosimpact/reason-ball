export const labels = {
  connecting: "서버에 요청을 전달하고 있습니다",
  analyzing: "질문을 분석하고 필요한 작업을 선택하고 있습니다",
  composing: "매출 데이터에 맞는 화면을 구성하고 있습니다",
  validating: "컴포넌트와 데이터 바인딩을 검증하고 있습니다",
  retrying: "검증 결과를 반영해 화면을 다시 구성하고 있습니다",
  delivering: "검증한 화면을 전달하고 있습니다",
  updating: "선택한 조건을 화면에 반영하고 있습니다",
};
export type Stage = keyof typeof labels;
export type Status = "running" | "complete" | "error" | "stopped";
export type ProgressState = { stages: Stage[]; status: Status };

export function ProgressView({ progress, compact = false }: { progress: ProgressState | null; compact?: boolean }) {
  if (!progress) return null;
  const title = progress.status === "running" ? "작업 진행 중" : progress.status === "complete" ? "작업 완료" : progress.status === "error" ? "작업 실패 · 다시 시도할 수 있습니다" : "작업이 중단되었습니다";
  if (compact) return <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">{progress.status === "running" ? "요청을 처리하고 있습니다. 분석에는 시간이 걸릴 수 있습니다." : title}</p>;
  return <section aria-label="실행 진행 상태" className="mb-4 rounded-lg border bg-muted/30 p-4 text-sm">
    <p role="status" aria-live="polite" className="font-medium">{title}{progress.status === "running" && progress.stages.length > 0 ? ` · ${labels[progress.stages.at(-1)!]}` : ""}</p>
    <ol className="mt-3 space-y-2 text-muted-foreground">{progress.stages.map((stage, index) => <li key={`${index}-${stage}`} className="flex gap-2"><span aria-hidden="true">{progress.status === "running" && index === progress.stages.length - 1 ? "◌" : "·"}</span>{labels[stage]}</li>)}</ol>
  </section>;
}
