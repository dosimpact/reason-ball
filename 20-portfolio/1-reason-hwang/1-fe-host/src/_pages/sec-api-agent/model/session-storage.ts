import type { ChatStorage, Message, Thread } from "@openuidev/react-ui";

/** Page-lifetime storage: switching chats keeps responses; reload clears them. */
export function createSessionStorage() {
  const threads = new Map<string, Thread>();
  const messages = new Map<string, Message[]>();
  const storage: ChatStorage = {
    thread: {
      async listThreads() { return { threads: [...threads.values()].reverse() }; },
      async createThread(firstMessage) {
        const thread = { id: crypto.randomUUID(), title: typeof firstMessage.content === "string" ? firstMessage.content.slice(0, 100) : "새 대화", createdAt: Date.now() };
        threads.set(thread.id, thread);
        messages.set(thread.id, [firstMessage]);
        return thread;
      },
      async getMessages(id) { return messages.get(id) ?? []; },
      async updateThread(thread) { threads.set(thread.id, thread); return thread; },
      async deleteThread(id) { threads.delete(id); messages.delete(id); },
    },
  };
  return { storage, save: (id: string, value: Message[]) => { if (threads.has(id)) messages.set(id, value); } };
}
