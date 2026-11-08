import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { defaultInstructions, nodePayloads, valuesOf } from "./model";

import { useMultimodalVoiceOutputState } from "./useMultimodalVoiceOutputState";

// SDK requests, browser input preparation, and stream consumption.
export function useMultimodalVoiceOutput() {
  const state = useMultimodalVoiceOutputState();
  const {
    prompt,
    voice,
    responseFormat,
    speechInstructions,
    setThreadId,
    setStatus,
    setEvents,
    setBusy,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function runVoiceOutput() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    startRun();

    try {
      const thread = await client.threads.create({
        metadata: { example: "28-multimodal-voice-output" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming voice output");

      const stream = await client.runs.stream(nextThreadId, "28_multimodal_voice_output", {
        input: {
          prompt: trimmedPrompt,
          voice,
          response_format: responseFormat,
          speech_instructions: speechInstructions.trim() || defaultInstructions,
        },
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 160));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
    } catch (caught) {
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  return {
    prompt,
    setPrompt: state.setPrompt,
    voice,
    setVoice: state.setVoice,
    responseFormat,
    setResponseFormat: state.setResponseFormat,
    speechInstructions,
    setSpeechInstructions: state.setSpeechInstructions,
    threadId: state.threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    textAnswer: state.textAnswer,
    audioOutput: state.audioOutput,
    audioEvents: state.audioEvents,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    resetResultState: state.resetResultState,
    effectiveSettings: state.effectiveSettings,
    runVoiceOutput,
  };
}
