import { isArray, isString } from "remeda";
import { useReducer, useState } from "react";
import { type ChatMessageRecord, type StreamLogEntry } from "../../lib/langgraphClient";
import { chatMessagesReducer } from "./chatMessages";
import { type UIMessage, applyUiMessages, failRunningProgress } from "./uiMessages";
import { type JsonRecord } from "./stream";

// 채팅 상태와 상태 전환을 관리합니다. 서버 요청은 usePushUiChat에서 수행합니다.
export function usePushUiChatState() {
  const [input, setInput] = useState("LangGraph의 push_ui_message를 간단히 설명해줘.");
  const [threadId, setThreadId] = useState("");

  const [messages, dispatchMessages] = useReducer(chatMessagesReducer, []);
  const [uiMessages, setUiMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const busy = status === "running";
  const [error, setError] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);

  // 노드 업데이트와 실행 종료 후 서버 상태에 같은 병합 규칙을 적용합니다.
  function applyValues(values: JsonRecord, mode: "update" | "snapshot" = "update") {
    if (isArray(values.messages)) {
      dispatchMessages({ type: "server", messages: values.messages, mode });
    }
    if (isArray(values.ui)) {
      applyUiEvents(values.ui);
    }
    if (isString(values.error) && values.error) {
      setError(values.error);
    }
  }

  function resetChat() {
    setThreadId("");
    dispatchMessages({ type: "reset" });
    setUiMessages([]);
    setEvents([]);
    setFinalState(null);
    setError("");
    setStatus("idle");
  }

  function startTurn(human: ChatMessageRecord) {
    setError("");
    setStatus("running");
    setInput("");
    setEvents([]);
    setFinalState(null);
    dispatchMessages({ type: "start", message: human });
  }

  function completeTurn(values: JsonRecord) {
    applyValues(values, "snapshot");
    setFinalState(values);

    if ((isString(values.final_status) && values.final_status !== "completed") || (isString(values.error) && values.error)) {
      throw new Error(String(values.error || "최종 응답이 완료되지 않았습니다."));
    }
    setStatus("completed");
  }

  function failTurn(caught: unknown, prompt: string) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("failed");
    setInput(prompt);
    dispatchMessages({ type: "fail" });
    setUiMessages(failRunningProgress);
  }

  function appendEvent(entry: StreamLogEntry) {
    setEvents((current) => [entry, ...current].slice(0, 160));
  }

  function applyUiEvents(incoming: readonly unknown[]) {
    setUiMessages((current) => applyUiMessages(current, incoming));
  }

  function applyCustomEvent(data: unknown) {
    applyUiEvents([data]);
  }

  function appendAssistantDelta(messageId: string, delta: string) {
    if (!messageId || !delta) return;
    dispatchMessages({ type: "delta", messageId, text: delta });
  }

  return {
    input, setInput,
    threadId, setThreadId,
    messages, uiMessages,
    status, busy, error,
    events, finalState,
    startTurn, completeTurn, failTurn, resetChat,
    applyValues, appendEvent, applyCustomEvent, appendAssistantDelta,
  };
}
