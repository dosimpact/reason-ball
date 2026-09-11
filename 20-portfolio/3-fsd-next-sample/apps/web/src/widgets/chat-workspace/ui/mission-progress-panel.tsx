/** @jsxImportSource react */
import type { MissionRun, MissionStepStatus } from "@/entities/mission-run/model/types";

const statusLabels: Record<MissionStepStatus, string> = {
  locked: "대기 중", active: "진행 중", completed: "완료", skipped: "건너뜀",
};

export function MissionProgressPanel({ run, title, loading, failed, onRetry }: {
  run?: MissionRun;
  title: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const steps = [...(run?.steps ?? [])].sort((left, right) => left.order - right.order);
  const current = steps.find(step => step.status === "active" && step.order === run?.currentStepOrder);
  const complete = steps.filter(step => step.status === "completed").length;
  const requiredComplete = steps.length > 0 && steps.filter(step => step.required).every(step => step.status === "completed");
  return <section aria-label="미션 목표 진행" data-testid="mission-progress" className="shrink-0 border-b border-indigo-100 bg-indigo-50/50 px-4 py-2 text-xs">
    <details open className="max-h-[25svh] overflow-y-auto">
      <summary className="cursor-pointer font-bold text-indigo-900">{title} · 목표 {complete}/{steps.length} 완료</summary>
      {failed ? <div role="alert" className="mt-2"><p>목표 진행 정보를 불러오지 못했어요.</p><button type="button" onClick={onRetry} disabled={loading} className="mt-1 underline">목표 진행 다시 불러오기</button></div>
        : !run ? <p role="status" className="mt-2">목표 진행을 불러오는 중이에요.</p> : <>
          <p className="mt-2 font-bold" data-testid="mission-current-step">{current ? `현재 단계: ${current.label}` : requiredComplete ? "필수 목표를 모두 달성했어요." : "현재 진행 중인 단계가 없어요."}</p>
          <ol className="mt-2 space-y-1">
            {steps.map(step => <li key={step.id} data-testid={`mission-progress-step-${step.id}`} data-status={step.status}
              aria-current={current?.id === step.id ? "step" : undefined}
              className={`flex items-start justify-between gap-3 rounded px-2 py-1 ${step.status === "completed" ? "bg-emerald-50 text-emerald-800" : step.status === "active" ? "bg-indigo-100 text-indigo-900" : "text-neutral-600"}`}>
              <span className="min-w-0 break-words">{step.order}. {step.label}{!step.required ? " (선택)" : ""}</span>
              <span className="shrink-0 font-bold">{statusLabels[step.status]}</span>
            </li>)}
          </ol>
          {requiredComplete && run.status !== "passed" ? <p className="mt-2 text-indigo-800">연습을 마칠 준비가 되면 ‘미션 마치고 평가받기’를 눌러 주세요. 최종 평가와 보상은 그때 확인해요.</p> : null}
        </>}
    </details>
  </section>;
}
