"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  ImageIcon,
  Lock,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { readGeneratedImage } from "@/shared/lib/read-generated-image";
import { CreationAccessGate } from "@/entities/creator-content/ui/creation-access-gate";
import {
  useCreateCharacterMutation,
  useCharacterQuery,
  useUpdateCharacterMutation,
  type Character,
  type CharacterDraft,
  type PublishStatus,
} from "@/entities/character";

const traits = ["다정함", "유쾌함", "차분함", "솔직함", "호기심", "인내심", "도전적", "격려형"];
const topics = ["여행", "카페", "일상", "취미", "업무", "친구", "문화", "음식"];
type ImageCandidate = { emoji: string; palette: [string, string]; label: string; dataUrl?: string };

const candidateStyles: ImageCandidate[] = [
  { emoji: "👩🏽‍🏫", palette: ["#ff8067", "#ffc65c"], label: "따뜻한 스튜디오" },
  { emoji: "🧑🏻‍🎨", palette: ["#5965da", "#b09bee"], label: "보랏빛 아틀리에" },
  { emoji: "👩🏻‍💻", palette: ["#1e947a", "#8fd6b5"], label: "싱그러운 워크룸" },
];

function statusLabel(status: PublishStatus) {
  return status === "draft" ? "초안" : status === "published" ? "게시됨" : "보관됨";
}

export function CharacterBuilder({ characterId }: { characterId?: string }) {
  const characterQuery = useCharacterQuery(characterId);
  if (characterId && characterQuery.isPending) {
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center" role="status">캐릭터 편집 정보를 불러오고 있어요.</div>;
  }
  if (characterId && characterQuery.isError && !characterQuery.data) {
    return <section role="alert" className="mx-auto max-w-3xl p-10"><p>캐릭터 편집 정보를 불러오지 못했어요.</p><button className="mt-3 underline" onClick={() => void characterQuery.refetch()}>편집 정보 다시 불러오기</button></section>;
  }
  if (characterId && !characterQuery.data) {
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-3xl font-black">편집할 수 없는 캐릭터예요.</h1><p className="mt-3 text-sm text-neutral-500">직접 만든 캐릭터만 새 버전을 저장할 수 있어요.</p></div>;
  }
  const character = characterId ? (characterQuery.data ?? undefined) : undefined;
  const form = (
    <CharacterBuilderForm
      key={character ? `${character.id}:v${character.versionNumber ?? 1}` : "new"}
      initialCharacter={character}
    />
  );
  return character ? <CreationAccessGate kind="character" id={character.id}>{form}</CreationAccessGate> : form;
}

