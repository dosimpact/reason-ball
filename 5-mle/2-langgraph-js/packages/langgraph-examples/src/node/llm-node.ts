import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant powered by OpenAI and LangGraph. Use the available tools when appropriate to provide accurate answers.";

export interface MessagesLikeState {
  messages: BaseMessage[];
}

export function makeCallModel(
  llm: BaseChatModel,
  options: {
    systemPrompt?: string;
    tools?: StructuredToolInterface[];
  } = {}
) {
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const bound = options.tools?.length && llm.bindTools ? llm.bindTools(options.tools) : llm;

  return async (state: MessagesLikeState) => {
    const system = new SystemMessage(systemPrompt);
    const response = await bound.invoke([system, ...state.messages]);
    return { messages: [response] };
  };
}
