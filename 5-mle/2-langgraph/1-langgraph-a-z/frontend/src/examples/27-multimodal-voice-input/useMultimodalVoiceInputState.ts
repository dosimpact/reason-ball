import * as R from "remeda";
import { useRef, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultPrompt, mergeVoiceEvents, normalizeKeyPhrases, normalizeMetadata, normalizeVoiceEvents, normalizeVoiceNotes, type AudioMetadata, type JsonRecord, type VoiceEvent, type VoiceNote } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useMultimodalVoiceInputState() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [audioMimeType, setAudioMimeType] = useState("");
  const [audioSize, setAudioSize] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcriptSource, setTranscriptSource] = useState("");
  const [transcriptConfidence, setTranscriptConfidence] = useState(0);
  const [keyPhrases, setKeyPhrases] = useState<string[]>([]);
  const [responseNotes, setResponseNotes] = useState<VoiceNote[]>([]);
  const [voiceEvents, setVoiceEvents] = useState<VoiceEvent[]>([]);
  const [answer, setAnswer] = useState("");
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetResultState() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setMetadata(null);
    setTranscript("");
    setTranscriptSource("");
    setTranscriptConfidence(0);
    setKeyPhrases([]);
    setResponseNotes([]);
    setVoiceEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function resetView() {
    resetResultState();
    setAudioDataUrl("");
    setAudioName("");
    setAudioMimeType("");
    setAudioSize(0);
    setAudioDurationMs(0);
    setValidationError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setAudioPayload(dataUrl: string, name: string, mimeType: string, size: number, durationMs: number) {
    setAudioDataUrl(dataUrl);
    setAudioName(name);
    setAudioMimeType(mimeType);
    setAudioSize(size);
    setAudioDurationMs(durationMs);
    setValidationError("");
    resetResultState();
  }

  function applyValues(values: JsonRecord) {
    if (R.isPlainObject(values.audio_metadata)) setMetadata(normalizeMetadata(values.audio_metadata));
    if (R.isString(values.transcript)) setTranscript(values.transcript);
    if (R.isString(values.transcript_source)) setTranscriptSource(values.transcript_source);
    if (typeof values.transcript_confidence === "number") setTranscriptConfidence(values.transcript_confidence);
    if (R.isArray(values.key_phrases)) setKeyPhrases(normalizeKeyPhrases(values.key_phrases));
    if (R.isArray(values.response_notes)) setResponseNotes(normalizeVoiceNotes(values.response_notes));
    if (R.isArray(values.voice_events)) {
      setVoiceEvents((current) => mergeVoiceEvents(current, normalizeVoiceEvents(values.voice_events)));
    }
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "27_multimodal_voice_input") return;
    setVoiceEvents((current) => mergeVoiceEvents(current, normalizeVoiceEvents([data])));
  }

  const displayedMetadata = metadata ?? {
    name: audioName || "none",
    mimeType: audioMimeType || "unknown",
    size: audioSize,
    durationMs: audioDurationMs,
    source: audioDataUrl ? "browser-selected" : "none",
  };

  function startRun() {
    setBusy(true);
    setError("");
    setEvents([]);
    setTranscript("");
    setTranscriptSource("");
    setTranscriptConfidence(0);
    setKeyPhrases([]);
    setResponseNotes([]);
    setVoiceEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating voice analysis thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("Run failed");
    setFinalStatus("failed");
  }

  return {
    prompt,
    setPrompt,
    audioDataUrl,
    audioName,
    audioMimeType,
    audioSize,
    audioDurationMs,
    validationError,
    setValidationError,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    transcript,
    transcriptSource,
    transcriptConfidence,
    keyPhrases,
    responseNotes,
    voiceEvents,
    answer,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    fileInputRef,
    resetView,
    setAudioPayload,
    applyValues,
    applyCustomEvent,
    displayedMetadata,
    startRun,
    failRun,
  };
}
