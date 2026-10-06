import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";
import { sampleVoiceDataUrl, sampleVoiceInput } from "./sampleAudio";

import { readAudioDurationMs, readFileAsDataUrl } from "./media";
import { base64ByteLength, maxAudioBytes, nodePayloads, supportedAudioTypes, valuesOf } from "./model";

import { useMultimodalVoiceInputState } from "./useMultimodalVoiceInputState";

// SDK requests, browser input preparation, and stream consumption.
export function useMultimodalVoiceInput() {
  const state = useMultimodalVoiceInputState();
  const {
    prompt,
    audioDataUrl,
    audioName,
    audioMimeType,
    audioSize,
    audioDurationMs,
    setValidationError,
    setThreadId,
    setStatus,
    setEvents,
    setBusy,
    fileInputRef,
    setAudioPayload,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    if (!supportedAudioTypes.includes(file.type)) {
      setValidationError("Use WAV, MP3, M4A, OGG, FLAC, AAC, or WebM audio.");
      return;
    }
    if (file.size > maxAudioBytes) {
      setValidationError("Audio is too large for this example.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const durationMs = await readAudioDurationMs(dataUrl);
    setAudioPayload(dataUrl, file.name, file.type, file.size, durationMs);
  }

  function loadSampleAudio() {
    setAudioPayload(
      sampleVoiceDataUrl(),
      sampleVoiceInput.name,
      sampleVoiceInput.mimeType,
      base64ByteLength(sampleVoiceInput.base64),
      sampleVoiceInput.durationMs,
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runVoiceAnalysis() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || !audioDataUrl) return;

    startRun();

    try {
      const thread = await client.threads.create({
        metadata: { example: "27-multimodal-voice-input" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming voice analysis");

      const stream = await client.runs.stream(nextThreadId, "27_multimodal_voice_input", {
        input: {
          prompt: trimmedPrompt,
          audio: {
            data_url: audioDataUrl,
            name: audioName,
            mime_type: audioMimeType,
            size: audioSize,
            duration_ms: audioDurationMs,
          },
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
    audioDataUrl,
    audioName,
    validationError: state.validationError,
    threadId: state.threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    transcript: state.transcript,
    transcriptSource: state.transcriptSource,
    transcriptConfidence: state.transcriptConfidence,
    keyPhrases: state.keyPhrases,
    responseNotes: state.responseNotes,
    voiceEvents: state.voiceEvents,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    fileInputRef,
    resetView: state.resetView,
    displayedMetadata: state.displayedMetadata,
    handleFileChange,
    loadSampleAudio,
    runVoiceAnalysis,
  };
}
