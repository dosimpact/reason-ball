"use client";

import { useLearningProgressQuery } from "@/entities/learning-session";
import { useLearningPreferences } from "@/entities/learner";

export function LearningSummary({ xp }: { xp?: number }) {
  const progress = useLearningProgressQuery();
  const preferences = useLearningPreferences();
  if (progress.isError) return <section aria-label="나의 학습 요약" role="alert" className="rounded-2xl border p-5">
    <p>학습 진도를 불러오지 못했어요.</p><button onClick={() => void progress.refetch()} className="mt-2 underline">학습 진도 다시 불러오기</button>
  </section>;
  if (!progress.data) return <p role="status">학습 진도를 불러오고 있어요.</p>;
  const data = progress.data;
  return <section aria-label="나의 학습 요약" data-testid="home-learning-summary">
    <p className="mb-3 text-xs text-neutral-500">{data.source === "demo" ? "데모 학습 기록" : "내 계정의 학습 기록"} · UTC 날짜 기준</p>
    <div className="grid gap-4 sm:grid-cols-3">{[
      { label: "연속 학습", value: `${data.streak}일`, detail: `개인 최고 ${data.longestStreak}일` },
      { label: "최근 7일 학습", value: `${data.recentMinutes}분`, detail: preferences.data ? `7일 목표 ${preferences.data.settings.dailyGoal * 7}분` : "학습 목표 확인 필요" },
      { label: "쌓은 경험치", value: xp === undefined ? "확인 필요" : `${xp.toLocaleString()} XP`, detail: "저장된 누적 경험치" },
    ].map((stat) => <article key={stat.label} className="rounded-2xl border border-black/6 bg-white p-5">
      <h2 className="text-sm font-bold text-neutral-500">{stat.label}</h2><p className="mt-2 text-2xl font-black">{stat.value}</p><p className="mt-2 text-xs text-neutral-500">{stat.detail}</p>
    </article>)}</div>
  </section>;
}
