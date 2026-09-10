const prefix = "persona-chat-draft-v1:";
const recoveryPrefixes = [prefix, "persona-chat-outbox-v1:"];
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function draftKey(ownerId: string, conversationId: string): string {
  if (!ownerId || !conversationId) throw new Error("초안의 사용자와 대화를 확인하지 못했어요.");
  return `${prefix}${encodeURIComponent(ownerId)}:${encodeURIComponent(conversationId)}`;
}

export function decodeDraft(raw: string | null): string {
  if (raw === null) return "";
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
    || !("text" in value) || typeof value.text !== "string" || value.text.length > 32_000) {
    throw new Error("저장된 초안을 읽지 못했어요.");
  }
  return value.text;
}

export function createDraftStorage(storage: DraftStorage) {
  return {
    read(ownerId: string, conversationId: string) {
      return decodeDraft(storage.getItem(draftKey(ownerId, conversationId)));
    },
    write(ownerId: string, conversationId: string, text: string) {
      if (text.length > 32_000) throw new Error("초안은 32,000자까지 보존할 수 있어요.");
      const key = draftKey(ownerId, conversationId);
      if (text === "") storage.removeItem(key);
      else storage.setItem(key, JSON.stringify({ version: 1, text }));
    },
    clearOwner(ownerId: string) {
      if (!ownerId) throw new Error("초안의 사용자를 확인하지 못했어요.");
      const ownerPrefixes = recoveryPrefixes.map((value) => `${value}${encodeURIComponent(ownerId)}:`);
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) if (key && ownerPrefixes.some((value) => key.startsWith(value))) storage.removeItem(key);
    },
    clearAll() {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) if (key && recoveryPrefixes.some((value) => key.startsWith(value))) storage.removeItem(key);
    },
  };
}
