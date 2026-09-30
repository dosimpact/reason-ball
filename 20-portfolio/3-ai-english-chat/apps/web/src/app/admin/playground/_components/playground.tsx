"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, MessageCircle, Volume2 } from "lucide-react";

import { RichText } from "@/entities/chat/ui/rich-text";
import { Button } from "@/shared/ui/button";

type Mode = "chat" | "image" | "speech";
type Message = { role: "user" | "assistant"; content: string };
const tabs = [
  { id: "chat" as const, label: "채팅", icon: MessageCircle },
  { id: "image" as const, label: "이미지", icon: ImagePlus },
  { id: "speech" as const, label: "음성", icon: Volume2 },
];
const initialPrompts: Record<Mode, string> = {
  chat: "Hi! Can we practice ordering coffee in English?",
  image: "A warm cinematic portrait of a friendly English tutor in a cozy cafe, soft afternoon light",
  speech: "Hi there! Welcome to our English conversation. What would you like to talk about today?",
};

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined);
  return body?.error?.message ?? `요청에 실패했습니다 (${response.status}).`;
}

export function Playground() {
  const [mode, setMode] = useState<Mode>("chat");
  const [prompts, setPrompts] = useState(initialPrompts);
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<string>();
  const [audio, setAudio] = useState<string>();
  const [voice, setVoice] = useState("marin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [model, setModel] = useState<string>();
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const audioUrl = useRef<string | undefined>(undefined);

  useEffect(() => () => {
    activeRequest.current?.abort();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }, []);

  function changeMode(next: Mode) {
    activeRequest.current?.abort();
    activeRequest.current = undefined;
    setBusy(false);
    setError(undefined);
    setModel(undefined);
    setMode(next);
  }

  async function generate() {
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setBusy(true);
    setError(undefined);
    const userMessage: Message = { role: "user", content: prompts[mode].trim() };
    const nextMessages = [...messages.slice(-18), userMessage];
    const payload = mode === "chat" ? { messages: nextMessages }
      : mode === "image" ? { kind: "avatar", prompt: prompts.image, size: "1024x1024" }
      : { text: prompts.speech, voice, speed: 1 };
    try {
      const response = await fetch(`/api/admin/playground/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readError(response));
      if (mode === "speech") {
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = URL.createObjectURL(blob);
        setAudio(audioUrl.current);
        setModel(response.headers.get("X-AI-Model") ?? undefined);
      } else {
        const result = await response.json();
        if (controller.signal.aborted) return;
        setModel(result.modelId);
        if (mode === "image") setImage(result.dataUrl);
        else {
          setMessages([...nextMessages, { role: "assistant", content: result.text }]);
          setPrompts((previous) => ({ ...previous, chat: "" }));
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "요청에 실패했습니다.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = undefined;
        setBusy(false);
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-5 py-10 md:px-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Development only</p>
        <h1 className="text-3xl font-bold tracking-tight">AI Playground</h1>
        <p className="text-sm text-muted-foreground">채팅, 캐릭터 이미지, AI 음성을 간단히 테스트하세요. 결과는 이 화면에만 남습니다. 실제 공급자 요청에는 비용이 발생할 수 있습니다.</p>
        <p className="text-xs text-muted-foreground">실제 API 테스트는 로그인 후 사용할 수 있습니다. 공급자와 모델은 서버 설정을 따릅니다.</p>
      </header>
      <div role="tablist" aria-label="생성 기능" className="flex gap-2">
        {tabs.map(({ id, label, icon: Icon }) => <Button key={id} role="tab" aria-selected={mode === id} aria-controls={`playground-${id}`} id={`tab-${id}`} variant={mode === id ? "default" : "outline"} size="lg" onClick={() => changeMode(id)}><Icon />{label}</Button>)}
      </div>
      <section role="tabpanel" id={`playground-${mode}`} aria-labelledby={`tab-${mode}`} className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-4 rounded-2xl border border-border bg-card p-6" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <label htmlFor="playground-prompt" className="block text-sm font-semibold">{mode === "chat" ? "메시지" : mode === "image" ? "이미지 설명" : "읽을 문장"}</label>
          <textarea id="playground-prompt" value={prompts[mode]} maxLength={mode === "image" ? 1200 : 4000} rows={7} required disabled={busy} onChange={(event) => setPrompts((previous) => ({ ...previous, [mode]: event.target.value }))} className="w-full resize-y rounded-xl border border-input bg-background p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
          {mode === "speech" ? <div className="space-y-2"><label htmlFor="playground-voice" className="text-sm font-semibold">음성</label><select id="playground-voice" value={voice} disabled={busy} onChange={(event) => setVoice(event.target.value)} className="ml-3 rounded-lg border border-input bg-background p-2 text-sm">{["marin", "coral", "alloy", "Kore", "Puck", "Aoede", "Charon", "Fenrir"].map((name) => <option key={name}>{name}</option>)}</select></div> : null}
          <div className="flex flex-wrap gap-2"><Button type="submit" size="lg" disabled={busy || !prompts[mode].trim() || (mode === "image" && prompts.image.trim().length < 10)}>{busy ? "생성 중…" : mode === "chat" ? "보내기" : mode === "image" ? "이미지 생성" : "음성 생성"}</Button>{busy ? <Button type="button" variant="outline" onClick={() => { activeRequest.current?.abort(); setBusy(false); }}>중단</Button> : null}{mode === "chat" ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setMessages([])}>대화 초기화</Button> : null}</div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </form>
        <div className="min-h-72 space-y-4 rounded-2xl border border-border bg-card p-6" aria-live="polite" aria-busy={busy}>
          <h2 className="font-semibold">결과</h2>
          {mode === "chat" ? messages.length ? <div className="max-h-[500px] space-y-3 overflow-y-auto">{messages.map((message, index) => <div key={index} className={`rounded-xl p-3 text-sm ${message.role === "user" ? "ml-6 bg-primary/10" : "mr-6 bg-muted"}`}><p className="mb-2 text-xs text-muted-foreground">{message.role === "user" ? "나" : "AI"}</p><RichText text={message.content} /></div>)}</div> : <p className="text-sm text-muted-foreground">첫 메시지를 보내 대화를 시작하세요.</p> : null}
          {mode === "image" ? image ? <img src={image} alt="Playground에서 생성한 캐릭터 이미지" className="w-full rounded-xl" /> : <p className="text-sm text-muted-foreground">생성한 이미지가 여기에 표시됩니다.</p> : null}
          {mode === "speech" ? audio ? <><audio controls src={audio} className="w-full" /><p className="text-xs text-muted-foreground">AI가 생성한 음성입니다.</p></> : <p className="text-sm text-muted-foreground">음성을 생성한 뒤 재생 버튼으로 들어보세요.</p> : null}
          {model ? <p className="text-xs text-muted-foreground">모델: {model}</p> : null}
        </div>
      </section>
    </div>
  );
}
