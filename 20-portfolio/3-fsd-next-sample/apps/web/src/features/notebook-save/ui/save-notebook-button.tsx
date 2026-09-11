"use client";

import { createUuid } from "@/shared/lib/uuid";
import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSaveNotebook } from "@/entities/learning-notebook/api/use-notebook";
import { notebookDraftSchema, type NotebookDraft, type SaveNotebookRequest } from "@/entities/learning-notebook/model/notebook";

type Props = { text: string; conversationId: string; messageId: string; disabled?: boolean };
export function SaveNotebookButton(props: Props) {
  const [open, setOpen] = useState(false);
  return <><button type="button" disabled={props.disabled} onClick={() => setOpen(true)} className="message-action" aria-label="복습 기록 저장"><Bookmark /></button>
    {open ? <NotebookEditor {...props} onClose={() => setOpen(false)} /> : null}</>;
}

function NotebookEditor({ text: initialText, conversationId, messageId, onClose }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<SaveNotebookRequest | null>(null);
  const [kind, setKind] = useState<NotebookDraft["kind"]>("expression");
  const [text, setText] = useState(initialText);
  const [meaning, setMeaning] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const mutation = useSaveNotebook();
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close() {
    if (mutation.isPending) return;
    if (!saved && (pending.current || meaning || originalText || text !== initialText || kind !== "expression")
      && !window.confirm("저장 창을 닫을까요? 아직 저장되지 않은 입력은 사라집니다.")) return;
    onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending || saved) return;
    const parsed = notebookDraftSchema.safeParse({ kind, text, meaning, originalText: kind === "correction" ? originalText : "", source: { conversationId, messageId } });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요."); return; }
    if (!pending.current) pending.current = { id: createUuid(), draft: parsed.data };
    setSubmitted(true);
    setError("");
    try {
      const result = await mutation.mutateAsync(pending.current);
      setSaved(result.outcome === "duplicate" ? "이미 저장한 기록이에요. 기존 메모와 출처를 유지했어요." : "복습 기록을 저장했어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했어요. 입력은 유지했습니다."); }
  }
  const locked = mutation.isPending || submitted || Boolean(saved);
  return <dialog ref={dialog} aria-label="복습 기록 저장" onCancel={(event) => { event.preventDefault(); close(); }} className="m-auto max-h-[85svh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-neutral-900 shadow-xl backdrop:bg-black/40">
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-black">내 복습 기록</h2>
      <p className="text-xs text-neutral-500">필요한 표현만 골라 저장하세요. 개인 복습 기록이며 원본 대화를 지워도 유지됩니다.</p>
      <fieldset disabled={locked} className="space-y-3 disabled:opacity-70">
        <label className="block text-sm">기록 종류<select value={kind} onChange={(event) => setKind(event.target.value as NotebookDraft["kind"])} className="mt-1 block w-full rounded-lg border p-2"><option value="expression">표현</option><option value="word">단어</option><option value="correction">교정</option></select></label>
        {kind === "correction" ? <label className="block text-sm">교정 전 문장<textarea aria-label="교정 전 문장" value={originalText} onChange={(event) => setOriginalText(event.target.value)} maxLength={1000} className="mt-1 block w-full rounded-lg border p-2" /></label> : null}
        <label className="block text-sm">저장할 표현<textarea aria-label="저장할 표현" autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} className="mt-1 block min-h-24 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">뜻 또는 복습 메모<textarea aria-label="뜻 또는 복습 메모" value={meaning} onChange={(event) => setMeaning(event.target.value)} maxLength={2000} className="mt-1 block w-full rounded-lg border p-2" /></label>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p role="status" className="text-sm text-emerald-700">{saved}</p> : null}
      {error && submitted ? <p className="text-xs text-neutral-500">응답을 확인할 때까지 같은 요청으로 재시도합니다. 입력을 바꾸려면 닫은 뒤 새로 저장하세요.</p> : null}
      <div className="flex justify-end gap-3"><button type="button" disabled={mutation.isPending} onClick={close} className="rounded-lg border px-4 py-2">닫기</button>{!saved ? <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-indigo-700 px-4 py-2 text-white">{mutation.isPending ? "저장 중…" : submitted ? "같은 내용으로 다시 저장" : "복습 기록에 저장"}</button> : null}</div>
    </form>
  </dialog>;
}
