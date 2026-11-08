import * as R from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultInstructions, defaultPrompt, mergeAudioEvents, normalizeAudioEvents, normalizeAudioOutput, normalizeSpeechSettings, type AudioEvent, type AudioOutput, type JsonRecord, type SpeechSettings } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useMultimodalVoiceOutputState() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [voice, setVoice] = useState("coral");
  const [responseFormat, setResponseFormat] = useState("mp3");
  const [speechInstructions, setSpeechInstructions] = useState(defaultInstructions);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [textAnswer, setTextAnswer] = useState("");
  const [audioOutput, setAudioOutput] = useState<AudioOutput | null>(null);
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings | null>(null);
  const [audioEvents, setAudioEvents] = useState<AudioEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function resetResultState() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setTextAnswer("");
    setAudioOutput(null);
    setSpeechSettings(null);
    setAudioEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (R.isString(values.text_answer)) setTextAnswer(values.text_answer);
    if (R.isPlainObject(values.audio_output)) setAudioOutput(normalizeAudioOutput(values.audio_output));
    if (R.isPlainObject(values.speech_settings)) setSpeechSettings(normalizeSpeechSettings(values.speech_settings));
    if (R.isArray(values.audio_events)) {
      setAudioEvents((current) => mergeAudioEvents(current, normalizeAudioEvents(values.audio_events)));
    }
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "28_multimodal_voice_output") return;
    setAudioEvents((current) => mergeAudioEvents(current, normalizeAudioEvents([data])));
  }

  const effectiveSettings = speechSettings ?? {
    voice,
    responseFormat,
    instructions: speechInstructions,
    model: "gpt-4o-mini-tts",
  };

  function startRun() {
    setBusy(true);
    setError("");
    setEvents([]);
    setTextAnswer("");
    setAudioOutput(null);
    setSpeechSettings(null);
    setAudioEvents([]);
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating voice output thread");
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("Run failed");
    setFinalStatus("failed");
  }

  return {
    prompt,
    setPrompt,
    voice,
    setVoice,
    responseFormat,
    setResponseFormat,
    speechInstructions,
    setSpeechInstructions,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    textAnswer,
    audioOutput,
    audioEvents,
    final,
    finalState,
    events,
    setEvents,
    error,
    busy,
    setBusy,
    resetResultState,
    applyValues,
    applyCustomEvent,
    effectiveSettings,
    startRun,
    failRun,
  };
}
