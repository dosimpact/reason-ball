import { AudioLines, Loader2, Mic2, Play, RotateCcw, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { sampleVoiceDataUrl, sampleVoiceInput } from "./sampleAudio";

const defaultPrompt =
  "Summarize the voice input, preserve important keywords, and explain what the speaker asked for.";
const alternatePrompt =
  "Extract the transcript, key phrases, audio metadata, and a concise final response for a reviewer.";
const maxAudioBytes = 5_000_000;
const supportedAudioTypes = [
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
];

type JsonRecord = Record<string, unknown>;

type AudioMetadata = {
  name: string;
  mimeType: string;
  size: number;
  durationMs: number;
  source: string;
};

type VoiceEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

type VoiceNote = {
  label: string;
  detail: string;
  confidence: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function seconds(ms: number) {
  if (!ms) return "unknown";
  return `${(ms / 1000).toFixed(1)} seconds`;
}

function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if ((key === "data_url" || key === "audio_data_url") && typeof child === "string" && child.startsWith("data:audio")) {
        return `[audio data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

function normalizeMetadata(value: unknown): AudioMetadata | null {
  if (!isRecord(value)) return null;
  return {
    name: typeof value.name === "string" ? value.name : "audio",
    mimeType: typeof value.mime_type === "string" ? value.mime_type : "",
    size: numberValue(value.size),
    durationMs: numberValue(value.duration_ms),
    source: typeof value.source === "string" ? value.source : "",
  };
}

function normalizeVoiceEvents(value: unknown): VoiceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "multimodal_voice_input",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function normalizeVoiceNotes(value: unknown): VoiceNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((note) => ({
    label: typeof note.label === "string" ? note.label : "Note",
    detail: typeof note.detail === "string" ? note.detail : "",
    confidence: numberValue(note.confidence),
  }));
}

function normalizeKeyPhrases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mergeVoiceEvents(current: VoiceEvent[], next: VoiceEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio file."));
    reader.readAsDataURL(file);
  });
}

function readAudioDurationMs(dataUrl: string) {
  return new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
    audio.onerror = () => resolve(0);
    audio.src = dataUrl;
  });
}

export function MultimodalVoiceInputExample() {
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

  const client = useMemo(() => createLangGraphClient(), []);

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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

  function useSampleAudio() {
    setAudioPayload(
      sampleVoiceDataUrl(),
      sampleVoiceInput.name,
      sampleVoiceInput.mimeType,
      base64ByteLength(sampleVoiceInput.base64),
      sampleVoiceInput.durationMs,
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function applyValues(values: JsonRecord) {
    if (isRecord(values.audio_metadata)) setMetadata(normalizeMetadata(values.audio_metadata));
    if (typeof values.transcript === "string") setTranscript(values.transcript);
    if (typeof values.transcript_source === "string") setTranscriptSource(values.transcript_source);
    if (typeof values.transcript_confidence === "number") setTranscriptConfidence(values.transcript_confidence);
    if (Array.isArray(values.key_phrases)) setKeyPhrases(normalizeKeyPhrases(values.key_phrases));
    if (Array.isArray(values.response_notes)) setResponseNotes(normalizeVoiceNotes(values.response_notes));
    if (Array.isArray(values.voice_events)) {
      setVoiceEvents((current) => mergeVoiceEvents(current, normalizeVoiceEvents(values.voice_events)));
    }
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "multimodal_voice_input") return;
    setVoiceEvents((current) => mergeVoiceEvents(current, normalizeVoiceEvents([data])));
  }

  async function runVoiceAnalysis(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || !audioDataUrl) return;

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
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  const displayedMetadata = metadata ?? {
    name: audioName || "none",
    mimeType: audioMimeType || "unknown",
    size: audioSize,
    durationMs: audioDurationMs,
    source: audioDataUrl ? "browser-selected" : "none",
  };

  return (
    <section className="voice-input-layout">
      <aside className="voice-input-control">
        <div className="panel-title">
          <Mic2 aria-hidden="true" size={18} />
          Voice Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={useSampleAudio} disabled={busy}>
            <AudioLines size={16} />
            Use sample audio
          </button>
          <button type="button" className="secondary-button" onClick={() => setPrompt(alternatePrompt)} disabled={busy}>
            <Upload size={16} />
            Use metadata prompt
          </button>
        </div>
        <form className="run-form" onSubmit={runVoiceAnalysis}>
          <label className="field">
            <span>Audio file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/aac,audio/flac,audio/m4a,audio/mp4,audio/mpeg,audio/mp3,audio/mpga,audio/ogg,audio/wav,audio/webm"
              onChange={handleFileChange}
            />
          </label>
          <label className="field">
            <span>Voice prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim() || !audioDataUrl}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run voice analysis
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread ID</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Audio</span>
            <strong>{audioName || "none"}</strong>
          </div>
        </div>
        {validationError ? <p className="error-line">{validationError}</p> : null}
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`voice-status-panel ${finalStatus}`} role="region" aria-label="Voice Analysis Status">
        <div className="panel-title">Voice Analysis Status</div>
        <div className="voice-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Transcript</span>
            <strong>{transcript ? "ready" : "pending"}</strong>
          </div>
          <div>
            <span>Key Phrases</span>
            <strong>{keyPhrases.length}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{voiceEvents.length}</strong>
          </div>
        </div>
      </div>

      <div className="audio-preview-panel" role="region" aria-label="Audio Preview">
        <div className="panel-title">Audio Preview</div>
        {audioDataUrl ? (
          <div className="audio-preview-frame">
            <audio controls src={audioDataUrl} />
            <div className="audio-waveform" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <span key={index} style={{ height: `${22 + ((index * 17) % 42)}px` }} />
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">Upload audio or use the sample voice note before running the graph.</p>
        )}
      </div>

      <div className="audio-metadata-panel" role="region" aria-label="Audio Metadata">
        <div className="panel-title">Audio Metadata</div>
        <div className="audio-metadata-grid">
          <div>
            <span>Name</span>
            <strong>{displayedMetadata.name}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{displayedMetadata.mimeType}</strong>
          </div>
          <div>
            <span>Size</span>
            <strong>{displayedMetadata.size} bytes</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{seconds(displayedMetadata.durationMs)}</strong>
          </div>
        </div>
      </div>

      <div className="transcription-preview-panel" role="region" aria-label="Transcription Preview">
        <div className="panel-title">Transcription Preview</div>
        <div className="answer-box compact-answer">{transcript || "Pending"}</div>
        {transcript ? (
          <div className="transcript-facts">
            <span>source {transcriptSource || "pending"}</span>
            <span>confidence {percent(transcriptConfidence)}%</span>
          </div>
        ) : null}
        {keyPhrases.length > 0 ? (
          <div className="key-phrase-list">
            {keyPhrases.map((phrase) => (
              <code key={phrase}>{phrase}</code>
            ))}
          </div>
        ) : null}
      </div>

      <div className="voice-response-panel" role="region" aria-label="Voice Response">
        <div className="panel-title">Voice Response</div>
        <div className="answer-box compact-answer">{final || answer || "No response yet."}</div>
        <div className="voice-note-list">
          {responseNotes.map((note) => (
            <article key={note.label} className="voice-note-card">
              <strong>{note.label}</strong>
              <p>{note.detail}</p>
              <span>confidence {percent(note.confidence)}%</span>
            </article>
          ))}
        </div>
      </div>

      <div className="voice-events-panel" role="region" aria-label="Voice Events">
        <div className="panel-title">Voice Events</div>
        <div className="voice-event-list">
          {voiceEvents.length === 0 ? (
            <p className="muted">Voice stream events appear after the run.</p>
          ) : (
            voiceEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="voice-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel voice-input-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel" role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>event {entry.event}</strong>
                </summary>
                <pre>{formatJson(entry.data)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
