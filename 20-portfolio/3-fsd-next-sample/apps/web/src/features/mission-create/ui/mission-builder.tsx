"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Gift, Plus, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCharactersQuery } from "@/entities/character";
import { missionDraftSchema } from "@/shared/api/ai/contracts";
import { readGeneratedImage } from "@/shared/lib/read-generated-image";
import { CreationAccessGate } from "@/entities/creator-content/ui/creation-access-gate";
import {
  useCreateMissionMutation,
  useMissionQuery,
  useMissionsQuery,
  useUpdateMissionMutation,
  type Mission,
  type MissionDraft,
  type MissionObjective,
  type MissionStep,
  type PublishStatus,
} from "@/entities/mission";

const rewardOptions: Array<{ emoji: string; palette: [string, string]; label: string }> = [
  { emoji: "🌇", palette: ["#4f3b80", "#f49377"], label: "노을 진 도시" },
  { emoji: "🎟️", palette: ["#1e7c68", "#a8dcb7"], label: "특별 초대권" },
  { emoji: "📸", palette: ["#9d5a38", "#f3c789"], label: "추억의 사진" },
];

function statusLabel(status: PublishStatus) {
  return status === "draft" ? "초안" : status === "published" ? "게시됨" : "보관됨";
}

function rewardIndexFor(mission?: Mission) {
  if (!mission) return 0;
  const index = rewardOptions.findIndex((reward) =>
    reward.emoji === mission.rewardEmoji &&
    reward.palette[0] === mission.rewardPalette[0] &&
    reward.palette[1] === mission.rewardPalette[1]);
  return index < 0 ? 0 : index;
}

export function MissionBuilder({ missionId }: { missionId?: string }) {
  const missionQuery = useMissionQuery(missionId);
  if (missionId && missionQuery.isPending) {
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center" role="status">미션 편집 정보를 불러오고 있어요.</div>;
  }
  if (missionId && missionQuery.isError && !missionQuery.data) {
    return <section role="alert" className="mx-auto max-w-3xl p-10"><p>미션 편집 정보를 불러오지 못했어요.</p><button className="mt-3 underline" onClick={() => void missionQuery.refetch()}>편집 정보 다시 불러오기</button></section>;
  }
  if (missionId && !missionQuery.data) {
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-3xl font-black">편집할 수 없는 미션이에요.</h1><p className="mt-3 text-sm text-neutral-500">직접 만든 미션만 새 버전을 저장할 수 있어요.</p></div>;
  }
  const mission = missionId ? (missionQuery.data ?? undefined) : undefined;
  const form = (
    <MissionBuilderForm
      key={mission ? `${mission.id}:v${mission.versionNumber ?? 1}` : "new"}
      initialMission={mission}
    />
  );
  return mission ? <CreationAccessGate kind="mission" id={mission.id}>{form}</CreationAccessGate> : form;
}

