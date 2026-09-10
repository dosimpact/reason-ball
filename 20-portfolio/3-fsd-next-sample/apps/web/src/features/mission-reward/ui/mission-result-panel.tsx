"use client";

import { CheckCircle2, Lightbulb, MessageSquareQuote, Sparkles, Star, Trophy } from "lucide-react";
import { useState } from "react";

import type {
  MissionCompletionResult,
  MissionEvaluationResponse,
} from "@/entities/mission-run";
import { useSaveReviewNoteMutation } from "@/entities/mission-run";
import { AudioPlaybackButton } from "@/features/audio-playback";

export function MissionResultPanel({
  result,
  completion = result.run.completion,
}: {
  result: MissionEvaluationResponse;
  completion?: MissionCompletionResult;
}) {
  const { evaluation, run } = result;
  const [note, setNote] = useState(run.reviewNote ?? "");
  const saveNote = useSaveReviewNoteMutation(run.id);

  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-[0_24px_80px_-55px_rgba(20,20,30,.65)]"
      data-testid="mission-result-panel"
    >
      <header className={`p-7 text-white ${evaluation.passed ? "bg-[#353b8f]" : "bg-neutral-800"}`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-white/60">
              {evaluation.passed ? "Mission passed" : "Keep practicing"}
            </p>
            <h2 className="mt-2 text-3xl font-black">
              {evaluation.passed ? "미션을 해결했어요!" : "거의 다 왔어요"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{evaluation.summary}</p>
          </div>
          <div className="rounded-2xl bg-white/12 px-5 py-4 text-center backdrop-blur">
            <p className="text-4xl font-black">{evaluation.totalScore}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/55">Total score</p>
            <div className="mt-2 flex justify-center gap-1" aria-label={`${evaluation.stars}점 별점`}>
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`size-4 ${star <= evaluation.stars ? "fill-[#f5c758] text-[#f5c758]" : "text-white/20"}`} />
              ))}
            </div>
          </div>
        </div>
        {completion ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f5c758] px-4 py-2 text-xs font-black text-neutral-950">
            <Trophy className="size-4" /> +{completion.experiencePointsAwarded} XP · 보상 해금
          </div>
        ) : null}
      </header>

      <div className="space-y-8 p-6 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {evaluation.axes.map((axis) => (
            <article key={axis.key} className="rounded-2xl bg-neutral-50 p-4" data-testid={`evaluation-axis-${axis.key}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-neutral-500">{axis.label}</p>
                <span className="text-xl font-black">{axis.score}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/7">
                <div className="h-full rounded-full bg-[#5763d7]" style={{ width: `${axis.score}%` }} />
              </div>
              {axis.evidence.slice(0, 1).map((item) => (
                <blockquote key={`${item.messageId}-${item.quote}`} className="mt-4 border-l-2 border-[#aeb5ef] pl-3 text-xs leading-5 text-neutral-600">
                  “{item.quote}”
                  <footer className="mt-1 text-[10px] text-neutral-400">{item.rationale}</footer>
                </blockquote>
              ))}
            </article>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-emerald-100 bg-emerald-50/65 p-5">
            <h3 className="flex items-center gap-2 font-black text-emerald-900"><CheckCircle2 className="size-5" /> 잘한 점</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-950/75">
              {evaluation.strengths.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
            <h3 className="flex items-center gap-2 font-black text-amber-900"><Lightbulb className="size-5" /> 다음 연습</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950/75">
              {evaluation.improvements.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
        </div>

        {evaluation.corrections.length ? (
          <section>
            <h3 className="flex items-center gap-2 text-lg font-black"><MessageSquareQuote className="size-5 text-[#5763d7]" /> 더 자연스러운 표현</h3>
            <div className="mt-4 space-y-3">
              {evaluation.corrections.map((correction, index) => (
                <article key={`${correction.original}-${index}`} className="rounded-2xl border border-black/7 p-4">
                  <p className="text-xs text-neutral-400 line-through">{correction.original}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-bold text-[#3f4697]">{correction.suggested}</p>
                    <AudioPlaybackButton playbackId={`correction-${evaluation.id}-${index}`} text={correction.suggested} compact />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">{correction.explanation}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-[#f4f2ff] p-5">
          <h3 className="flex items-center gap-2 font-black"><Sparkles className="size-5 text-[#5763d7]" /> 나만의 복습 메모</h3>
          <label htmlFor={`review-note-${run.id}`} className="mt-2 block text-xs leading-5 text-neutral-500">
            다음 시도에서 기억하고 싶은 표현이나 목표를 적어 두세요.
          </label>
          <textarea
            id={`review-note-${run.id}`}
            value={note}
            maxLength={4_000}
            onChange={(event) => setNote(event.target.value)}
            className="mt-3 min-h-24 w-full resize-y rounded-xl border border-black/8 bg-white p-3 text-sm outline-none focus:border-[#5763d7]"
            placeholder="예: Could I check in?을 먼저 말해 보기"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs font-semibold text-neutral-500">
              {saveNote.isSuccess ? "복습 메모를 저장했어요." : saveNote.error?.message}
            </p>
            <button
              type="button"
              disabled={saveNote.isPending}
              onClick={() => saveNote.mutate(note)}
              className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saveNote.isPending ? "저장 중…" : "메모 저장"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
