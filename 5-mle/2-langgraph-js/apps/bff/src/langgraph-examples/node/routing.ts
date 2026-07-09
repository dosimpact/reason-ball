import type { AIMessage } from "@langchain/core/messages";
import type { MessagesLikeState } from "./llm-node.js";

export function shouldContinue(state: MessagesLikeState): "tools" | "__end__" {
  const lastMessage = state.messages.at(-1) as AIMessage | undefined;
  if (lastMessage?.tool_calls?.length) {
    return "tools";
  }
  return "__end__";
}
