import type { Activity } from "../ui/ActivityTimeline";
import type { Evidence } from "../ui/EvidenceView";

export type Company = { cik: string; name: string; ticker: string };
export type Prepared = { threadId: string; filing: { accessionNo: string; filingDate: string }; checkedAt: string | null; missingItems: string[] };
export type Message = { role: "user" | "assistant"; text: string; program?: string; evidence?: Evidence; followUps?: string[]; activities?: Activity[] };
export type Choice = { companies: Company[]; question: string; refresh: boolean; pendingAction?: "research" | "collect"; years?: number; since?: string };
export type Conversation = { id: string; title: string; updatedAt: string; messages: Message[]; company?: Company; prepared?: Prepared; choice?: Choice };
export const HISTORY_KEY = "sec-chat-history-v1";
export function parseHistory(value: string | null): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Conversation => !!item && typeof item === "object" && typeof item.id === "string" && typeof item.title === "string" && typeof item.updatedAt === "string" && Array.isArray(item.messages) && item.messages.every((message: Message) => message && (message.role === "user" || message.role === "assistant") && typeof message.text === "string")).slice(0, 50);
  } catch { return []; }
}
export function saveHistory(storage: Storage, records: Conversation[]): void {
  storage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 50)));
}
