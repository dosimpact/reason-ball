/**
 * Example 35: agentic chat flow using LangGraph with AG-UI middleware.
 *
 * The AG-UI middleware handles frontend tool injection and frontend tool-call
 * routing. Export the inner graph so managed checkpointer injection applies
 * directly on LangGraph Platform.
 */

import { createAgent } from "langchain";
import { copilotkitMiddleware } from "@copilotkit/sdk-js/langgraph";

const agenticChatAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [],
  middleware: [copilotkitMiddleware],
  systemPrompt: "You are a helpful assistant.",
});

export const agenticChatGraph = agenticChatAgent.graph;