function MissionBuilderForm({ initialMission }: { initialMission?: Mission }) {
  const router = useRouter();
  const { data: characters = [] } = useCharactersQuery();
  const { data: missions = [] } = useMissionsQuery();
  const createMission = useCreateMissionMutation();
  const updateMission = useUpdateMissionMutation();
  const editing = Boolean(initialMission);
  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState(initialMission?.title ?? "");
  const [subtitle, setSubtitle] = useState(initialMission?.subtitle ?? "");
  const [description, setDescription] = useState(initialMission?.description ?? "");
  const [category, setCategory] = useState(initialMission?.category ?? "일상");
  const [location, setLocation] = useState(initialMission?.location ?? "");
  const [difficulty, setDifficulty] = useState<MissionDraft["difficulty"]>(initialMission?.difficulty ?? "입문");
  const [durationMinutes, setDurationMinutes] = useState(initialMission?.durationMinutes ?? 7);
  const [characterId, setCharacterId] = useState(initialMission?.recommendedCharacterId ?? "");
  const [learnerRole, setLearnerRole] = useState(initialMission?.learnerRole ?? "처음 해외에 온 영어 초보 여행자");
  const [characterRole, setCharacterRole] = useState(initialMission?.characterRole ?? "상황을 친절하게 이끄는 현지 직원");
  const [objectives, setObjectives] = useState<MissionObjective[]>(initialMission?.objectives ?? []);
  const [steps, setSteps] = useState<MissionStep[]>(initialMission?.steps ?? []);
  const [phrases, setPhrases] = useState<{ english: string; korean: string }[]>(initialMission?.keyPhrases ?? []);
  const [exampleDialogue, setExampleDialogue] = useState<Array<{ role: "learner" | "character"; text: string }>>(initialMission?.exampleDialogue ?? []);
  const [successThreshold, setSuccessThreshold] = useState(initialMission?.successThreshold ?? 75);
  const [prerequisiteId, setPrerequisiteId] = useState(initialMission?.prerequisites?.[0] ?? "");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(initialMission?.publishStatus ?? "draft");
  const [reward, setReward] = useState(() => rewardIndexFor(initialMission));
  const [rewardTitle, setRewardTitle] = useState(initialMission?.rewardTitle ?? "");
  const [rewardPrompt, setRewardPrompt] = useState(
    "A warm illustrated keepsake of a learner completing a real-life English conversation mission, family-friendly character art",
  );
  const [rewardImageUrl, setRewardImageUrl] = useState<string | undefined>(initialMission?.rewardImageUrl);
  const [rewardGenerating, setRewardGenerating] = useState(false);
  const [rewardSource, setRewardSource] = useState<"api">();
  const [error, setError] = useState("");
  const selectedCharacterId = characterId || characters[0]?.id || "";
  const [generating, setGenerating] = useState(false);
  const [draftSource, setDraftSource] = useState<"api">();
  const generation = useRef<{ controller?: AbortController }>({});
  const [generationNotice, setGenerationNotice] = useState("");
  useEffect(() => {
    const current = generation.current;
    return () => { current.controller?.abort(); current.controller = undefined; };
  }, []);

  function cancelGeneration() {
    if (!generation.current.controller) return;
    generation.current.controller.abort();
    generation.current.controller = undefined;
    setGenerating(false);
    setRewardGenerating(false);
    setGenerationNotice("진행 중인 생성을 취소했어요. 현재 입력과 이미지는 유지됩니다.");
  }

  function beginGeneration() {
    cancelGeneration();
    const controller = new AbortController();
    generation.current.controller = controller;
    setGenerationNotice("");
    setError("");
    return controller;
  }

  function isCurrentGeneration(controller: AbortController) {
    return generation.current.controller === controller && !controller.signal.aborted;
  }
  const pending = createMission.isPending || updateMission.isPending;
  const statusOptions: PublishStatus[] = initialMission?.publishStatus === "published"
    ? ["published", "archived"]
    : initialMission?.publishStatus === "archived"
      ? ["archived"]
      : ["draft", "published"];
  const displayedVersions = initialMission
    ? initialMission.versionHistory?.length
      ? initialMission.versionHistory
      : [{
          versionNumber: initialMission.versionNumber ?? 1,
          status: initialMission.publishStatus ?? "draft" as const,
          createdAt: initialMission.createdAt,
          snapshot: initialMission,
        }]
    : [];

  async function generateDraft() {
    const controller = beginGeneration();
    setGenerating(true);
    setError("");
    try {
      const levelMap: Record<MissionDraft["difficulty"], "PRE_A1" | "A1" | "A2"> = {
        입문: "PRE_A1",
        초급: "A1",
        중급: "A2",
      };
      const selectedCharacter = characters.find((character) => character.id === selectedCharacterId);
      const response = await fetch("/api/ai/mission-draft", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: prompt.trim() || "해외 레스토랑에서 원하는 자리 요청하기",
          level: levelMap[difficulty],
          durationMinutes,
          place: location.trim() || undefined,
          learnerRole: "beginner English learner",
          characterRole: selectedCharacter?.role ?? "helpful conversation partner",
        }),
      });
      if (!response.ok) throw new Error("미션 생성 API 오류");
      // Validate the complete response before touching any creator-edited state.
      const draft = missionDraftSchema.parse(await response.json());
      if (!isCurrentGeneration(controller)) return;
      setTitle(draft.title);
      setSubtitle(draft.situation.slice(0, 80));
      setDescription(draft.situation);
      setLocation(draft.place);
      setDurationMinutes(draft.durationMinutes);
      setObjectives(
        draft.objectives.map((objective) => ({
          id: objective.id,
          label: objective.label,
          hint: objective.successEvidence[0] ?? "Try a short, clear sentence.",
        })),
      );
      setSteps(draft.objectives.map((objective, index) => ({
        id: `step-${index + 1}`,
        label: objective.label,
        hint: objective.successEvidence[0] ?? "Try a short, clear sentence.",
        required: true,
        successCriteria: objective.successEvidence,
      })));
      setPhrases(draft.phrases);
      setLearnerRole(draft.learnerRole);
      setCharacterRole(draft.characterRole);
      setSuccessThreshold(draft.rubric.passScore);
      setExampleDialogue([
        { role: "character", text: `Hello! ${draft.situation.split(".")[0]}. How can I help?` },
        { role: "learner", text: draft.phrases[0]?.english ?? "Could you help me, please?" },
        { role: "character", text: `Of course. ${draft.phrases[1]?.english ?? "Let's continue."}` },
      ]);
      setRewardTitle(`${draft.title} 기념 장면`);
      setRewardPrompt(
        draft.rewardImagePrompt ??
          "A warm illustrated keepsake of a beginner completing an English conversation mission, no text",
      );
      setDraftSource("api");
    } catch {
      if (!isCurrentGeneration(controller)) return;
      setError("미션 초안을 생성하지 못했어요. 기존 입력과 초안은 유지했으니 AI 초안 만들기로 다시 시도해 주세요.");
    } finally {
      if (isCurrentGeneration(controller)) {
        generation.current.controller = undefined;
        setGenerating(false);
      }
    }
  }

  async function generateRewardImage() {
    const controller = beginGeneration();
    setRewardGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/ai/image", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reward",
          prompt: rewardPrompt,
          size: "1024x1024",
        }),
      });
      if (!response.ok) throw new Error("보상 이미지 생성 API 오류");
      const imageUrl = await readGeneratedImage(await response.json());
      if (!isCurrentGeneration(controller)) return;
      setRewardImageUrl(imageUrl);
      setRewardSource("api");
    } catch {
      if (!isCurrentGeneration(controller)) return;
      setError("보상 이미지를 생성하지 못했어요. 기존 이미지와 입력은 유지했으니 다시 시도해 주세요.");
    } finally {
      if (isCurrentGeneration(controller)) {
        generation.current.controller = undefined;
        setRewardGenerating(false);
      }
    }
  }

  function next() {
    if (step === 1 && !title.trim()) {
      setError("AI 초안을 만들거나 미션 제목을 입력해 주세요.");
      return;
    }
    if (step === 2 && (objectives.length === 0 || phrases.length === 0 || steps.length === 0)) {
      setError("학습 목표와 핵심 표현을 한 개 이상 추가해 주세요.");
      return;
    }
    if (step === 2 && (
      objectives.some((objective) => !objective.label.trim() || !objective.hint.trim()) ||
      steps.some((missionStep) => !missionStep.label.trim() || missionStep.successCriteria.length === 0) ||
      phrases.some((phrase) => !phrase.english.trim() || !phrase.korean.trim())
    )) {
      setError("빈 목표·단계·표현을 채운 뒤 계속해 주세요.");
      return;
    }
    if (step === 2 && difficulty === "입문" && phrases.some((phrase) => phrase.english.trim().split(/\s+/).length > 10)) {
      setError("입문 표현은 한 문장에 10단어 이하로 작성해 주세요.");
      return;
    }
    setError("");
    setStep((value) => Math.min(3, value + 1));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const nextItems = [...items];
      [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
      return nextItems;
    });
  }

  async function saveMission() {
    if (generation.current.controller) return;
    const selectedReward = rewardOptions[reward];
    try {
      const draft: MissionDraft = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        difficulty,
        durationMinutes,
        learnerRole: learnerRole.trim(),
        characterRole: characterRole.trim(),
        objectives,
        steps,
        keyPhrases: phrases,
        successThreshold,
        prerequisites: prerequisiteId ? [prerequisiteId] : [],
        exampleDialogue,
        rewardTitle: rewardTitle.trim() || selectedReward.label,
        rewardPalette: selectedReward.palette,
        rewardEmoji: selectedReward.emoji,
        rewardImageUrl,
        recommendedCharacterId: selectedCharacterId,
        publishStatus,
      };
      if (initialMission) {
        const mission = await updateMission.mutateAsync({ id: initialMission.id, draft });
        router.replace(`/missions/${mission.id}/edit?saved=1`);
      } else {
        const mission = await createMission.mutateAsync(draft);
        router.push(`/missions/${mission.id}?created=1`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "미션을 저장하지 못했어요. 다시 시도해 주세요.",
      );
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 3 && !createMission.isPending) {
      void saveMission();
    }
  }

  return (
    <form onSubmit={submit} onChangeCapture={cancelGeneration} onClickCapture={(event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (button && !['generate-mission-draft', 'generate-reward-image'].includes(button.dataset.testid ?? '')) cancelGeneration();
    }} className="mx-auto max-w-5xl px-5 py-10 pb-28 sm:px-8 lg:py-16" data-testid="mission-builder">
      {generating || rewardGenerating ? <div role="status" className="mb-4 flex items-center justify-between rounded-xl bg-indigo-50 p-3 text-sm"><span>AI 생성 중 · 편집하거나 단계를 이동하면 생성이 취소됩니다.</span><button type="button" onClick={cancelGeneration} className="shrink-0 px-3 py-2 font-bold">AI 생성 취소</button></div> : null}
      {generationNotice ? <p role="status" className="mb-4 text-sm text-neutral-600">{generationNotice}</p> : null}
      <div className="flex flex-col gap-6 border-b border-black/8 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">{editing ? `Mission editor · v${initialMission?.versionNumber ?? 1}` : "Mission maker"}</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">{editing ? "미션 새 버전 만들기" : "실생활 미션 설계하기"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{editing ? "현재 학습 계약을 바탕으로 이전 버전을 보존한 새 버전을 만들어요." : "연습하고 싶은 상황 한 줄이면 AI가 초보자를 위한 목표와 표현, 보상 장면을 구성해요."}</p></div>
        <div className="flex gap-2" aria-label={`총 3단계 중 ${step}단계`}>{[1,2,3].map((item) => <span key={item} className={`h-2 rounded-full ${item === step ? "w-10 bg-[#5763d7]" : item < step ? "w-5 bg-neutral-950" : "w-5 bg-neutral-200"}`} />)}</div>
      </div>
      {initialMission ? (
        <section className="mt-6 rounded-[1.5rem] border border-black/7 bg-white p-5" data-testid="mission-version-history" aria-label="미션 버전 기록">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black">버전 기록</h2><span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">현재 {statusLabel(initialMission.publishStatus ?? "draft")}</span></div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedVersions.slice().reverse().map((version) => <li key={version.versionNumber} className="rounded-xl bg-neutral-50 p-3" data-testid={`mission-version-${version.versionNumber}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">v{version.versionNumber}</strong><span className="text-[10px] font-black text-neutral-500">{statusLabel(version.status)}</span></div><p className="mt-2 truncate text-xs font-semibold">{version.snapshot.title}</p><p className="mt-1 text-[10px] text-neutral-400">{version.snapshot.difficulty} · {new Date(version.createdAt).toLocaleString("ko-KR")}</p></li>)}
          </ol>
        </section>
      ) : null}
      <div className="mt-8 rounded-[1.75rem] border border-black/6 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,.45)] sm:p-8">
        {step === 1 ? <section className="space-y-7" aria-labelledby="mission-step-1">
          <div><span className="text-xs font-bold text-[#5763d7]">STEP 1</span><h2 id="mission-step-1" className="mt-1 text-2xl font-black">연습할 순간을 알려주세요</h2></div>
          <div className="rounded-2xl bg-[#f1f2ff] p-4 sm:p-5"><label className="text-sm font-bold text-[#353b84]">어떤 상황을 연습할까요?<div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="예: 해외 레스토랑에서 창가 자리 요청하기" className="form-field bg-white" data-testid="mission-prompt" /><button type="button" onClick={generateDraft} disabled={generating} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5763d7] px-5 py-3 text-xs font-bold text-white disabled:opacity-60" data-testid="generate-mission-draft"><WandSparkles className="size-4" /> {generating ? "초안 생성 중..." : "AI 초안 만들기"}</button></div></label><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-[#5a61a0]">테스트 환경에서는 같은 입력에 재현 가능한 mock 초안이 생성됩니다.</p>{draftSource ? <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700" data-testid="mission-draft-source">AI Route 응답</span> : null}</div></div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">미션 제목 <span className="text-[#5763d7]">*</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="form-field" data-testid="mission-title" /></label><label className="space-y-2 text-sm font-bold">한 줄 설명<input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="form-field" /></label></div>
          <label className="block space-y-2 text-sm font-bold">상세 설명<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="form-field resize-none" /></label>
          <div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">장소<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="도시 · 장소" className="form-field" /></label><label className="space-y-2 text-sm font-bold">함께할 캐릭터<select value={selectedCharacterId} onChange={(event) => setCharacterId(event.target.value)} className="form-field">{characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {character.role}</option>)}</select></label></div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">학습자 역할<input value={learnerRole} onChange={(event) => setLearnerRole(event.target.value)} className="form-field" data-testid="mission-learner-role" /></label><label className="space-y-2 text-sm font-bold">캐릭터 역할<input value={characterRole} onChange={(event) => setCharacterRole(event.target.value)} className="form-field" data-testid="mission-character-role" /></label></div>
          <div className="grid gap-5 sm:grid-cols-3"><label className="space-y-2 text-sm font-bold">카테고리<select value={category} onChange={(event) => setCategory(event.target.value)} className="form-field"><option>일상</option><option>여행</option><option>관계</option><option>업무</option></select></label><label className="space-y-2 text-sm font-bold">난이도<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as MissionDraft["difficulty"])} className="form-field"><option>입문</option><option>초급</option><option>중급</option></select></label><label className="space-y-2 text-sm font-bold">예상 시간<input type="number" min={3} max={30} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="form-field" /></label></div>
        </section> : null}

        {step === 2 ? <section className="space-y-8" aria-labelledby="mission-step-2">
          <div><span className="text-xs font-bold text-[#5763d7]">STEP 2</span><h2 id="mission-step-2" className="mt-1 text-2xl font-black">성공 조건과 표현을 다듬어요</h2></div>
          <fieldset><legend className="text-sm font-bold">미션 목표</legend><div className="mt-3 space-y-3">{objectives.map((objective, index) => <div key={objective.id} className="grid gap-2 rounded-2xl bg-[#faf8f4] p-3 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={`목표 ${index + 1}`} value={objective.label} onChange={(event) => setObjectives((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="form-field bg-white" /><input aria-label={`목표 ${index + 1} 힌트`} value={objective.hint} onChange={(event) => setObjectives((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, hint: event.target.value } : item))} className="form-field bg-white" /><button type="button" onClick={() => setObjectives((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="grid size-11 place-items-center rounded-xl hover:bg-red-50 hover:text-red-600" aria-label={`목표 ${index + 1} 삭제`}><X className="size-4" /></button></div>)}</div><button type="button" onClick={() => setObjectives((items) => [...items, { id: `goal-${Date.now()}`, label: "", hint: "" }])} className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold"><Plus className="size-3.5" /> 목표 추가</button></fieldset>
          <fieldset data-testid="mission-steps"><legend className="text-sm font-bold">진행 단계 <span className="ml-2 text-xs font-normal text-neutral-400">순서와 필수 여부를 설정</span></legend><div className="mt-3 space-y-3">{steps.map((missionStep, index) => <div key={missionStep.id} className="grid gap-2 rounded-2xl border border-black/6 bg-white p-3 sm:grid-cols-[auto_1fr_1fr_auto]"><span className="grid size-11 place-items-center rounded-xl bg-[#f1f2ff] text-xs font-black text-[#5763d7]">{index + 1}</span><input aria-label={`단계 ${index + 1}`} value={missionStep.label} onChange={(event) => setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="form-field m-0" /><input aria-label={`단계 ${index + 1} 성공 조건`} value={missionStep.successCriteria.join(" · ")} onChange={(event) => setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, successCriteria: event.target.value.split("·").map((value) => value.trim()).filter(Boolean) } : item))} className="form-field m-0" /><div className="flex items-center gap-1"><button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={`단계 ${index + 1} 위로`} className="message-action disabled:opacity-30"><ArrowUp /></button><button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label={`단계 ${index + 1} 아래로`} className="message-action disabled:opacity-30"><ArrowDown /></button><button type="button" onClick={() => setSteps((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, required: !item.required } : item))} aria-label={`단계 ${index + 1} ${missionStep.required ? "선택으로 변경" : "필수로 변경"}`} aria-pressed={missionStep.required} className={`rounded-lg px-2 py-1 text-[10px] font-black ${missionStep.required ? "bg-neutral-950 text-white" : "bg-neutral-100"}`}>{missionStep.required ? "필수" : "선택"}</button></div></div>)}</div><button type="button" onClick={() => setSteps((items) => [...items, { id: `step-${Date.now()}`, label: "", hint: "필요하면 핵심 표현을 참고하세요.", required: true, successCriteria: [] }])} className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold"><Plus className="size-3.5" /> 단계 추가</button></fieldset>
          <fieldset><legend className="text-sm font-bold">핵심 표현</legend><div className="mt-3 space-y-3">{phrases.map((phrase, index) => <div key={`${index}-${phrase.english}`} className="grid gap-2 rounded-2xl bg-[#f1f2ff] p-3 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={`영어 표현 ${index + 1}`} value={phrase.english} onChange={(event) => setPhrases((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, english: event.target.value } : item))} className="form-field bg-white" /><input aria-label={`표현 ${index + 1} 뜻`} value={phrase.korean} onChange={(event) => setPhrases((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, korean: event.target.value } : item))} className="form-field bg-white" /><button type="button" onClick={() => setPhrases((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="grid size-11 place-items-center rounded-xl hover:bg-red-50 hover:text-red-600" aria-label={`표현 ${index + 1} 삭제`}><X className="size-4" /></button></div>)}</div><button type="button" onClick={() => setPhrases((items) => [...items, { english: "", korean: "" }])} className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold"><Plus className="size-3.5" /> 표현 추가</button></fieldset>
          <section aria-labelledby="example-dialogue-title" className="rounded-2xl bg-[#faf8f4] p-5" data-testid="mission-example-dialogue"><h3 id="example-dialogue-title" className="text-sm font-black">AI 예시 대화</h3><div className="mt-3 space-y-2">{exampleDialogue.map((turn, index) => <label key={`${turn.role}-${index}`} className="grid gap-2 text-xs font-bold sm:grid-cols-[90px_1fr]"><span className="pt-3 text-neutral-500">{turn.role === "learner" ? "학습자" : "캐릭터"}</span><input aria-label={`예시 대화 ${index + 1}`} value={turn.text} onChange={(event) => setExampleDialogue((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className="form-field m-0 bg-white" /></label>)}</div></section>
        </section> : null}

        {step === 3 ? <section className="space-y-7" aria-labelledby="mission-step-3">
          <div><span className="text-xs font-bold text-[#5763d7]">STEP 3</span><h2 id="mission-step-3" className="mt-1 text-2xl font-black">완주 보상을 선택해요</h2><p className="mt-2 text-sm text-neutral-500">학습자가 미션을 완료하면 잠긴 캐릭터 장면이 해금됩니다.</p></div>
          <div className="rounded-2xl bg-amber-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><p className="text-sm font-black text-amber-900">AI 보상 이미지</p><p className="mt-1 text-xs leading-5 text-amber-800/70">미션 초안의 reward prompt로 잠금 해제 장면을 생성해요.</p></div><button type="button" onClick={generateRewardImage} disabled={rewardGenerating} className="mt-3 inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-xs font-bold text-white disabled:opacity-60 sm:mt-0" data-testid="generate-reward-image"><WandSparkles className="size-4" />{rewardGenerating ? "생성 중..." : "AI 보상 이미지 생성"}</button></div>
          {rewardSource ? <div className="flex justify-end"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700" data-testid="reward-image-source">AI Route 응답</span></div> : null}
          {rewardImageUrl ? <div className="overflow-hidden rounded-[1.5rem] border-2 border-neutral-950" data-testid="reward-image-candidate"><div className="h-72 bg-cover bg-center" style={{ backgroundImage: `url(${rewardImageUrl})` }} /><div className="flex items-center justify-between bg-[#faf8f4] px-4 py-3 text-xs font-bold">AI가 만든 보상 장면<span className="grid size-5 place-items-center rounded-full bg-neutral-950 text-white"><Check className="size-3" /></span></div></div> : <div className="grid gap-4 sm:grid-cols-3" data-testid="reward-candidates">{rewardOptions.map((item, index) => <button key={item.label} type="button" onClick={() => setReward(index)} aria-pressed={reward === index} className={`relative overflow-hidden rounded-[1.5rem] border-2 text-left ${reward === index ? "border-neutral-950" : "border-transparent"}`}><span className="grid h-52 place-items-center text-6xl" style={{ background: `linear-gradient(145deg, ${item.palette[0]}, ${item.palette[1]})` }}>{item.emoji}</span><span className="flex items-center justify-between bg-[#faf8f4] px-4 py-3 text-xs font-bold">{item.label}{reward === index ? <span className="grid size-5 place-items-center rounded-full bg-neutral-950 text-white"><Check className="size-3" /></span> : null}</span></button>)}</div>}
          <label className="block space-y-2 text-sm font-bold">보상 이름<input value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} placeholder={rewardOptions[reward].label} className="form-field" /></label>
          <div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">통과 점수 <span className="text-[#5763d7]">{successThreshold}점</span><input type="range" min={60} max={100} step={5} value={successThreshold} onChange={(event) => setSuccessThreshold(Number(event.target.value))} className="mt-4 w-full accent-[#5763d7]" aria-label="통과 점수" data-testid="mission-success-threshold" /></label><label className="space-y-2 text-sm font-bold">선수 미션<select value={prerequisiteId} onChange={(event) => setPrerequisiteId(event.target.value)} className="form-field" aria-label="선수 미션"><option value="">없음</option>{missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}</select></label></div>
          <fieldset><legend className="text-sm font-bold">저장 상태</legend><div className="mt-3 flex gap-2">{statusOptions.map((status) => <button key={status} type="button" onClick={() => setPublishStatus(status)} aria-pressed={publishStatus === status} className={`rounded-full border px-4 py-2 text-xs font-black ${publishStatus === status ? "border-[#5763d7] bg-[#f1f2ff] text-[#3e4698]" : "border-black/10"}`}>{status === "draft" ? "초안으로 저장" : status === "published" ? (editing ? "게시 상태로 저장" : "검토 후 게시") : "보관하기"}</button>)}</div></fieldset>
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900" data-testid="mission-validation-summary"><ShieldCheck className="mt-1 size-4 shrink-0" /><p>필수 단계 {steps.filter((item) => item.required).length}개 · 통과 기준 {successThreshold}점 · {difficulty === "입문" ? "Pre-A1 짧은 문장 정책" : difficulty === "초급" ? "A1 지원 힌트 정책" : "A2 실전 확장 정책"}을 게시 전 검사합니다.</p></div>
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><Gift className="mt-0.5 size-4 shrink-0" /><p>보상 원본은 비공개 Supabase Storage에 저장하고, 완료 권한이 확인된 사용자에게만 짧은 만료 시간의 signed URL을 발급합니다.</p></div>
        </section> : null}

        {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        <div className="mt-9 flex items-center justify-between border-t border-black/7 pt-6"><button type="button" onClick={() => step === 1 ? router.back() : setStep((value) => value - 1)} className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold hover:bg-neutral-100"><ArrowLeft className="size-4" /> {step === 1 ? "취소" : "이전"}</button>{step < 3 ? <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white hover:bg-[#5763d7]">다음 단계 <ArrowRight className="size-4" /></button> : <button type="button" onClick={() => void saveMission()} disabled={pending || generating || rewardGenerating || initialMission?.publishStatus === "archived"} className="inline-flex items-center gap-2 rounded-full bg-[#5763d7] px-6 py-3 text-sm font-bold text-white disabled:opacity-60" data-testid="save-mission"><Sparkles className="size-4" /> {pending ? "저장 중..." : editing ? "새 버전 저장" : "미션 저장"}</button>}</div>
      </div>
    </form>
  );
}
