import { storedMessagesToChat, type ChatMessage, type MessageResponseItem } from "@/entities/chat";
import { planChatRetry } from "./retry-plan";

export type EditCheckpoint = { sourceId: string; expectedTailId: string };
export type EditRequest = { requestId: string; parts: ChatMessage["parts"] };

export function editableParts(parts: ChatMessage["parts"]): ChatMessage["parts"] {
  const result = parts.map((part) => {
    if (part.type === "text") return { type: "text" as const, text: part.text };
    if (part.type === "file") return { type: "file" as const, url: part.url, mediaType: part.mediaType, ...(part.filename ? { filename: part.filename } : {}) };
    throw new Error("텍스트와 첨부 파일이 있는 사용자 메시지만 편집할 수 있어요.");
  });
  if (!result.some((part) => part.type === "text" && part.text.trim())) throw new Error("수정할 메시지 내용을 입력해 주세요.");
  return result;
}

export function captureEditCheckpoint(rows: readonly MessageResponseItem[], visible: readonly ChatMessage[], selectedId: string): EditCheckpoint {
  const stored = storedMessagesToChat(rows);
  const identities = (messages: readonly ChatMessage[]) => messages.map(({ id, role }) => ({ id, role }));
  if (rows.some((row) => row.status === "pending") || JSON.stringify(identities(stored)) !== JSON.stringify(identities(visible))) {
    throw new Error("저장된 대화가 현재 화면과 달라요. 대화를 새로 불러온 뒤 편집해 주세요.");
  }
  const source = rows.find((row) => row.role === "user" && (row.clientMessageId ?? row.id) === selectedId && row.status === "complete");
  const selected = visible.find((message) => message.id === selectedId && message.role === "user");
  const tail = rows.at(-1);
  if (!source || !selected || !tail || JSON.stringify(editableParts(source.parts)) !== JSON.stringify(editableParts(selected.parts))) {
    throw new Error("편집할 메시지가 변경되었거나 저장되지 않았어요. 대화를 새로 불러와 주세요.");
  }
  return { sourceId: source.id, expectedTailId: tail.id };
}

export function prepareEditRequest(previous: EditRequest | undefined, parts: ChatMessage["parts"], requestId: string): EditRequest {
  const normalized = editableParts(parts);
  return previous && JSON.stringify(previous.parts) === JSON.stringify(normalized)
    ? previous : { requestId, parts: normalized };
}

export function planEditedGeneration(rows: readonly MessageResponseItem[], userId: string) {
  const restored = storedMessagesToChat(rows);
  if (!restored.some((message) => message.role === "user" && message.id === userId)) {
    throw new Error("저장한 편집 메시지가 다시 변경됐어요. 새로 불러온 뒤 계속해 주세요.");
  }
  return planChatRetry(restored, restored, userId);
}
