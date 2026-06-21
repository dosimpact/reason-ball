import { Download, Loader2, Play, RotateCcw, SlidersHorizontal, Volume2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultPrompt =
  "Create a short spoken update that explains why LangGraph SDK voice output is useful for product demos.";
const defaultInstructions = "Speak clearly, warmly, and at a measured pace.";
const voices = ["coral", "alloy", "nova", "sage", "shimmer", "echo", "onyx", "ash"];
const formats = ["mp3", "wav", "aac", "opus", "flac"];

type JsonRecord = Record<string, unknown>;

type AudioOutput = {
  dataUrl: string;
  mimeType: string;
  format: string;
  size: number;
  voice: string;
  model: string;
  filename: string;
};

type AudioEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

type SpeechSettings = {
  voice: string;
  responseFormat: string;
  instructions: string;
  model: string;
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

function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if (
        (key === "data_url" || key === "audio_data_url") &&
        typeof child === "string" &&
        child.startsWith("data:audio")
      ) {
        return `[audio data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

function normalizeAudioOutput(value: unknown): AudioOutput | null {
  if (!isRecord(value)) return null;
  return {
    dataUrl: typeof value.data_url === "string" ? value.data_url : "",
    mimeType: typeof value.mime_type === "string" ? value.mime_type : "",
    format: typeof value.format === "string" ? value.format : "",
    size: numberValue(value.size),
    voice: typeof value.voice === "string" ? value.voice : "",
    model: typeof value.model === "string" ? value.model : "",
    filename: typeof value.filename === "string" ? value.filename : "langgraph-voice-output.mp3",
  };
}

function normalizeAudioEvents(value: unknown): AudioEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "multimodal_voice_output",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function normalizeSpeechSettings(value: unknown): SpeechSettings | null {
  if (!isRecord(value)) return null;
  return {
    voice: typeof value.voice === "string" ? value.voice : "",
    responseFormat: typeof value.response_format === "string" ? value.response_format : "",
    instructions: typeof value.instructions === "string" ? value.instructions : "",
    model: typeof value.model === "string" ? value.model : "",
  };
}

function mergeAudioEvents(current: AudioEvent[], next: AudioEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MultimodalVoiceOutputExample() {
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

  const client = useMemo(() => createLangGraphClient(), []);

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
    if (typeof values.text_answer === "string") setTextAnswer(values.text_answer);
    if (isRecord(values.audio_output)) setAudioOutput(normalizeAudioOutput(values.audio_output));
    if (isRecord(values.speech_settings)) setSpeechSettings(normalizeSpeechSettings(values.speech_settings));
    if (Array.isArray(values.audio_events)) {
      setAudioEvents((current) => mergeAudioEvents(current, normalizeAudioEvents(values.audio_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "multimodal_voice_output") return;
    setAudioEvents((current) => mergeAudioEvents(current, normalizeAudioEvents([data])));
  }

  async function runVoiceOutput(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

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
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
      setFinalStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  const effectiveSettings = speechSettings ?? {
    voice,
    responseFormat,
    instructions: speechInstructions,
    model: "gpt-4o-mini-tts",
  };

  return (
    <section className="voice-output-layout">
      <aside className="voice-output-control">
        <div className="panel-title">
          <Volume2 aria-hidden="true" size={18} />
          Voice Output Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={runVoiceOutput}>
          <label className="field">
            <span>Response prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>
          <div className="voice-output-selector-grid">
            <label className="field">
              <span>Voice</span>
              <select value={voice} onChange={(event) => setVoice(event.target.value)} disabled={busy}>
                {voices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Audio format</span>
              <select value={responseFormat} onChange={(event) => setResponseFormat(event.target.value)} disabled={busy}>
                {formats.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Speech instructions</span>
            <textarea
              value={speechInstructions}
              onChange={(event) => setSpeechInstructions(event.target.value)}
              rows={3}
            />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run voice output
            </button>
            <button type="button" className="secondary-button" onClick={resetResultState} disabled={busy}>
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
            <span>Voice</span>
            <strong>{voice} / {responseFormat}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`voice-output-status-panel ${finalStatus}`} role="region" aria-label="Voice Output Status">
        <div className="panel-title">Voice Output Status</div>
        <div className="voice-output-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Text</span>
            <strong>{textAnswer ? "ready" : "pending"}</strong>
          </div>
          <div>
            <span>Audio</span>
            <strong>{audioOutput ? "ready" : "pending"}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{audioEvents.length}</strong>
          </div>
        </div>
      </div>

      <div className="voice-settings-panel" role="region" aria-label="Voice Settings">
        <div className="panel-title">
          <SlidersHorizontal aria-hidden="true" size={16} />
          Voice Settings
        </div>
        <div className="voice-settings-grid">
          <div>
            <span>Voice</span>
            <strong>{effectiveSettings.voice}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>{effectiveSettings.responseFormat}</strong>
          </div>
          <div>
            <span>Model</span>
            <strong>{effectiveSettings.model}</strong>
          </div>
        </div>
        <p>{effectiveSettings.instructions}</p>
      </div>

      <div className="voice-text-panel" role="region" aria-label="Text Response">
        <div className="panel-title">Text Response</div>
        <div className="answer-box compact-answer">{final || textAnswer || "No text response yet."}</div>
      </div>

      <div className="generated-audio-panel" role="region" aria-label="Generated Audio">
        <div className="panel-title">Generated Audio</div>
        {audioOutput?.dataUrl ? (
          <div className="generated-audio-frame">
            <audio controls src={audioOutput.dataUrl} />
            <a className="secondary-button download-link" href={audioOutput.dataUrl} download={audioOutput.filename}>
              <Download size={16} />
              Download audio
            </a>
          </div>
        ) : (
          <p className="muted">Generated audio appears after the graph finishes speech synthesis.</p>
        )}
      </div>

      <div className="voice-output-metadata-panel" role="region" aria-label="Audio Metadata">
        <div className="panel-title">Audio Metadata</div>
        <div className="voice-output-metadata-grid">
          <div>
            <span>File</span>
            <strong>{audioOutput?.filename || "none"}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{audioOutput?.mimeType || "unknown"}</strong>
          </div>
          <div>
            <span>Size</span>
            <strong>{audioOutput?.size ?? 0} bytes</strong>
          </div>
          <div>
            <span>Voice</span>
            <strong>{audioOutput?.voice || voice}</strong>
          </div>
        </div>
      </div>

      <div className="voice-output-events-panel" role="region" aria-label="Voice Output Events">
        <div className="panel-title">Voice Output Events</div>
        <div className="voice-output-event-list">
          {audioEvents.length === 0 ? (
            <p className="muted">Voice output events appear after the run.</p>
          ) : (
            audioEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="voice-output-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel voice-output-final-state" role="region" aria-label="Final State">
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
