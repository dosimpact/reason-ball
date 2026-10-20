"use client";

import { useCallback, useState } from "react";
import { BuiltinActionType, Renderer, type ActionEvent, type OpenUIError } from "@openuidev/react-lang";
import { library } from "@/lib/library";
import { runLibraryAction } from "@/lib/actions";
import { webUrl } from "@/lib/components/style";
import { RenderBoundary } from "./report-view";
import type { ChatMessage } from "./state";

export function ChatUI({ message, onSend }: { message: ChatMessage; onSend: (text: string, context?: unknown) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const streaming = message.status === "streaming";
  const onError = useCallback((items: OpenUIError[]) => {
    if (!streaming) setErrors(previous => {
      const next = items.map(item => item.message);
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [streaming]);
  function onAction(event: ActionEvent) {
    if (event.type === BuiltinActionType.ContinueConversation) {
      onSend(event.humanFriendlyMessage || "선택한 내용을 이어서 설명해줘", { form: event.formState, context: event.params?.context });
    } else if (event.type === BuiltinActionType.OpenUrl) {
      const url = webUrl(String(event.params?.url ?? ""));
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } else void runLibraryAction(event);
  }
  if (message.status === "error") return <p role="alert" className="error-notice">{message.content}</p>;
  return <div className="chat-ui" aria-label="Intelligent UI 응답">
    {errors.length > 0 && <p role="alert" className="error-notice">UI 렌더링 오류: {errors.join(" · ")}</p>}
    <RenderBoundary key={`${message.id}:${streaming}`} onFailure={() => setErrors(["UI 컴포넌트를 실행하지 못했습니다."])}>
      <Renderer response={message.content} library={library} isStreaming={streaming} onError={onError} onAction={onAction} />
    </RenderBoundary>
  </div>;
}
