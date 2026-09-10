"use client";

import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Download,
  FileText,
  ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Table2,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodeRunner } from "./code-runner";
import type { ArtifactEdit, ChatArtifact, ChatArtifactKind, ChatArtifactVersion } from "@/entities/chat";

type ArtifactWorkspaceProps = {
  artifacts: ChatArtifact[];
  initialKind?: ChatArtifactKind;
  onChange: (artifacts: ChatArtifact[]) => void;
  onClose: () => void;
  persistence?: {
    create: (kind: ChatArtifactKind, edit: ArtifactEdit) => Promise<ChatArtifact>;
    save: (id: string, edit: ArtifactEdit, expectedVersionId: string, forceVersion?: boolean) => Promise<ChatArtifact>;
  };
};

const defaults: Record<ChatArtifactKind, { content: string; title: string }> = {
  code: { content: "1 + 2 * 3", title: "Practice code" },
  image: { content: "A warm London hotel lobby at sunset, editorial illustration", title: "Scene prompt" },
  sheet: { content: "Expression,Meaning\nI'd like to check in.,체크인하고 싶어요.\nIs breakfast included?,조식이 포함되어 있나요?", title: "Expression sheet" },
  text: { content: "# Today’s practice\n\nI has a reservation under Minji Kim", title: "Practice note" },
};

const kindMeta = {
  code: { icon: Code2, label: "Code" },
  image: { icon: ImageIcon, label: "Image" },
  sheet: { icon: Table2, label: "Sheet" },
  text: { icon: FileText, label: "Text" },
} satisfies Record<ChatArtifactKind, { icon: typeof FileText; label: string }>;

function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createArtifactValue(kind: ChatArtifactKind): ChatArtifact {
  const now = new Date().toISOString();
  const content = defaults[kind].content;
  return {
    autosavedAt: now,
    createdAt: now,
    draft: content,
    id: newId("artifact"),
    kind,
    title: defaults[kind].title,
    updatedAt: now,
    versions: [{ content, createdAt: now, id: newId("version") }],
  };
}

function parseCsv(content: string) {
  return content.split(/\r?\n/).map((row) => row.split(","));
}

function stringifyCsv(rows: string[][]) {
  return rows.map((row) => row.join(",")).join("\n");
}