function CharacterBuilderForm({ initialCharacter }: { initialCharacter?: Character }) {
  const router = useRouter();
  const createCharacter = useCreateCharacterMutation();
  const updateCharacter = useUpdateCharacterMutation();
  const editing = Boolean(initialCharacter);
  const [step, setStep] = useState(1);
  const [generated, setGenerated] = useState(editing);
  const [generating, setGenerating] = useState(false);
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
    setGenerationNotice("이미지 생성을 취소했어요. 현재 입력과 후보, 선택은 유지됩니다.");
  }

  function isCurrentGeneration(controller: AbortController) {
    return generation.current.controller === controller && !controller.signal.aborted;
  }
  const [generationSource, setGenerationSource] = useState<"api" | "existing" | undefined>(editing ? "existing" : undefined);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>(() => initialCharacter
    ? [{ emoji: initialCharacter.emoji, palette: initialCharacter.palette, label: "현재 버전 이미지", dataUrl: initialCharacter.imageUrl }]
    : []);
  const [selectedImage, setSelectedImage] = useState(editing ? 0 : -1);
  const [name, setName] = useState(initialCharacter?.name ?? "");
  const [role, setRole] = useState(initialCharacter?.role ?? "");
  const [description, setDescription] = useState(initialCharacter?.description ?? "");
  const [personality, setPersonality] = useState<string[]>(initialCharacter?.personality ?? ["다정함", "인내심"]);
  const [personaGoal, setPersonaGoal] = useState(initialCharacter?.personaGoal ?? "");
  const [learningGoal, setLearningGoal] = useState(initialCharacter?.learningGoal ?? "");
  const [relationship, setRelationship] = useState(initialCharacter?.relationship ?? "신뢰할 수 있는 영어 학습 파트너");
  const [teachingStyle, setTeachingStyle] = useState(initialCharacter?.teachingStyle ?? "먼저 대화를 이어간 뒤, 한 번에 한 가지씩 부드럽게 교정");
  const [prohibitedInstructions, setProhibitedInstructions] = useState(
    initialCharacter?.prohibitedInstructions?.join("\n") ?? "욕설과 차별적 표현\n개인정보 요구\n학습자를 조롱하는 피드백",
  );
  const [speakingStyle, setSpeakingStyle] = useState(initialCharacter?.speakingStyle ?? "짧고 또렷한 영어, 막힐 때 한국어 힌트 제공");
  const [accent, setAccent] = useState(initialCharacter?.accent ?? "American");
  const [level, setLevel] = useState<CharacterDraft["level"]>(initialCharacter?.level ?? "입문");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialCharacter?.topics ?? ["일상"]);
  const [visibility, setVisibility] = useState<CharacterDraft["visibility"]>(initialCharacter?.visibility ?? "private");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(initialCharacter?.publishStatus ?? "draft");
  const [error, setError] = useState("");
  const pending = createCharacter.isPending || updateCharacter.isPending;
  const statusOptions: PublishStatus[] = initialCharacter?.publishStatus === "published"
    ? ["published", "archived"]
    : initialCharacter?.publishStatus === "archived"
      ? ["archived"]
      : ["draft", "published"];
  const displayedVersions = initialCharacter
    ? initialCharacter.versionHistory?.length
      ? initialCharacter.versionHistory
      : [{
          versionNumber: initialCharacter.versionNumber ?? 1,
          status: initialCharacter.publishStatus ?? "draft" as const,
          createdAt: initialCharacter.createdAt,
          snapshot: initialCharacter,
        }]
    : [];

  function toggleItem(value: string, current: string[], update: (items: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function next() {
    if (step === 1 && (!name.trim() || !role.trim())) {
      setError("캐릭터 이름과 역할을 입력해 주세요.");
      return;
    }
    if (step === 2 && (!personaGoal.trim() || !learningGoal.trim())) {
      setError("캐릭터의 존재 목적과 학습 목표를 모두 입력해 주세요.");
      return;
    }
    setError("");
    setStep((value) => Math.min(3, value + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generation.current.controller) return;
    if (!generated) {
      setError("AI 이미지 후보를 먼저 만들어 주세요.");
      return;
    }
    const image = imageCandidates[selectedImage];
    if (!image) {
      setError("대표 이미지로 사용할 후보를 직접 선택해 주세요.");
      return;
    }
    try {
      const draft: CharacterDraft = {
        name: name.trim(),
        role: role.trim(),
        tagline: description.trim() || `${name}와 부담 없이 영어로 이야기해 보세요`,
        description:
          description.trim() || `${role} 역할로 초보 학습자가 실제 대화를 연습하도록 돕는 AI 캐릭터예요.`,
        personality,
        personaGoal: personaGoal.trim(),
        learningGoal: learningGoal.trim(),
        relationship: relationship.trim(),
        teachingStyle: teachingStyle.trim(),
        prohibitedInstructions: prohibitedInstructions.split("\n").map((item) => item.trim()).filter(Boolean),
        speakingStyle: speakingStyle.trim(),
        accent,
        level,
        topics: selectedTopics,
        palette: image.palette,
        emoji: image.emoji,
        imageUrl: image.dataUrl,
        visibility,
        publishStatus,
      };
      if (initialCharacter) {
        const character = await updateCharacter.mutateAsync({ id: initialCharacter.id, draft });
        router.replace(`/characters/${character.id}/edit?saved=1`);
      } else {
        const character = await createCharacter.mutateAsync(draft);
        router.push(`/characters/${character.id}?created=1`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "캐릭터를 저장하지 못했어요. 다시 시도해 주세요.",
      );
    }
  }

  async function generateImages() {
    cancelGeneration();
    const controller = new AbortController();
    generation.current.controller = controller;
    setGenerationNotice("");
    setGenerating(true);
    setError("");
    try {
      const directions = [
        "warm editorial portrait, soft daylight",
        "playful character portrait, vivid studio color",
        "calm cinematic portrait, natural background",
      ];
      const responses = await Promise.all(
        directions.map((direction) => fetch("/api/ai/image", {
          signal: controller.signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "avatar",
            prompt: `Friendly English learning character portrait of ${name}, a ${role}; personality: ${personality.join(", ")}; ${direction}; no text`,
            size: "1024x1024",
          }),
        })),
      );
      if (responses.some((response) => !response.ok)) throw new Error("이미지 생성 API 오류");
      const urls = await Promise.all(responses.map(async (response) => readGeneratedImage(await response.json())));
      if (!isCurrentGeneration(controller)) return;
      setImageCandidates(urls.map((dataUrl, index) => ({
        ...candidateStyles[index],
        label: `AI 캐릭터 시안 ${index + 1}`,
        dataUrl,
      })));
      setGenerationSource("api");
      setGenerated(true);
      setSelectedImage(-1);
    } catch {
      if (!isCurrentGeneration(controller)) return;
      setError("이미지 후보를 생성하지 못했어요. 기존 후보와 선택, 입력은 유지했으니 다시 시도해 주세요.");
    } finally {
      if (isCurrentGeneration(controller)) {
        controller.abort();
        generation.current.controller = undefined;
        setGenerating(false);
      }
    }
  }

  return (
    <form onSubmit={submit} onChangeCapture={cancelGeneration} onClickCapture={(event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (button && !['generate-character-images', 'regenerate-character-images'].includes(button.dataset.testid ?? '')) cancelGeneration();
    }} className="mx-auto max-w-5xl px-5 py-10 pb-28 sm:px-8 lg:py-16" data-testid="character-builder">
      {generating ? <div role="status" className="mb-4 flex items-center justify-between rounded-xl bg-orange-50 p-3 text-sm"><span>이미지 생성 중 · 편집하거나 단계를 이동하면 생성이 취소됩니다.</span><button type="button" onClick={cancelGeneration} className="shrink-0 px-3 py-2 font-bold">이미지 생성 취소</button></div> : null}
      {generationNotice ? <p role="status" className="mb-4 text-sm text-neutral-600">{generationNotice}</p> : null}
      <div className="flex flex-col gap-6 border-b border-black/8 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#e16748]">{editing ? `Character editor · v${initialCharacter?.versionNumber ?? 1}` : "Character maker"}</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">{editing ? "캐릭터 새 버전 만들기" : "나만의 영어 친구 만들기"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{editing ? "저장할 때마다 이전 설정을 보존한 새 버전이 만들어져요." : "성격과 학습 목표를 설계하면 AI가 일관된 말투와 모습의 캐릭터를 만들어요."}</p>
        </div>
        <div className="flex gap-2" aria-label={`총 3단계 중 ${step}단계`}>
          {[1, 2, 3].map((item) => (
            <span key={item} className={`h-2 rounded-full transition-all ${item === step ? "w-10 bg-[#f06f52]" : item < step ? "w-5 bg-neutral-950" : "w-5 bg-neutral-200"}`} />
          ))}
        </div>
      </div>

      {initialCharacter ? (
        <section className="mt-6 rounded-[1.5rem] border border-black/7 bg-white p-5" data-testid="character-version-history" aria-label="캐릭터 버전 기록">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black">버전 기록</h2><span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">현재 {statusLabel(initialCharacter.publishStatus ?? "draft")}</span></div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedVersions.slice().reverse().map((version) => <li key={version.versionNumber} className="rounded-xl bg-neutral-50 p-3" data-testid={`character-version-${version.versionNumber}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">v{version.versionNumber}</strong><span className="text-[10px] font-black text-neutral-500">{statusLabel(version.status)}</span></div><p className="mt-2 truncate text-xs font-semibold">{version.snapshot.name} · {version.snapshot.role}</p><p className="mt-1 text-[10px] text-neutral-400">{new Date(version.createdAt).toLocaleString("ko-KR")}</p></li>)}
          </ol>
        </section>
      ) : null}

      <div className="mt-8 rounded-[1.75rem] border border-black/6 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,.45)] sm:p-8">
        {step === 1 ? (
          <section aria-labelledby="character-step-1" className="space-y-8">
            <div><span className="text-xs font-bold text-[#e16748]">STEP 1</span><h2 id="character-step-1" className="mt-1 text-2xl font-black">누구를 만나고 싶나요?</h2></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">이름 <span className="text-[#e16748]">*</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="예: Sophie" className="form-field" data-testid="character-name" /></label>
              <label className="space-y-2 text-sm font-bold">역할 <span className="text-[#e16748]">*</span><input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="예: 다정한 여행 메이트" className="form-field" data-testid="character-role" /></label>
            </div>
            <label className="block space-y-2 text-sm font-bold">한 줄 소개<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="이 캐릭터가 어떤 상황에서 나를 도와주나요?" rows={3} className="form-field resize-none" /></label>
            <fieldset><legend className="text-sm font-bold">성격 <span className="ml-2 text-xs font-normal text-neutral-400">여러 개 선택 가능</span></legend><div className="mt-3 flex flex-wrap gap-2">{traits.map((trait) => <button key={trait} type="button" onClick={() => toggleItem(trait, personality, setPersonality)} aria-pressed={personality.includes(trait)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${personality.includes(trait) ? "border-neutral-950 bg-neutral-950 text-white" : "border-black/10 hover:border-black/30"}`}>{trait}</button>)}</div></fieldset>
            <fieldset><legend className="text-sm font-bold">주요 대화 주제</legend><div className="mt-3 flex flex-wrap gap-2">{topics.map((topic) => <button key={topic} type="button" onClick={() => toggleItem(topic, selectedTopics, setSelectedTopics)} aria-pressed={selectedTopics.includes(topic)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${selectedTopics.includes(topic) ? "border-[#f06f52] bg-[#fff0eb] text-[#d8583c]" : "border-black/10"}`}>{topic}</button>)}</div></fieldset>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="character-step-2" className="space-y-7">
            <div><span className="text-xs font-bold text-[#e16748]">STEP 2</span><h2 id="character-step-2" className="mt-1 text-2xl font-black">대화 방식과 목표를 정해요</h2></div>
            <label className="block space-y-2 text-sm font-bold">캐릭터의 존재 목적 <span className="text-[#e16748]">*</span><textarea required value={personaGoal} onChange={(event) => setPersonaGoal(event.target.value)} rows={2} placeholder="예: 낯선 도시에 도착한 여행객을 따뜻하게 맞이하기" className="form-field resize-none" data-testid="character-persona-goal" /></label>
            <label className="block space-y-2 text-sm font-bold">학습 목표 <span className="text-[#e16748]">*</span><textarea required value={learningGoal} onChange={(event) => setLearningGoal(event.target.value)} rows={3} placeholder="예: 학습자가 여행지에서 먼저 질문할 용기를 갖도록 돕기" className="form-field resize-none" data-testid="character-learning-goal" /></label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-bold">학습자와의 관계<input value={relationship} onChange={(event) => setRelationship(event.target.value)} className="form-field" data-testid="character-relationship" /></label>
              <label className="block space-y-2 text-sm font-bold">교육 태도<input value={teachingStyle} onChange={(event) => setTeachingStyle(event.target.value)} className="form-field" data-testid="character-teaching-style" /></label>
            </div>
            <label className="block space-y-2 text-sm font-bold">말하기 지침<textarea value={speakingStyle} onChange={(event) => setSpeakingStyle(event.target.value)} rows={3} className="form-field resize-none" /></label>
            <label className="block space-y-2 text-sm font-bold">금지 지침 <span className="text-xs font-normal text-neutral-400">한 줄에 하나</span><textarea value={prohibitedInstructions} onChange={(event) => setProhibitedInstructions(event.target.value)} rows={3} className="form-field resize-none" data-testid="character-prohibited-instructions" /></label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">영어 억양<select value={accent} onChange={(event) => setAccent(event.target.value)} className="form-field"><option>American</option><option>British</option><option>Canadian</option><option>Australian</option></select></label>
              <label className="space-y-2 text-sm font-bold">권장 레벨<select value={level} onChange={(event) => setLevel(event.target.value as CharacterDraft["level"])} className="form-field"><option>입문</option><option>초급</option><option>중급</option></select></label>
            </div>
            <fieldset><legend className="text-sm font-bold">공개 범위</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ value: "private", title: "나만 보기", detail: "내 대화와 미션에서만 사용", icon: Lock }, { value: "public", title: "모두에게 공개", detail: "다른 학습자도 캐릭터를 발견", icon: Eye }] as const).map((option) => { const Icon = option.icon; return <button key={option.value} type="button" onClick={() => setVisibility(option.value)} aria-pressed={visibility === option.value} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${visibility === option.value ? "border-[#5763d7] bg-[#f1f2ff]" : "border-black/8"}`}><span className="grid size-10 place-items-center rounded-xl bg-white"><Icon className="size-4" /></span><span><strong className="block text-sm">{option.title}</strong><span className="text-xs text-neutral-500">{option.detail}</span></span></button>; })}</div></fieldset>
            <fieldset><legend className="text-sm font-bold">저장 상태</legend><div className="mt-3 flex gap-2">{statusOptions.map((status) => <button key={status} type="button" onClick={() => setPublishStatus(status)} aria-pressed={publishStatus === status} className={`rounded-full border px-4 py-2 text-xs font-black ${publishStatus === status ? "border-[#f06f52] bg-[#fff0eb] text-[#c94e34]" : "border-black/10"}`}>{status === "draft" ? "초안으로 저장" : status === "published" ? (editing ? "게시 상태로 저장" : "검토 후 게시") : "보관하기"}</button>)}</div></fieldset>
          </section>
        ) : null}

        {step === 3 ? (
          <section aria-labelledby="character-step-3" className="space-y-7">
            <div><span className="text-xs font-bold text-[#e16748]">STEP 3</span><h2 id="character-step-3" className="mt-1 text-2xl font-black">캐릭터의 모습을 만들어요</h2><p className="mt-2 text-sm text-neutral-500">설정한 성격과 목표를 바탕으로 이미지 후보를 생성합니다. 테스트 환경에서는 결정적 mock 이미지가 사용돼요.</p></div>
            {!generated ? (
              <button type="button" onClick={generateImages} disabled={generating} className="grid min-h-72 w-full place-items-center rounded-[1.5rem] border-2 border-dashed border-black/12 bg-[#faf8f4] transition hover:border-[#f06f52] hover:bg-[#fff8f5] disabled:opacity-60" data-testid="generate-character-images"><span className="flex flex-col items-center"><span className="grid size-16 place-items-center rounded-2xl bg-[#fff0eb] text-[#e16748]"><WandSparkles className="size-7" /></span><strong className="mt-4">{generating ? "AI가 이미지를 만드는 중..." : "AI 이미지 후보 생성"}</strong><span className="mt-1 text-xs text-neutral-500">안전한 캐릭터 초안을 만들어요</span></span></button>
            ) : (
              <><div className="mb-3 flex justify-end"><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${generationSource === "api" ? "bg-emerald-100 text-emerald-700" : generationSource === "existing" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-800"}`} data-testid="image-generation-source">{generationSource === "api" ? "AI Route 복수 응답" : "현재 버전 이미지"}</span></div><div className="grid gap-4 sm:grid-cols-3" data-testid="character-image-candidates">{imageCandidates.map((image, index) => <button key={`${image.label}-${index}`} type="button" disabled={generating} onClick={() => { setSelectedImage(index); setError(""); }} aria-pressed={selectedImage === index} className={`relative overflow-hidden rounded-[1.5rem] border-2 text-left transition ${selectedImage === index ? "border-neutral-950 shadow-lg" : "border-transparent"}`}><span className="grid h-64 place-items-center bg-cover bg-center text-7xl" style={{ background: image.dataUrl ? `url(${image.dataUrl}) center / cover` : `linear-gradient(145deg, ${image.palette[0]}, ${image.palette[1]})` }}>{image.dataUrl ? null : image.emoji}</span><span className="flex items-center justify-between bg-[#faf8f4] px-4 py-3 text-xs font-bold">{image.label}{selectedImage === index ? <span className="grid size-5 place-items-center rounded-full bg-neutral-950 text-white"><Check className="size-3" /></span> : null}</span></button>)}</div>{selectedImage >= 0 ? <article className="mt-6 grid overflow-hidden rounded-[1.5rem] border border-black/8 bg-[#faf8f4] sm:grid-cols-[180px_1fr]" data-testid="character-preview"><div className="grid min-h-44 place-items-center bg-cover bg-center text-6xl" style={{ background: imageCandidates[selectedImage]?.dataUrl ? `url(${imageCandidates[selectedImage].dataUrl}) center / cover` : `linear-gradient(145deg, ${imageCandidates[selectedImage]?.palette[0]}, ${imageCandidates[selectedImage]?.palette[1]})` }}>{imageCandidates[selectedImage]?.dataUrl ? null : imageCandidates[selectedImage]?.emoji}</div><div className="p-5"><span className="text-[10px] font-black uppercase tracking-widest text-[#e16748]">게시 전 미리보기 · {statusLabel(publishStatus)}</span><h3 className="mt-2 text-2xl font-black">{name || "이름 없는 캐릭터"}</h3><p className="text-sm font-semibold text-neutral-500">{role || "역할 미정"} · {relationship}</p><p className="mt-3 text-sm leading-6">“Hi! I’m {name || "your new friend"}. Let’s practice one useful sentence together.”</p><p className="mt-3 text-xs text-neutral-500">{personality.join(" · ")} · {teachingStyle}</p></div></article> : <p role="status" className="mt-4 text-sm text-neutral-600">대표 이미지로 사용할 후보를 직접 선택해 주세요.</p>}<button type="button" disabled={generating} onClick={generateImages} data-testid="regenerate-character-images" className="mt-4 rounded-xl border px-4 py-3 text-sm font-bold">{generating ? "이미지 생성 중..." : "이미지 후보 다시 생성"}</button></>
            )}
            <div className="flex items-start gap-3 rounded-2xl bg-[#f1f2ff] p-4 text-sm leading-6 text-[#393f8f]"><ImageIcon className="mt-1 size-4 shrink-0" /><p>이미지와 텍스트는 안전 검토를 거칩니다. 생성 원본은 Supabase 비공개 Storage에 보관하고, 승인된 게시 썸네일만 공개 버킷으로 승격합니다.</p></div>
          </section>
        ) : null}

        {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-9 flex items-center justify-between border-t border-black/7 pt-6">
          <button type="button" onClick={() => step === 1 ? router.back() : setStep((value) => value - 1)} className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold hover:bg-neutral-100"><ArrowLeft className="size-4" /> {step === 1 ? "취소" : "이전"}</button>
          {step < 3 ? <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white hover:bg-[#f06f52]">다음 단계 <ArrowRight className="size-4" /></button> : <button type="button" onClick={(event) => event.currentTarget.form?.requestSubmit()} disabled={pending || generating || initialCharacter?.publishStatus === "archived"} className="inline-flex items-center gap-2 rounded-full bg-[#f06f52] px-6 py-3 text-sm font-bold text-white hover:bg-[#dc5a3d] disabled:opacity-60" data-testid="save-character"><Sparkles className="size-4" /> {pending ? "저장 중..." : editing ? "새 버전 저장" : "캐릭터 저장"}</button>}
        </div>
      </div>
    </form>
  );
}
