"use server";

import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "brief",
  "build",
  "check",
  "create",
  "describe",
  "explain",
  "for",
  "from",
  "give",
  "how",
  "in",
  "investment",
  "latest",
  "of",
  "on",
  "or",
  "please",
  "show",
  "summarize",
  "summary",
  "tell",
  "the",
  "to",
  "using",
  "what",
]);

function buildDeterministicChatTitle(input: string) {
  const cleaned = input
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s&./-]+/gu, " ")
    .trim();

  if (!cleaned) {
    return "New chat";
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const selected = tokens
    .filter((token) => !TITLE_STOP_WORDS.has(token.toLowerCase()))
    .slice(0, 4);

  const title = (selected.length > 0 ? selected : tokens.slice(0, 4)).join(" ");

  return title.slice(0, 60).trim() || "New chat";
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  return buildDeterministicChatTitle(getTextFromMessage(message));
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisibilityById({ chatId, visibility });
}