function polishSelection(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const normalized = trimmed.replace(/\bi has\b/gi, "I have").replace(/\bi is\b/gi, "I am");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}${/[.!?]$/.test(normalized) ? "" : "."}`;
}

export function ArtifactWorkspace({ artifacts, initialKind, onChange, onClose, persistence }: ArtifactWorkspaceProps) {
  const initial = artifacts[0];
  const [selectedId, setSelectedId] = useState(initial?.id);
  const selected = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const [draft, setDraft] = useState(initial?.draft ?? initial?.versions.at(-1)?.content ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;
  const [selection, setSelection] = useState({ end: 0, start: 0 });
  const [viewVersionIndex, setViewVersionIndex] = useState<number>();
  const [sheetAnalysis, setSheetAnalysis] = useState<string>();
  const [imageUrl, setImageUrl] = useState(initial?.versions.at(-1)?.imageUrl);
  const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "error">("idle");
  const [imageError, setImageError] = useState<string>();
  const artifactsRef = useRef(artifacts);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    artifactsRef.current = artifacts;
    onChangeRef.current = onChange;
  }, [artifacts, onChange]);

  useEffect(() => {
    if (!selectedId) return;
    const timeout = window.setTimeout(async () => {
      if (persistenceRef.current) {
        const artifact = artifactsRef.current.find((item) => item.id === selectedId);
        if (!artifact || savingRef.current) return;
        const latest = artifact.versions.at(-1);
        if (artifact.title === title && latest?.content === draft && latest?.imageUrl === imageUrl) {
          setSaveStatus("saved");
          setSaveError(undefined);
          return;
        }
        await persistVersion(selectedId, { title: title.trim() || artifact.title, content: draft, imageUrl });
        return;
      }
      const now = new Date().toISOString();
      onChangeRef.current(artifactsRef.current.map((artifact) => artifact.id === selectedId ? {
        ...artifact,
        autosavedAt: now,
        draft,
        title: title.trim() || artifact.title,
        updatedAt: now,
      } : artifact));
      setSaveStatus("saved");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, selectedId, title, imageUrl]);

  useEffect(() => {
    if (!persistence || saveStatus === "saved") return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [persistence, saveStatus]);

  async function persistVersion(id: string, edit: ArtifactEdit, forceVersion = false) {
    if (!persistenceRef.current || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setSaveStatus("saving");
    setSaveError(undefined);
    try {
      const expectedVersionId = artifactsRef.current.find((artifact) => artifact.id === id)?.versions.at(-1)?.id;
      if (!expectedVersionId) throw new Error("저장 기준 버전을 확인하지 못했어요.");
      const saved = await persistenceRef.current.save(id, edit, expectedVersionId, forceVersion);
      onChangeRef.current(artifactsRef.current.map((artifact) => artifact.id === id ? saved : artifact));
      setDraft(saved.draft ?? "");
      setTitle(saved.title);
      setImageUrl(saved.versions.at(-1)?.imageUrl);
      setViewVersionIndex(undefined);
      setSaveStatus("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Artifact를 저장하지 못했어요.");
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  function changeDraft(value: string) {
    setDraft(value);
    setSaveStatus("saving");
    setViewVersionIndex(undefined);
  }

  function selectArtifact(artifact: ChatArtifact) {
    setSelectedId(artifact.id);
    setTitle(artifact.title);
    setDraft(artifact.draft ?? artifact.versions.at(-1)?.content ?? "");
    setImageUrl(artifact.versions.at(-1)?.imageUrl);
    setViewVersionIndex(undefined);
    setSheetAnalysis(undefined);
  }

  async function createArtifact(kind: ChatArtifactKind) {
    if (persistence) {
      if (savingRef.current || saveStatus !== "saved") return;
      savingRef.current = true;
      setBusy(true);
      setSaveError(undefined);
      try {
        const saved = await persistence.create(kind, defaults[kind]);
        onChange([...artifactsRef.current, saved]);
        selectArtifact(saved);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Artifact를 만들지 못했어요.");
      } finally {
        savingRef.current = false;
        setBusy(false);
      }
      return;
    }
    const artifact = createArtifactValue(kind);
    onChange([...artifacts, artifact]);
    selectArtifact(artifact);
  }

  async function saveVersion(content = draft, versionImageUrl = imageUrl) {
    if (!selected) return;
    if (persistence) {
      // Keep restored/generated content even if the subsequent save fails.
      setDraft(content);
      setImageUrl(versionImageUrl);
      await persistVersion(selected.id, { title: title.trim() || selected.title, content, imageUrl: versionImageUrl }, true);
      return;
    }
    const now = new Date().toISOString();
    const version: ChatArtifactVersion = { content, createdAt: now, id: newId("version"), ...(versionImageUrl ? { imageUrl: versionImageUrl } : {}) };
    const nextArtifacts = artifacts.map((artifact) => artifact.id === selected.id ? {
      ...artifact,
      autosavedAt: now,
      draft: content,
      title: title.trim() || artifact.title,
      updatedAt: now,
      versions: [...artifact.versions, version],
    } : artifact);
    onChange(nextArtifacts);
    setDraft(content);
    setImageUrl(versionImageUrl);
    setViewVersionIndex(undefined);
    setSaveStatus("saved");
  }

  function restoreVersion(version: ChatArtifactVersion) {
    // Explicitly clear an absent image instead of invoking saveVersion's
    // default argument, which would retain the currently displayed image.
    void saveVersion(version.content, version.imageUrl ?? "");
  }

  function rewriteSelection() {
    const start = editorRef.current?.selectionStart ?? selection.start;
    const end = editorRef.current?.selectionEnd ?? selection.end;
    if (start === end) return;
    changeDraft(`${draft.slice(0, start)}${polishSelection(draft.slice(start, end))}${draft.slice(end)}`);
  }

  function applyGrammarSuggestion() {
    const improved = draft.replace(/\bi has\b/gi, "I have").replace(/\bi is\b/gi, "I am");
    changeDraft(improved === draft ? `${draft.trim()}\n\nCould you please help me with that?` : improved);
  }

  function updateCell(rowIndex: number, cellIndex: number, value: string) {
    const rows = parseCsv(draft);
    rows[rowIndex][cellIndex] = value;
    changeDraft(stringifyCsv(rows));
  }

  function cleanSheet() {
    const rows = parseCsv(draft).map((row) => row.map((cell) => cell.trim())).filter((row) => row.some(Boolean));
    changeDraft(stringifyCsv(rows));
  }

  function analyzeSheet() {
    const rows = parseCsv(draft);
    const columns = Math.max(0, ...rows.map((row) => row.length));
    const filled = rows.flat().filter((cell) => cell.trim()).length;
    setSheetAnalysis(`${Math.max(0, rows.length - 1)}개 데이터 행 · ${columns}개 열 · ${filled}개 값`);
  }

  async function generateArtifactImage() {
    setImageStatus("loading");
    setImageError(undefined);
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "artifact", prompt: draft, size: "1024x1024" }),
      });
      const payload = await response.json() as { data?: { dataUrl?: string }; dataUrl?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "이미지를 생성하지 못했어요.");
      const nextUrl = payload.dataUrl ?? payload.data?.dataUrl;
      if (!nextUrl) throw new Error("생성된 이미지 데이터가 없어요.");
      setImageUrl(nextUrl);
      await saveVersion(draft, nextUrl);
      setImageStatus("idle");
    } catch (error) {
      setImageStatus("error");
      setImageError(`이미지를 생성하지 못했어요. ${error instanceof Error ? error.message : "다시 시도해 주세요."}`);
    }
  }

  const versions = selected?.versions ?? [];
  const latestVersionIndex = Math.max(0, versions.length - 1);
  const activeVersionIndex = viewVersionIndex ?? latestVersionIndex;
  const viewedVersion = versions[activeVersionIndex];
  const previewContent = viewVersionIndex === undefined ? draft : viewedVersion?.content ?? draft;
  const previewImageUrl = viewVersionIndex === undefined ? imageUrl : viewedVersion?.imageUrl;
  const previousContent = versions.length > 1 ? versions.at(-2)?.content ?? "" : versions[0]?.content ?? "";
  const sheetRows = useMemo(() => parseCsv(draft), [draft]);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="artifact-workspace-title" data-testid="artifact-workspace">
    <div className="flex max-h-[94svh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.7rem] bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b border-black/8 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#5763d7]">Canvas</p><h2 id="artifact-workspace-title" className="text-xl font-black">Artifact workspace</h2></div><span className={`ml-auto text-[10px] font-bold ${saveStatus === "saving" ? "text-amber-600" : "text-emerald-600"}`} role="status" data-testid="artifact-autosave-status">{saveStatus === "error" ? "저장 실패 · 초안 유지됨" : saveStatus === "saving" ? "자동 저장 중…" : "모든 변경사항 저장됨"}</span><button type="button" onClick={() => { if (!persistence || saveStatus === "saved" || window.confirm("저장되지 않은 변경사항을 버리고 닫을까요?")) onClose(); }} disabled={busy} className="grid size-9 place-items-center rounded-xl hover:bg-neutral-100" aria-label="Artifact 닫기"><X className="size-4" /></button></header>
      {saveError ? <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{saveError}{saveStatus === "error" && selected ? <button type="button" disabled={busy} className="ml-3 underline" onClick={() => void persistVersion(selected.id, { title: title.trim() || selected.title, content: draft, imageUrl })}>Artifact 저장 다시 시도</button> : null}</div> : null}
      <fieldset disabled={busy || imageStatus === "loading"} className="grid min-h-0 min-w-0 flex-1 overflow-hidden md:grid-cols-[240px_1fr]">
        <aside className="overflow-y-auto border-r border-black/8 bg-[#f7f4ef] p-3"><p className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">새 Artifact</p><div className="mt-2 grid grid-cols-2 gap-2">{(Object.keys(kindMeta) as ChatArtifactKind[]).map((kind) => { const Icon = kindMeta[kind].icon; return <button key={kind} type="button" onClick={() => void createArtifact(kind)} disabled={Boolean(persistence) && saveStatus !== "saved"} className="rounded-xl bg-white p-3 text-left text-xs font-bold shadow-sm" aria-label={`${kindMeta[kind].label} artifact 만들기`}><Icon className="mb-2 size-4 text-[#5763d7]" />{kindMeta[kind].label}</button>; })}</div><p className="mt-5 px-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">Artifacts</p><div className="mt-2 space-y-1">{artifacts.map((artifact) => <button key={artifact.id} type="button" onClick={() => selectArtifact(artifact)} disabled={Boolean(persistence) && saveStatus !== "saved"} className={`block w-full rounded-xl px-3 py-2 text-left text-xs ${selected?.id === artifact.id ? "bg-[#5763d7] font-bold text-white" : "hover:bg-white"}`}><span className="block truncate">{artifact.title}</span><span className="opacity-60">{artifact.kind} · v{artifact.versions.length}</span></button>)}</div>{artifacts.length === 0 ? <p className="mt-4 px-2 text-xs leading-5 text-neutral-500">Text, Code, Image 또는 Sheet를 만들어 대화 결과를 발전시켜 보세요.</p> : null}</aside>
        <main className="min-h-0 overflow-y-auto p-5">{selected ? <div>
          <div className="flex flex-wrap items-center gap-2"><label className="flex-1"><span className="sr-only">Artifact 제목</span><input value={title} onChange={(event) => { setTitle(event.target.value); setSaveStatus("saving"); }} className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-bold" aria-label="Artifact 제목" /></label><button type="button" onClick={() => saveVersion()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-bold text-white"><Save className="size-3.5" /> 새 버전 저장</button></div>
          <label className="mt-4 block"><span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Editor</span><textarea ref={editorRef} value={draft} onChange={(event) => changeDraft(event.target.value)} onSelect={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} rows={7} className="mt-2 w-full resize-y rounded-xl border border-black/10 p-3 font-mono text-xs outline-none ring-[#5763d7]/20 focus:ring-3" aria-label="Artifact 내용" /></label>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={rewriteSelection} disabled={!draft} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs font-bold disabled:opacity-35"><WandSparkles className="size-3.5" /> 선택 영역 다듬기</button>{selected.kind === "text" ? <button type="button" onClick={applyGrammarSuggestion} className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"><Sparkles className="size-3.5" /> 문법 제안 적용</button> : null}</div>


          {selected.kind === "sheet" ? <section className="mt-4 rounded-xl border border-black/8 p-3" aria-label="Sheet 편집"><div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><tbody>{sheetRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-black/10 p-1"><input value={cell} onChange={(event) => updateCell(rowIndex, cellIndex, event.target.value)} className={`w-full min-w-28 bg-transparent px-1 py-1 outline-none ${rowIndex === 0 ? "font-bold" : ""}`} aria-label={`셀 ${rowIndex + 1}-${cellIndex + 1}`} /></td>)}</tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={cleanSheet} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold">데이터 정리</button><button type="button" onClick={analyzeSheet} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold">Sheet 분석</button><button type="button" onClick={() => navigator.clipboard?.writeText(draft)} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold">CSV 복사</button><a href={`data:text/csv;charset=utf-8,${encodeURIComponent(draft)}`} download={`${title || "artifact"}.csv`} className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white" aria-label="CSV 다운로드"><Download className="size-3.5" /> CSV 다운로드</a></div>{sheetAnalysis ? <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs font-semibold text-indigo-700" data-testid="sheet-analysis">{sheetAnalysis}</p> : null}</section> : null}

          {selected.kind === "image" ? <section className="mt-4 rounded-xl border border-black/8 p-3" aria-label="Image 생성"><button type="button" onClick={() => void generateArtifactImage()} disabled={imageStatus === "loading"} className="inline-flex items-center gap-2 rounded-lg bg-[#5763d7] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{imageStatus === "loading" ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}{imageStatus === "loading" ? "이미지 생성 중…" : "이미지 생성"}</button>{imageError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">{imageError}</p> : null}</section> : null}

          <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Preview · v{activeVersionIndex + 1}{viewVersionIndex === undefined ? " latest" : ""}</p><div className="flex gap-2"><button type="button" onClick={() => setViewVersionIndex(Math.max(0, activeVersionIndex - 1))} disabled={activeVersionIndex === 0} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold disabled:opacity-35"><ArrowLeft className="size-3" /> 이전 버전 보기</button><button type="button" onClick={() => setViewVersionIndex(undefined)} disabled={viewVersionIndex === undefined} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold disabled:opacity-35">최신 버전 보기 <ArrowRight className="size-3" /></button></div></div><div className="mt-2" data-testid={`artifact-${selected.kind}-preview`}>{selected.kind === "code" ? <pre className="overflow-x-auto rounded-xl bg-neutral-950 p-4 text-xs text-neutral-100"><code>{previewContent}</code></pre> : selected.kind === "sheet" ? <pre className="overflow-x-auto rounded-xl bg-[#f7f4ef] p-4 text-xs">{previewContent}</pre> : selected.kind === "image" ? previewImageUrl ? <img src={previewImageUrl} alt="생성된 Artifact" className="max-h-80 w-full rounded-xl object-contain" data-testid="generated-artifact-image" /> : <div className="grid min-h-48 place-items-center rounded-xl bg-gradient-to-br from-indigo-100 via-rose-50 to-amber-100 p-8 text-center"><div><ImageIcon className="mx-auto size-10 text-[#5763d7]" /><p className="mt-3 max-w-sm text-sm font-semibold text-neutral-700">{previewContent}</p></div></div> : <div className="whitespace-pre-wrap rounded-xl bg-[#f7f4ef] p-4 text-sm leading-6">{previewContent}</div>}</div></div>

          <section className="mt-5 rounded-xl border border-black/8 p-3" aria-label="버전 차이"><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Diff · previous ↔ current</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-[10px] text-red-800" data-testid="artifact-diff-previous">- {previousContent}</pre><pre className="overflow-x-auto rounded-lg bg-emerald-50 p-3 text-[10px] text-emerald-800" data-testid="artifact-diff-current">+ {draft}</pre></div></section>
          <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Version history</p><div className="mt-2 flex flex-wrap gap-2">{versions.map((version, index) => <button key={version.id} type="button" onClick={() => restoreVersion(version)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 text-xs font-bold" aria-label={`버전 ${index + 1} 복원`}><RotateCcw className="size-3" /> v{index + 1}</button>)}</div></div>
        </div> : <div className="grid min-h-80 place-items-center text-center"><div><Plus className="mx-auto size-8 text-neutral-300" /><p className="mt-3 font-bold">Artifact를 선택하거나 새로 만드세요.</p>{initialKind ? <button type="button" onClick={() => createArtifact(initialKind)} className="mt-4 rounded-xl bg-[#5763d7] px-4 py-2 text-xs font-bold text-white">{kindMeta[initialKind].label} artifact 시작</button> : null}</div></div>}</main>
      </fieldset>
      {selected?.kind === "code" ? <div className="relative max-h-[40svh] shrink-0 overflow-y-auto border-t border-black/8 bg-white px-5 pb-4"><CodeRunner key={`${selected.id}:${draft}`} source={draft} /></div> : null}
    </div>
  </div>;
}
