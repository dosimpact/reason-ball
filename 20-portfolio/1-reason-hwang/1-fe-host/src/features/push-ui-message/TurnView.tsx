import { Turn } from "./model";

const labels = { running: "진행 중", completed: "완료", failed: "실패", cancelled: "취소됨" };

export function TurnView({ turn }: { turn: Turn }) {
  return <article className="space-y-3 rounded-xl border p-5" aria-label="대화 턴">
    <p className="whitespace-pre-wrap rounded-lg bg-muted p-3"><strong>나</strong> · {turn.question}</p>
    <div className="space-y-3">
      <p className="text-sm font-semibold">Assistant · {labels[turn.status]}</p>
      <details open className="rounded-lg border bg-muted/30 p-3">
        <summary className="cursor-pointer text-sm font-medium">실행 진행 정보 ({turn.steps.length})</summary>
        <ol className="mt-3 space-y-2 text-sm" aria-label="진행 단계">
          {turn.steps.map((step) => <li key={step.id} className="flex justify-between gap-3">
            <span>{step.title}</span><span>{labels[step.status]}</span>
          </li>)}
        </ol>
      </details>
      {turn.answer && <p className="whitespace-pre-wrap leading-7">{turn.answer}</p>}
      {turn.error && <p role="alert" className="text-sm text-red-600">{turn.error}</p>}
    </div>
  </article>;
}
