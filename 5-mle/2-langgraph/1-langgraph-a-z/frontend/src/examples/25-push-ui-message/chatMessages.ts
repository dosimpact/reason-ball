import * as R from "remeda";
import { type ChatMessageRecord } from "../../lib/langgraphClient";
import { textContent } from "./stream";

export type DisplayStatus = "running" | "completed" | "failed";
// 화면 메시지의 유일한 상태: 서버 응답과 스트림 조각 모두 이 모델에 반영합니다.
export type ChatMessage = ChatMessageRecord & { status: DisplayStatus };
export type ChatMessageAction =
  | { type: "start"; message: ChatMessageRecord }
  | { type: "delta"; messageId: string; text: string }
  | { type: "server"; messages: readonly unknown[]; mode: "update" | "snapshot" }
  | { type: "fail" }
  | { type: "reset" };

function readMessage(value: unknown): ChatMessage | null {
  if (!R.isPlainObject(value) || !R.isString(value.id) || !value.id) return null;
  const type = value.type ?? value.role;
  let role: ChatMessageRecord["role"] = "unknown";
  if (type === "ai" || type === "AIMessageChunk" || type === "assistant") role = "ai";
  else if (type === "human" || type === "user") role = "human";
  else if (type === "system" || type === "tool") role = type;

  const content = textContent(value.content);
  const extra = R.isPlainObject(value.additional_kwargs) ? value.additional_kwargs : {};
  let status: DisplayStatus = "completed";
  if (role === "ai") {
    const turnStatus = extra.turn_status;
    status = turnStatus === "running" || turnStatus === "completed" || turnStatus === "failed"
      ? turnStatus
      : content ? "completed" : "running";
  }
  return { id: value.id, role, content, status };
}

function reconcileMessage(message: ChatMessage, previous?: ChatMessage): ChatMessage {
  if (message.role !== "ai" || previous?.role !== "ai") return message;
  // 늦은 placeholder는 이미 확정하거나 실패한 답변을 되돌리지 않습니다.
  if (message.status === "running" && previous.status !== "running") return previous;
  // 빈 진행/실패 placeholder는 이미 받은 텍스트를 지우지 않습니다.
  if (!message.content && message.status !== "completed") {
    return { ...message, content: previous.content };
  }
  // 서버 최종 응답은 누적하지 않고 전체 내용으로 교체합니다.
  return message;
}

export function chatMessagesReducer(current: ChatMessage[], action: ChatMessageAction): ChatMessage[] {
  switch (action.type) {
    case "reset":
      return [];
    case "start":
      return [...current, { ...action.message, status: "running" }];
    case "fail":
      return current.map((message) => message.status === "running"
        ? { ...message, status: "failed" }
        : message);
    case "delta": {
      if (!action.messageId || !action.text) return current;
      const previous = current.find((message) => message.id === action.messageId);
      if (!previous) {
        return [...current, {
          id: action.messageId, role: "ai", content: action.text, status: "running",
        }];
      }
      // 완료/실패 후 조각과 다른 역할의 메시지에는 텍스트를 붙이지 않습니다.
      if (previous.role !== "ai" || previous.status !== "running") return current;
      return current.map((message) => message.id === action.messageId
        ? { ...message, content: message.content + action.text }
        : message);
    }
    case "server": {
      const previous = new Map(current.map((message) => [message.id, message]));
      const merged = action.mode === "snapshot"
        ? new Map<string, ChatMessage>()
        : new Map(previous);
      for (const raw of action.messages) {
        const message = readMessage(raw);
        if (message) merged.set(message.id, reconcileMessage(message, merged.get(message.id) ?? previous.get(message.id)));
      }
      const result = [...merged.values()];
      if (action.mode === "snapshot") {
        // 아직 저장되지 않은 입력과 부분 답변은 기존 위치에 남겨 대화 순서를 유지합니다.
        current.forEach((message, index) => {
          if (!merged.has(message.id) && message.status !== "completed") {
            result.splice(index, 0, message);
          }
        });
      }
      return result;
    }
  }
}
