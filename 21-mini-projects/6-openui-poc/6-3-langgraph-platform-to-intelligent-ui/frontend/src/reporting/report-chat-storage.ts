import { localChatStorage } from "@/lib/chat-storage";
import { continuousVendorReport } from "./continuous-report";

/** Read-time upgrade: no provider call, no bulk rewrite, unrelated conversations stay untouched. */
export function reportChatStorage(): ReturnType<typeof localChatStorage> {
  const storage = localChatStorage();
  return { ...storage, thread: { ...storage.thread,
    async getMessages(id) {
      const messages = await storage.thread.getMessages(id);
      return messages.map((message) => message.role === "assistant" && typeof message.content === "string"
        ? { ...message, content: continuousVendorReport(message.content) } : message);
    },
  } };
}
