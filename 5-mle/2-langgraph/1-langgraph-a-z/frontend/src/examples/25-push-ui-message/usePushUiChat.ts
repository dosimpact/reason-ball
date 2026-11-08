import * as R from "remeda";
import { useMemo } from "react";
import { type ChatMessageRecord, createClientId, createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";
import { usePushUiChatState } from "./usePushUiChatState";
import { assistantDelta, nodeUpdates } from "./stream";

// thread 재사용, 서버 요청과 스트림 처리 흐름을 관리합니다.
export function usePushUiChat() {
  const client = useMemo(() => createLangGraphClient(), []);
  const {
    input, setInput,
    threadId, setThreadId,
    messages, uiMessages,
    status, busy, error,
    events, finalState,
    startTurn, completeTurn, failTurn, resetChat,
    applyValues, appendEvent, applyCustomEvent, appendAssistantDelta,
  } = usePushUiChatState();

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt || busy) return;

    const human: ChatMessageRecord = {
      id: createClientId("user"),
      role: "human",
      content: prompt,
    };

    startTurn(human);

    try {
      // 첫 요청에서만 thread를 만들고, 이후 대화는 같은 thread를 재사용합니다.
      let activeThread = threadId;
      if (!activeThread) {
        const thread = await client.threads.create({
          metadata: { example: "25-push-ui-message" },
        });
        activeThread = String(thread.thread_id);
        setThreadId(activeThread);
      }

      const stream = await client.runs.stream(activeThread, "25_push_ui_message_example", {
        input: { messages: [{ id: human.id, role: "user", content: prompt }] },
        streamMode: ["messages-tuple", "updates", "custom"] as ["messages-tuple", "updates", "custom"],
      });

      // messages-tuple의 수신 이벤트 이름은 messages입니다. custom은 UI, updates는 노드 상태입니다.
      for await (const chunk of stream) {
        const entry = normalizeStreamChunk(chunk);
        appendEvent(entry); // 로그 저장

        // 이벤트 종류별 처리
        if (entry.event === "error") {
          throw new Error(JSON.stringify(entry.data));
        }
        if (entry.event === "custom") {
          applyCustomEvent(entry.data);
          continue;
        }
        if (entry.event === "messages") {
          const delta = assistantDelta(entry.data);
          if (delta) appendAssistantDelta(delta.id, delta.text);
          continue;
        }
        if (entry.event !== "updates") continue;

        for (const value of nodeUpdates(entry.data)) {
          applyValues(value);
        }
      }

      // 스트림을 모두 읽은 후 서버의 최종 상태로 대화 이력을 확정합니다.
      const state = await client.threads.getState(activeThread);
      const values = R.isPlainObject(state) && R.isPlainObject(state.values) ? state.values : {};
      completeTurn(values);
    } catch (caught) {
      failTurn(caught, prompt);
    }
  }

  return {
    input, setInput,
    threadId, messages, uiMessages,
    status, busy, error,
    events, finalState,
    sendMessage, resetChat,
  };
}
