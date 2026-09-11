/** @jsxImportSource react */
"use client";

import { CheckCircle2, Lightbulb, MessageSquareQuote, Sparkles, Star, Trophy } from "lucide-react";
import { useState } from "react";
import { useUiMessages } from "@/shared/i18n/ui-messages-provider";

import type { Character } from "@/entities/character";

export type RewardCharacterDisplay = Pick<Character, "id" | "name" | "emoji" | "palette">;

import type {
  MissionCompletionResult,
  MissionEvaluationResponse,
} from "@/entities/mission-run";
import { useSaveReviewNoteMutation } from "@/entities/mission-run";
import { AudioPlaybackButton } from "@/features/audio-playback";
import { NextMission } from "./next-mission";
import { MissionAssistance } from "./mission-assistance";

export function MissionResultPanel({
  result,
  completion = result.run.completion,
  character,
}: {
  result: MissionEvaluationResponse;
  completion?: MissionCompletionResult;
  character?: RewardCharacterDisplay;
}) {
  const { missionResult: copy, languageTag } = useUiMessages();
  const { evaluation, run } = result;
  const [note, setNote] = useState(run.reviewNote ?? "");
  const saveNote = useSaveReviewNoteMutation(run.id);
  const confirmedForResult = evaluation.passed && completion?.missionRunId === run.id
    && completion.missionEvaluationId === evaluation.id;

  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-[0_24px_80px_-55px_rgba(20,20,30,.65)]"
      data-testid="mission-result-panel"
    >
      <header className={`p-7 text-white ${evaluation.passed ? "bg-[#353b8f]" : "bg-neutral-800"}`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p lang={languageTag} className="text-xs font-black uppercase tracking-[.2em] text-white/60">
              {evaluation.passed ? copy.passedEyebrow : copy.practiceEyebrow}
            </p>
            <h2 lang={languageTag} className="mt-2 text-3xl font-black">
              {evaluation.passed ? copy.passedTitle : copy.practiceTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{evaluation.summary}</p>
          </div>
          <div className="rounded-2xl bg-white/12 px-5 py-4 text-center backdrop-blur">
            <p className="text-4xl font-black">{evaluation.totalScore}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/55">{copy.totalScore}</p>
            <div className="mt-2 flex justify-center gap-1" aria-label={copy.stars(evaluation.stars)}>
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`size-4 ${star <= evaluation.stars ? "fill-[#f5c758] text-[#f5c758]" : "text-white/20"}`} />
              ))}
            </div>
          </div>
        </div>
        {completion ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f5c758] px-4 py-2 text-xs font-black text-neutral-950">
            <Trophy className="size-4" /> +{completion.experiencePointsAwarded} XP · {copy.rewardUnlocked}
          </div>
        ) : null}
      </header>

      {confirmedForResult && character?.id === run.characterId ? (
        <aside lang={languageTag} aria-label={copy.characterReactionLabel(character.name)} data-testid="reward-character-reaction" data-character-id={character.id} className="mx-6 mt-6 flex items-center gap-4 rounded-2xl bg-indigo-50 p-5 sm:mx-8">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `linear-gradient(145deg, ${character.palette[0]}, ${character.palette[1]})` }}>{character.emoji}</span>
          <div><p className="font-black text-indigo-950">{character.name}</p><p className="mt-1 text-sm leading-6 text-indigo-900">{copy.characterReaction}</p></div>
        </aside>
      ) : null}

      <div className="space-y-8 p-6 sm:p-8">
        <MissionAssistance evaluation={evaluation} />
        <p lang={languageTag} className="text-xs text-neutral-500" data-testid="evaluation-score-purpose">{copy.scorePurpose}</p>
        <section data-testid="mission-result-goals">
          <h3 lang={languageTag} className="font-black">{copy.goals}</h3>
          <ul className="mt-3 space-y-2">{run.steps.map(step => <li key={step.id} data-step-id={step.id} data-completed={evaluation.completedStepIds.includes(step.id)} className="rounded-xl bg-neutral-50 p-3 text-sm">
            <strong>{step.label}</strong><span className="ml-3" lang={languageTag}>{evaluation.completedStepIds.includes(step.id) ? copy.goalCompleted : copy.goalRemaining}</span>
          </li>)}</ul>
        </section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {evaluation.axes.map((axis) => (
            <article key={axis.key} className="rounded-2xl bg-neutral-50 p-4" data-testid={`evaluation-axis-${axis.key}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-neutral-500">{axis.label}</p>
                <span className="text-xl font-black">{axis.score}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/7">
                <div className="h-full rounded-full bg-[#5763d7]" style={{ width: `${axis.score}%` }} />
              </div>
              {axis.feedback ? <p className="mt-3 text-sm leading-6 text-neutral-700" data-testid="evaluation-axis-feedback">{axis.feedback}</p> : null}
              {axis.evidence.map((item) => (
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
            <h3 lang={languageTag} className="flex items-center gap-2 font-black text-emerald-900"><CheckCircle2 className="size-5" /> {copy.strengths}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-950/75">
              {evaluation.strengths.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
            <h3 lang={languageTag} className="flex items-center gap-2 font-black text-amber-900"><Lightbulb className="size-5" /> {copy.improvements}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950/75">
              {evaluation.improvements.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </article>
        </div>

        {evaluation.corrections.length ? (
          <section data-testid="mission-result-corrections">
            <h3 lang={languageTag} className="flex items-center gap-2 text-lg font-black"><MessageSquareQuote className="size-5 text-[#5763d7]" /> {copy.corrections}</h3>
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

        <section data-testid="mission-result-expressions" className="rounded-2xl border border-indigo-100 p-5">
          <h3 lang={languageTag} className="font-black">{copy.newExpressions}</h3>
          {evaluation.newExpressions?.length ? <ul className="mt-3 space-y-3">{evaluation.newExpressions.map((expression, index) => <li key={`${expression.english}-${index}`}>
            <p lang="en" className="font-bold text-indigo-900">{expression.english}</p><p lang="ko" className="mt-1 text-sm text-neutral-600">{expression.meaning}</p>
          </li>)}</ul> : <p lang={languageTag} className="mt-3 text-sm text-neutral-600">{copy.noSavedExpressions}</p>}
        </section>
        <NextMission currentId={run.missionId} completed={Boolean(confirmedForResult)} characterId={run.characterId} assisted={evaluation.assistance?.status === "tracked" && evaluation.assistance.requestCount > 0} />

        <section className="rounded-2xl bg-[#f4f2ff] p-5">
          <h3 lang={languageTag} className="flex items-center gap-2 font-black"><Sparkles className="size-5 text-[#5763d7]" /> {copy.reviewNote}</h3>
          <label lang={languageTag} htmlFor={`review-note-${run.id}`} className="mt-2 block text-xs leading-5 text-neutral-500">
            {copy.reviewNoteHelp}
          </label>
          <textarea
            id={`review-note-${run.id}`}
            value={note}
            maxLength={4_000}
            onChange={(event) => setNote(event.target.value)}
            className="mt-3 min-h-24 w-full resize-y rounded-xl border border-black/8 bg-white p-3 text-sm outline-none focus:border-[#5763d7]"
            placeholder={copy.reviewNotePlaceholder}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs font-semibold text-neutral-500">
              {saveNote.isSuccess ? copy.noteSaved : saveNote.error?.message}
            </p>
            <button
              lang={languageTag}
              type="button"
              disabled={saveNote.isPending}
              onClick={() => saveNote.mutate(note)}
              className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saveNote.isPending ? copy.saving : copy.saveNote}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
