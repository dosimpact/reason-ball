import type { ChatConversation, CreateConversationInput } from "../model/types";

const STORAGE_KEY = "lingua-chat-parity-v1";
const CHANGE_EVENT = "lingua-chat-conversations-changed";

type ChatStore = {
  activeByRoute: Record<string, string>;
  conversations: ChatConversation[];
  deletedConversationIds: string[];
};

const emptyStore: ChatStore = { activeByRoute: {}, conversations: [], deletedConversationIds: [] };

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): ChatStore {
  if (!canUseStorage()) return emptyStore;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ChatStore> | null;
    return {
      activeByRoute: value?.activeByRoute ?? {},
      conversations: Array.isArray(value?.conversations) ? value.conversations : [],
      deletedConversationIds: Array.isArray(value?.deletedConversationIds) ? value.deletedConversationIds : [],
    };
  } catch {
    return emptyStore;
  }
}

function writeStore(store: ChatStore) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function makeId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function create(input: CreateConversationInput): ChatConversation {
  const now = new Date().toISOString();
  return {
    ...input,
    artifacts: [],
    createdAt: now,
    draft: "",
    id: makeId("conversation"),
    modelId: "gpt-5.6-terra",
    theme: "light",
    updatedAt: now,
    votes: {},
  };
}

export const mockChatRepository = {
  createConversation(input: CreateConversationInput) {
    const store = readStore();
    const conversation = create(input);
    writeStore({
      activeByRoute: { ...store.activeByRoute, [input.routeKey]: conversation.id },
      conversations: [conversation, ...store.conversations],
      deletedConversationIds: store.deletedConversationIds.filter((id) => id !== conversation.id),
    });
    return conversation;
  },

  deleteConversation(id: string) {
    const store = readStore();
    const activeByRoute = Object.fromEntries(
      Object.entries(store.activeByRoute).filter(([, conversationId]) => conversationId !== id),
    );
    writeStore({ activeByRoute, conversations: store.conversations.filter((item) => item.id !== id), deletedConversationIds: [...new Set([...store.deletedConversationIds, id])] });
  },

  findByShareToken(token: string) {
    return readStore().conversations.find((item) => item.shareToken === token);
  },

  getConversation(id: string) {
    return readStore().conversations.find((item) => item.id === id);
  },

  getOrCreateActiveConversation(input: CreateConversationInput, requestedId?: string) {
    const store = readStore();
    if (requestedId) {
      const requested = store.conversations.find((item) => item.id === requestedId);
      if (requested && requested.routeKey === input.routeKey) return requested;
    }
    const activeId = store.activeByRoute[input.routeKey];
    const active = store.conversations.find((item) => item.id === activeId);
    return active ?? this.createConversation(input);
  },

  listConversations() {
    return [...readStore().conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  listDeletedConversationIds() {
    return [...readStore().deletedConversationIds];
  },

  purgeConversations() {
    const store = readStore();
    writeStore({ activeByRoute: {}, conversations: [], deletedConversationIds: [...new Set([...store.deletedConversationIds, ...store.conversations.map((item) => item.id)])] });
  },

  shareConversation(id: string) {
    const existing = this.getConversation(id);
    if (!existing) return undefined;
    if (existing.shareToken) return existing.shareToken;
    const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const token = `${existing.characterId}-${random.replaceAll("-", "").slice(0, 16)}`;
    this.updateConversation(id, { shareToken: token });
    return token;
  },

  subscribe(listener: () => void) {
    if (!canUseStorage()) return () => undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) listener();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CHANGE_EVENT, listener);
    };
  },

  updateConversation(id: string, patch: Partial<Omit<ChatConversation, "id" | "createdAt">>) {
    const store = readStore();
    let updated: ChatConversation | undefined;
    const conversations = store.conversations.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, ...patch, updatedAt: new Date().toISOString() };
      return updated;
    });
    if (updated) writeStore({ ...store, conversations });
    return updated;
  },
};
