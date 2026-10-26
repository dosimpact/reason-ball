import {
  fetchLLM,
  agUIAdapter,
  openAIMessageFormat,
  restStorage,
  type ChatLLM,
} from "@openuidev/react-headless";
import { useDashboard } from "../model/store";

// AG-UI를 그대로 읽으며 요청의 소유 thread에만 snapshot/delta를 적용합니다.
const owners = new WeakMap<Response, string>();
const adapter = agUIAdapter();
const transport = fetchLLM({
  url: "/api/dashboard/chat",
  messageFormat: openAIMessageFormat,
  streamAdapter: adapter,
});
export const dashboardLLM: ChatLLM = {
  async send(params) {
    const response = await transport.send(params);
    owners.set(response, params.threadId);
    return response;
  },
  streamProtocol: {
    async *parse(response) {
      const threadId = owners.get(response);
      for await (const event of adapter.parse(response)) {
        if (threadId && event.type === "STATE_SNAPSHOT") {
          const snapshot = event.snapshot as { dashboard?: unknown };
          if (snapshot.dashboard)
            useDashboard.getState().accept(threadId, snapshot.dashboard);
        }
        if (threadId && event.type === "STATE_DELTA")
          for (const patch of event.delta) {
            if (patch.op === "replace" && patch.path === "/dashboard")
              useDashboard.getState().accept(threadId, patch.value);
          }
        yield event;
      }
    },
  },
};
export const dashboardStorage = restStorage({
  baseUrl: "/api/threads",
  messageFormat: openAIMessageFormat,
});
