import { conversationFromHttp, voteFromHttp, type ConversationResponseItem, type MessageResponseItem } from "../model/http-conversation";
import type { CreateConversationInput } from "../model/types";
import type { ChatMessage } from '../model/types';
import { persistChatFiles } from '../model/attachment';
import { parseChatModelEntries, type ChatModelEntry } from '@/shared/api/ai/model-catalog';

type FetchJson = (url: string, init?: RequestInit) => Promise<Response>;

export class ChatRepositoryError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "ChatRepositoryError";
  }
}

export function createHttpChatRepository(fetchJson: FetchJson = (url, init) => fetch(url, init)) {
  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetchJson(url, {
      ...init,
      cache: "no-store",
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ChatRepositoryError(payload?.error?.message ?? "대화 요청을 처리하지 못했어요. 다시 시도해 주세요.", payload?.error?.code ?? "CHAT_REQUEST_FAILED", response.status);
    }
    if (!payload) throw new Error("서버의 대화 응답을 읽지 못했어요.");
    return payload as T;
  }

  async function getMessages(id: string): Promise<MessageResponseItem[]> {
    const messages: MessageResponseItem[] = [];
    let after = 0;
    while (true) {
      const page = await request<{ items: MessageResponseItem[]; hasMore: boolean }>(
        `/api/conversations/${encodeURIComponent(id)}/messages?limit=200&after=${after}`,
      );
      if (!Array.isArray(page.items)) throw new Error("메시지 목록을 읽지 못했어요.");
      messages.push(...page.items);
      if (!page.hasMore) return messages;
      const next = page.items.at(-1)?.sequenceNumber;
      if (!next || next <= after) throw new Error("이전 메시지의 다음 페이지를 확인하지 못했어요.");
      after = next;
    }
  }

  return {
    getMessages,
    async persistAttachments(id: string, parts: ChatMessage['parts']): Promise<ChatMessage['parts']> {
      return persistChatFiles(parts, id, async (file) => {
        const response = await request<{ file: unknown }>(`/api/conversations/${encodeURIComponent(id)}/attachments`, {
          method: 'POST', body: JSON.stringify({ dataUrl: file.url, filename: file.filename ?? 'attachment' }),
        });
        return response.file;
      });
    },
    async getModels(): Promise<ChatModelEntry[]> {
      const response = await request<{ items: unknown }>('/api/ai/models');
      try { return parseChatModelEntries(response.items); }
      catch { throw new Error('모델 목록을 읽지 못했어요.'); }
    },
    async prepareRegeneration(id: string, assistantId: string, requestId: string) {
      const response = await request<{ item: MessageResponseItem }>(`/api/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(assistantId)}/regenerate`, {
        method: "POST", body: JSON.stringify({ requestId }),
      });
      return response.item;
    },
    async replaceMessageBranch(id: string, sourceId: string, expectedTailId: string, requestId: string, parts: MessageResponseItem["parts"]) {
      const response = await request<{ item: MessageResponseItem }>(`/api/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(sourceId)}`, {
        method: "PATCH", body: JSON.stringify({ requestId, expectedTailId, parts }),
      });
      return response.item;
    },
    async getConversation(id: string, context: CreateConversationInput) {
      const response = await request<{ item: ConversationResponseItem }>(`/api/conversations/${encodeURIComponent(id)}`);
      const messages = await getMessages(id);
      return conversationFromHttp(response.item, messages, context);
    },
    async createConversation(context: CreateConversationInput, id: string) {
      const response = await request<{ item: ConversationResponseItem }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ id, characterId: context.characterId, missionId: context.missionId, title: context.title, titleMode: "auto" }),
      });
      // Creation can replay after a lost HTTP response; always restore its rows.
      return conversationFromHttp(response.item, await getMessages(response.item.id), context);
    },
    async getTitle(id: string) {
      const response = await request<{ item: ConversationResponseItem }>(`/api/conversations/${encodeURIComponent(id)}`);
      if (response.item?.id !== id || typeof response.item.title !== "string") throw new Error("저장된 제목을 확인하지 못했어요.");
      return response.item.title;
    },
    async renameConversation(id: string, title: string) {
      return request(`/api/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action: "update", title }) });
    },
    async setModel(id: string, modelId: string) {
      const response = await request<{ item: ConversationResponseItem }>(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ action: "update", modelId }),
      });
      if (response.item?.id !== id || response.item.modelId !== modelId) throw new Error("저장된 대화 모델을 확인하지 못했어요.");
      return response.item.modelId;
    },
    async shareConversation(id: string) {
      const response = await request<{ shareToken?: string }>(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ action: "update", visibility: "unlisted" }),
      });
      if (!response.shareToken) throw new Error("공유 링크를 확인하지 못했어요.");
      return response.shareToken;
    },
    async revokeShare(id: string) {
      const response = await request<{ item: { id: string; visibility: string } }>(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ action: "update", visibility: "private" }),
      });
      if (response.item?.id !== id || response.item.visibility !== "private") throw new Error("공유 취소 상태를 확인하지 못했어요. 다시 시도해 주세요.");
    },
    async deleteConversation(id: string) {
      return request(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async clearMessages(id: string, requestId: string) {
      await request(`/api/conversations/${encodeURIComponent(id)}/messages`, {
        method: "DELETE", body: JSON.stringify({ requestId, confirmation: "CLEAR MESSAGES" }),
      });
      // Another tab may have written since the clear commit. Restore the server
      // result instead of assuming that the conversation is still empty.
      return getMessages(id);
    },
    async purgeConversations(requestId: string, confirmation: string) {
      if (confirmation !== "DELETE ALL") throw new Error("모든 대화 삭제 확인 문구를 입력해 주세요.");
      return request("/api/conversations", { method: "DELETE", body: JSON.stringify({ requestId, confirmation }) });
    },
    async vote(messageId: string, value: "up" | "down" | undefined, reason?: string) {
      if (!value) {
        const response = await request<{ deleted: boolean }>(`/api/messages/${encodeURIComponent(messageId)}/vote`, { method: "DELETE" });
        if (!response.deleted) throw new Error("피드백 취소를 확인하지 못했어요.");
        return undefined;
      }
      const response = await request<{ vote: { message_id: string; rating: number; reason: string | null } }>(`/api/messages/${encodeURIComponent(messageId)}/vote`, { method: "POST", body: JSON.stringify({ rating: value === "up" ? 1 : -1, reason }) });
      if (response.vote?.message_id !== messageId) throw new Error("저장된 피드백의 메시지를 확인하지 못했어요.");
      return voteFromHttp(response.vote);
    },
  };
}

export const httpChatRepository = createHttpChatRepository();
