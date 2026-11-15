export type ChatRuntime = {
  id: "development" | "fastapi";
  label: string;
  apiUrl: string;
  chartEndpoint: string;
};
export const developmentChatRuntime: ChatRuntime = { id: "development", label: "LangGraph 개발 채팅", apiUrl: "/api/langgraph-runtime", chartEndpoint: "/api/langgraph-runtime/technical-analysis/chart" };
export const fastApiChatRuntime: ChatRuntime = { id: "fastapi", label: "FastAPI 채팅", apiUrl: "/api/fastapi-langgraph", chartEndpoint: "/api/fastapi-langgraph/technical-analysis/chart" };
