"use client";

import { useLearningProgressQuery } from "@/entities/learning-session";
import { useLearningNotebook } from "@/entities/learning-notebook/api/use-notebook";
import { remoteNotebookEnabled } from "@/entities/learning-notebook/api/notebook-client";
import { countNotebookExpressions } from "@/entities/learning-notebook/model/notebook";

export function LearningProgress({ completedCount, dailyGoal }: { completedCount?: number; dailyGoal: number }) {
  const query = useLearningProgressQuery();
  const localNotebook = useLearningNotebook(!remoteNotebookEnabled());
  if (query.isError) return <section role="alert" className="mt-8 rounded-2xl border p-6" data-testid="learning-progress-error">
    <p>학습 진도를 불러오지 못했어요. 기록을 0으로 바꾸지 않았습니다.</p>
    <button onClick={() => void query.refetch()} className="mt-3 underline">학습 진도 다시 불러오기</button>
  </section>;
  if (!query.data) return <p role="status" className="mt-8">학습 진도를 불러오고 있어요.</p>;
  const progress = query.data;
  const expressionCount = remoteNotebookEnabled() ? progress.expressionCount : localNotebook.isError || !localNotebook.data ? undefined : countNotebookExpressions(localNotebook.data);
  const maximum = Math.max(1, ...progress.recentDays.map((day) => day.minutes));
  const goal = dailyGoal * 7;
  return <section className="mt-8 space-y-6" data-testid="learning-progress">
    <p className="text-xs text-neutral-500">{progress.source === "demo" ? "데모 학습 기록 · " : "내 계정의 학습 기록 · "}UTC 날짜 기준 · {progress.today}</p>
    {progress.source === "account" ? <p className="text-xs text-neutral-500">학습 시간은 대화 화면의 최근 입력·포커스 신호로 추정하며 분 단위로 표시합니다. 숨김·무입력·연결 중단 구간은 제외되어 실제 시간과 차이가 날 수 있습니다.</p> : null}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "연속 학습", value: `${progress.streak}일`, detail: `개인 최고 ${progress.longestStreak}일` },
        { label: "최근 7일 학습 시간", value: `${progress.recentMinutes}분`, detail: `7일 목표 ${goal}분` },
        { label: "완료한 미션", value: completedCount === undefined ? "확인 필요" : `${completedCount}개`, detail: "서로 다른 완료 미션" },
        { label: "저장한 표현", value: expressionCount === undefined ? "확인 필요" : `${expressionCount}개`, detail: "내 표현 기록의 고유 표현" },
      ].map((stat) => <article key={stat.label} className="rounded-2xl border border-black/7 bg-white p-5">
        <h2 className="text-sm font-bold text-neutral-500">{stat.label}</h2><p className="mt-2 text-2xl font-black">{stat.value}</p><p className="mt-2 text-xs text-neutral-500">{stat.detail}</p>
      </article>)}
    </div>
    {localNotebook.isError ? <p role="alert" className="text-sm">표현 수를 불러오지 못했어요. <button className="underline" onClick={() => void localNotebook.refetch()}>표현 수 다시 불러오기</button></p> : null}
    <div className="rounded-2xl border border-black/7 bg-white p-6">
      <h2 className="text-xl font-black">최근 7일 학습 기록</h2>
      <p className="mt-2 text-sm text-neutral-500">{progress.recentMinutes ? `7일 목표 ${goal}분 중 ${progress.recentMinutes}분을 기록했어요.` : "아직 기록된 학습 시간이 없어요."}</p>
      <div role="img" aria-label={`최근 7일 총 ${progress.recentMinutes}분 학습 시간 그래프`} className="mt-6 grid h-48 grid-cols-7 items-end gap-2">
        {progress.recentDays.map((day) => <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2" data-testid={`learning-day-${day.date}`}>
          <span className="text-xs font-bold">{day.minutes}분</span>
          <span aria-hidden="true" className="w-full max-w-10 rounded-t bg-[#5763d7]" style={{ height: `${day.minutes / maximum * 120}px` }} />
          <span className="text-xs text-neutral-500">{day.date.slice(5)}</span>
        </div>)}
      </div>
    </div>
  </section>;
}
