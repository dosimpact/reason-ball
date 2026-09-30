"use client";

import { ImageIcon, LoaderCircle, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readGeneratedImage } from "@/shared/lib/read-generated-image";

type Kind = "image" | "video";

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.error?.message || `생성 요청을 완료하지 못했어요. (${response.status})`);
}

/** Explicit generation only. Closing cancels observation, not a provider job already accepted. */
export function CharacterMediaStudio({ characterName, conversationExcerpt }: { characterName: string; conversationExcerpt: string }) {
  const [kind, setKind] = useState<Kind>();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [operationToken, setOperationToken] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  useEffect(() => () => { requestRef.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  function choose(next?: Kind) {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false); setError(""); setKind(next);
  }

  async function generate(resume = false) {
    if (!kind || busy || (kind === "video" && !resume && operationToken)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError("");
    try {
      let token = operationToken;
      if (!resume) {
        const response = await fetch(`/api/ai/${kind}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify(kind === "image" ? { kind: "artifact", prompt, size: "1024x1536" } : { prompt, aspectRatio: "9:16" }),
        });
        if (!response.ok) throw await responseError(response);
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (kind === "image") {
          const url = await readGeneratedImage(payload);
          if (!controller.signal.aborted) setImageUrl(url);
          return;
        }
        if (typeof payload.operationToken !== "string") throw new Error("영상 생성 요청을 확인하지 못했어요.");
        token = payload.operationToken;
        if (!controller.signal.aborted) setOperationToken(token);
      }
      // A single status request is explicit; the user can check again without creating another paid job.
      const status = await fetch(`/api/ai/video?token=${encodeURIComponent(token)}`, { signal: controller.signal, cache: "no-store" });
      if (!status.ok) throw await responseError(status);
      if (status.headers.get("content-type")?.startsWith("video/mp4")) {
        const blob = await status.blob();
        if (controller.signal.aborted) return;
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = URL.createObjectURL(blob);
        setVideoUrl(objectUrl.current); setOperationToken("");
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "생성을 완료하지 못했어요.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  return <section aria-label="캐릭터 미디어" className="mb-3">
    <div className="flex gap-2">
      <button type="button" onClick={() => choose(kind === "image" ? undefined : "image")} aria-expanded={kind === "image"} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-2 text-xs"><ImageIcon className="size-3.5" />이미지 생성</button>
      <button type="button" onClick={() => choose(kind === "video" ? undefined : "video")} aria-expanded={kind === "video"} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-2 text-xs"><Video className="size-3.5" />영상 생성</button>
    </div>
    {kind ? <div className="mt-3 max-h-[45svh] space-y-3 overflow-y-auto rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{characterName}와 상상하는 장면</h2><button type="button" onClick={() => choose()} aria-label="미디어 생성 닫기"><X className="size-4" /></button></div>
      <label className="block text-xs text-muted-foreground">만들고 싶은 장면<textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1200} rows={2} className="form-field" placeholder="예: 햇살이 들어오는 카페에서 여행 이야기를 나누는 두 친구" /></label>
      {conversationExcerpt ? <button type="button" disabled={busy} onClick={() => setPrompt(`Create a scene with ${characterName}, inspired by this conversation:\n${conversationExcerpt}`.slice(0, 1200))} className="text-xs text-muted-foreground underline">최근 대화를 장면 설명에 넣기</button> : null}
      <p className="text-[11px] leading-5 text-muted-foreground">AI 생성 콘텐츠 · 입력한 설명으로 새 장면을 만듭니다. 캐릭터 사진은 자동 전송하지 않아요. 결과는 이 화면에 임시 표시되며 다운로드할 수 있어요.{kind === "video" ? " 영상은 유료 생성이며 시간이 걸립니다. 창을 닫아도 시작된 공급자 작업은 취소되지 않아요." : ""}</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void generate()} disabled={busy || prompt.trim().length < 10 || (kind === "video" && Boolean(operationToken))} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">{busy ? <LoaderCircle className="size-3 animate-spin" /> : null}{kind === "image" ? "장면 이미지 만들기" : "영상 생성 시작"}</button>{kind === "video" && operationToken ? <><button type="button" disabled={busy} onClick={() => void generate(true)} className="rounded-full border border-border px-4 py-2 text-xs">생성 상태 확인</button><button type="button" disabled={busy} onClick={() => { setOperationToken(""); setError(""); }} className="rounded-full border border-border px-4 py-2 text-xs">현재 요청 확인 종료</button></> : null}</div>
      {kind === "video" && operationToken ? <p role="status" className="text-xs text-muted-foreground">기존 영상 요청을 확인하고 있어요. 상태 확인은 새 요청을 만들지 않습니다. 확인을 종료하면 이 요청을 다시 조회할 수 없으며, 공급자 작업은 취소되지 않습니다. 이후 ‘영상 생성 시작’을 누르면 별도 유료 요청이 시작됩니다.</p> : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {kind === "image" && imageUrl ? <div><img src={imageUrl} alt="직접 요청해 생성한 캐릭터 장면" className="max-h-64 rounded-xl" /><a download="lingua-scene.png" href={imageUrl} className="mt-2 inline-block text-xs underline">이미지 다운로드</a></div> : null}
      {kind === "video" && videoUrl ? <div><video src={videoUrl} controls className="max-h-64 rounded-xl" /><a download="lingua-scene.mp4" href={videoUrl} className="mt-2 inline-block text-xs underline">영상 다운로드</a></div> : null}
    </div> : null}
  </section>;
}
