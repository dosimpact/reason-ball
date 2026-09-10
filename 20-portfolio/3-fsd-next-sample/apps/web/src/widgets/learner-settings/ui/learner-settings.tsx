"use client";

import { useState } from "react";
import { cefrLevels, interestOptions, learningPreferencesSchema, useLearningPreferences, type LearningPreferences, type PreferenceRecord } from "@/entities/learner";
import { AudioPlaybackButton } from "@/features/audio-playback";

export function LearnerSettings() {
  const query = useLearningPreferences();
  if (!query.data) return <section className="mt-8" role={query.isError ? "alert" : "status"}>
    <p>{query.isError ? "학습 설정을 불러오지 못했어요. 저장된 값은 변경하지 않았습니다." : "학습 설정을 불러오고 있어요."}</p>
    {query.isError ? <button onClick={() => void query.refetch()} className="mt-3 underline">설정 다시 불러오기</button> : null}
  </section>;
  return <SettingsForm key={query.data.ownerId} initial={query.data} save={query.save} reload={async () => {
    const result = await query.refetch();
    if (result.error || !result.data) throw new Error("최신 설정을 불러오지 못했어요.");
    return result.data;
  }} remote={query.remote} />;
}

function SettingsForm({ initial, save, reload, remote }: {
  initial: PreferenceRecord; remote: boolean;
  save: (input: { previous: PreferenceRecord; settings: LearningPreferences }) => Promise<PreferenceRecord>;
  reload: () => Promise<PreferenceRecord>;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function change<K extends keyof LearningPreferences>(key: K, value: LearningPreferences[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setSaved(false); setError("");
  }
  async function submit() {
    const parsed = learningPreferencesSchema.safeParse(draft);
    if (!parsed.success) { setError("이름, 학습 목표와 설정값을 확인해 주세요."); return; }
    setBusy(true); setError(""); setSaved(false);
    try { const next = await save({ previous: baseline, settings: parsed.data }); setBaseline(next); setDraft(next.settings); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "설정을 저장하지 못했어요. 편집 내용은 보존했습니다."); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!window.confirm("편집 중인 설정을 버리고 저장된 설정을 다시 불러올까요?")) return;
    setBusy(true); setError("");
    try { const next = await reload(); setBaseline(next); setDraft(next.settings); setSaved(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "설정을 불러오지 못했어요."); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 max-w-2xl" data-testid="profile-settings">
    <h2 className="text-2xl font-black">프로필과 학습 설정</h2>
    <p className="mt-2 text-sm text-neutral-500">{remote ? "현재 계정에 비공개로 저장합니다." : "데모 설정은 이 브라우저에 저장합니다."} 저장한 음성·속도는 학습 음성에, CEFR·목표·교정 선호는 다음 채팅 요청에 적용됩니다. 미션 판정 기준은 바꾸지 않습니다.</p>
    <fieldset disabled={busy} className="mt-5 space-y-5 rounded-[1.5rem] border border-black/7 bg-white p-6 disabled:opacity-70">
      <label className="block text-sm font-bold">표시 이름<input aria-label="표시 이름" className="form-field" maxLength={40} value={draft.displayName} onChange={(event) => change("displayName", event.target.value)} /></label>
      <label className="block text-sm font-bold">학습자 레벨<select aria-label="학습자 레벨" className="form-field" value={draft.learnerLevel} onChange={(event) => change("learnerLevel", event.target.value as LearningPreferences["learnerLevel"])}>{cefrLevels.map((level) => <option key={level} value={level}>{level === "PRE_A1" ? "Pre-A1 · 입문" : level}</option>)}</select></label>
      <label className="block text-sm font-bold">하루 학습 목표<select aria-label="하루 학습 목표" className="form-field" value={draft.dailyGoal} onChange={(event) => change("dailyGoal", Number(event.target.value))}>{Array.from(new Set([5, 10, 15, 20, 30, draft.dailyGoal])).sort((a, b) => a - b).map((minutes) => <option key={minutes} value={minutes}>{minutes}분</option>)}</select></label>
      <label className="block text-sm font-bold">학습 목표<textarea aria-label="학습 목표" className="form-field" rows={3} maxLength={500} value={draft.learningGoal} onChange={(event) => change("learningGoal", event.target.value)} /></label>
      <div><p className="text-sm font-bold">관심 상황</p><div className="mt-3 flex flex-wrap gap-4">{interestOptions.map((interest) => <label key={interest} className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`관심 상황 ${interest}`} checked={draft.interests.includes(interest)} onChange={(event) => change("interests", event.target.checked ? [...draft.interests, interest] : draft.interests.filter((item) => item !== interest))} />{interest}</label>)}</div></div>
      <label className="block text-sm font-bold">교정 방식<select aria-label="교정 방식" className="form-field" value={draft.correctionMode} onChange={(event) => change("correctionMode", event.target.value as LearningPreferences["correctionMode"])}><option value="gentle">부드럽게 짧은 교정</option><option value="immediate">현재 실수를 즉시 교정</option><option value="summary">요청하거나 복습할 때 모아 교정</option></select></label>
      <label className="block text-sm font-bold">AI 음성<select aria-label="기본 AI 음성" className="form-field" value={draft.voice} onChange={(event) => change("voice", event.target.value as LearningPreferences["voice"])}><option value="marin">Marin</option><option value="coral">Coral</option><option value="alloy">Alloy</option></select></label>
      <label className="block text-sm font-bold">기본 말하기 속도<select aria-label="기본 음성 속도" className="form-field" value={draft.rate} onChange={(event) => change("rate", Number(event.target.value) as LearningPreferences["rate"])}>{[0.75, 1, 1.25].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
      <label className="flex items-center gap-3 text-sm"><input aria-label="새 표현 자동 재생" type="checkbox" checked={draft.autoplay} onChange={(event) => change("autoplay", event.target.checked)} />새 답변 완성 후 자동 재생 (브라우저 허용 시)</label>
      <div className="rounded-xl bg-indigo-50 p-4"><p className="mb-3 text-sm font-bold">저장 전 음성 미리 듣기</p><AudioPlaybackButton playbackId="profile-voice-preview" text="Could I check in, please?" defaultVoice={draft.voice} defaultRate={draft.rate} autoplay={false} /></div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <p role="status" className="text-sm text-emerald-700">{saved ? "학습 설정을 저장했어요." : busy ? "설정을 처리하고 있어요." : ""}</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void submit()} className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">설정 저장</button><button type="button" onClick={() => void restore()} className="rounded-full border px-4 py-3 text-sm">저장된 설정 다시 불러오기</button></div>
    </fieldset>
  </section>;
}
