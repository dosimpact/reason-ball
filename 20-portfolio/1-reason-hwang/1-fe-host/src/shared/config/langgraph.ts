export type LangGraphConfig = {
  apiUrl: string;
  assistantId: string;
  streamMode: "messages-tuple" | "values";
};

export type LangGraphConfigResult =
  | {
      config: LangGraphConfig;
      error: null;
    }
  | {
      config: null;
      error: string;
    };

const defaultApiUrl = "http://localhost:8123";
const defaultAssistantId = "starter_graph";
const defaultStreamMode = "values";

export function getLangGraphConfig(): LangGraphConfigResult {
  const apiUrl =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL?.trim() || defaultApiUrl;
  const assistantId =
    process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID?.trim() ||
    defaultAssistantId;
  const streamMode =
    process.env.NEXT_PUBLIC_LANGGRAPH_STREAM_MODE?.trim() || defaultStreamMode;

  if (streamMode !== "messages-tuple" && streamMode !== "values") {
    return {
      config: null,
      error: "NEXT_PUBLIC_LANGGRAPH_STREAM_MODE must be messages-tuple or values.",
    };
  }

  return {
    config: {
      apiUrl,
      assistantId,
      streamMode: streamMode,
    },
    error: null,
  };
}
