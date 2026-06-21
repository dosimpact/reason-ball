import { FileImage, ImagePlus, Loader2, Play, RotateCcw, ScanSearch } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultPrompt =
  "Analyze this image for layout, visible text, colors, and UI-relevant details.";
const alternatePrompt =
  "Describe the main subject, call out any readable labels, and provide region notes for review.";
const maxImageBytes = 1_500_000;

type JsonRecord = Record<string, unknown>;

type ImageMetadata = {
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  source: string;
};

type Observation = {
  label: string;
  detail: string;
  confidence: number;
};

type RegionNote = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  note: string;
  confidence: number;
};

type ImageEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function formatJson(value: unknown) {
  return JSON.stringify(
    value,
    (key, child) => {
      if ((key === "data_url" || key === "image_data_url") && typeof child === "string" && child.startsWith("data:image")) {
        return `[image data URL: ${child.length} chars]`;
      }
      return child;
    },
    2,
  );
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function normalizeMetadata(value: unknown): ImageMetadata | null {
  if (!isRecord(value)) return null;
  return {
    name: typeof value.name === "string" ? value.name : "image",
    mimeType: typeof value.mime_type === "string" ? value.mime_type : "",
    size: numberValue(value.size),
    width: numberValue(value.width),
    height: numberValue(value.height),
    source: typeof value.source === "string" ? value.source : "",
  };
}

function normalizeObservations(value: unknown): Observation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    label: typeof item.label === "string" ? item.label : "Observation",
    detail: typeof item.detail === "string" ? item.detail : "",
    confidence: numberValue(item.confidence),
  }));
}

function normalizeRegionNotes(value: unknown): RegionNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    id: typeof item.id === "string" ? item.id : `region-${index + 1}`,
    label: typeof item.label === "string" ? item.label : `Region ${index + 1}`,
    x: numberValue(item.x),
    y: numberValue(item.y),
    width: numberValue(item.width),
    height: numberValue(item.height),
    note: typeof item.note === "string" ? item.note : "",
    confidence: numberValue(item.confidence),
  }));
}

function normalizeImageEvents(value: unknown): ImageEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "multimodal_image_input",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergeImageEvents(current: ImageEvent[], next: ImageEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function createSamplePng() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#f4faf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#174f8c";
  context.fillRect(42, 46, 220, 76);
  context.fillStyle = "#e6f4f0";
  context.fillRect(296, 46, 292, 76);
  context.fillStyle = "#d8bd72";
  context.fillRect(42, 156, 546, 44);
  context.fillStyle = "#ffffff";
  context.fillRect(42, 228, 152, 78);
  context.fillRect(244, 228, 152, 78);
  context.fillRect(436, 228, 152, 78);
  context.strokeStyle = "#7f9990";
  context.lineWidth = 4;
  context.strokeRect(42, 46, 546, 260);
  context.fillStyle = "#ffffff";
  context.font = "700 30px Arial";
  context.fillText("LangGraph", 66, 94);
  context.fillStyle = "#24312d";
  context.font = "700 22px Arial";
  context.fillText("Image Input", 320, 93);
  context.font = "18px Arial";
  context.fillText("Preview -> Analyze -> Region Notes", 70, 185);
  context.font = "700 16px Arial";
  context.fillText("Upload", 80, 274);
  context.fillText("Vision", 286, 274);
  context.fillText("Result", 478, 274);

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    name: "langgraph-sample-image.png",
    mimeType: "image/png",
    size: Math.round((dataUrl.length * 3) / 4),
  };
}

export function MultimodalImageInputExample() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
  const [imageSize, setImageSize] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [regionNotes, setRegionNotes] = useState<RegionNote[]>([]);
  const [imageEvents, setImageEvents] = useState<ImageEvent[]>([]);
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
    setObservations([]);
    setRegionNotes([]);
    setImageEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function resetView() {
    resetResultState();
    setImageDataUrl("");
    setImageName("");
    setImageMimeType("");
    setImageSize(0);
    setValidationError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setImagePayload(dataUrl: string, name: string, mimeType: string, size: number) {
    setImageDataUrl(dataUrl);
    setImageName(name);
    setImageMimeType(mimeType);
    setImageSize(size);
    setValidationError("");
    resetResultState();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setValidationError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > maxImageBytes) {
      setValidationError("Image is too large for this example.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImagePayload(dataUrl, file.name, file.type, file.size);
  }

  function useSampleImage() {
    const sample = createSamplePng();
    setImagePayload(sample.dataUrl, sample.name, sample.mimeType, sample.size);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function applyValues(values: JsonRecord) {
    if (isRecord(values.image_metadata)) setMetadata(normalizeMetadata(values.image_metadata));
    if (Array.isArray(values.observations)) setObservations(normalizeObservations(values.observations));
    if (Array.isArray(values.region_notes)) setRegionNotes(normalizeRegionNotes(values.region_notes));
    if (Array.isArray(values.image_events)) {
      setImageEvents((current) => mergeImageEvents(current, normalizeImageEvents(values.image_events)));
    }
    if (typeof values.answer === "string") setAnswer(values.answer);
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "multimodal_image_input") return;
    setImageEvents((current) => mergeImageEvents(current, normalizeImageEvents([[data]].flat())));
  }

  async function runImageAnalysis(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || !imageDataUrl) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setObservations([]);
    setRegionNotes([]);
    setImageEvents([]);
    setAnswer("");
    setFinal("");
    setFinalState(null);
    setFinalStatus("running");
    setStatus("Creating image analysis thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "26-multimodal-image-input" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming image analysis");

      const stream = await client.runs.stream(nextThreadId, "26_multimodal_image_input", {
        input: {
          prompt: trimmedPrompt,
          image: {
            data_url: imageDataUrl,
            name: imageName,
            mime_type: imageMimeType,
            size: imageSize,
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

  return (
    <section className="image-input-layout">
      <aside className="image-input-control">
        <div className="panel-title">
          <FileImage aria-hidden="true" size={18} />
          Image Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={useSampleImage} disabled={busy}>
            <ImagePlus size={16} />
            Use sample image
          </button>
          <button type="button" className="secondary-button" onClick={() => setPrompt(alternatePrompt)} disabled={busy}>
            <ScanSearch size={16} />
            Use region prompt
          </button>
        </div>
        <form className="run-form" onSubmit={runImageAnalysis}>
          <label className="field">
            <span>Image file</span>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
          </label>
          <label className="field">
            <span>Image prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !prompt.trim() || !imageDataUrl}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run image analysis
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
            <span>Image</span>
            <strong>{imageName || "none"}</strong>
          </div>
        </div>
        {validationError ? <p className="error-line">{validationError}</p> : null}
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`image-status-panel ${finalStatus}`} role="region" aria-label="Image Analysis Status">
        <div className="panel-title">Image Analysis Status</div>
        <div className="image-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Observations</span>
            <strong>{observations.length}</strong>
          </div>
          <div>
            <span>Regions</span>
            <strong>{regionNotes.length}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{imageEvents.length}</strong>
          </div>
        </div>
      </div>

      <div className="image-preview-panel" role="region" aria-label="Image Preview">
        <div className="panel-title">Image Preview</div>
        {imageDataUrl ? (
          <div className="image-preview-frame">
            <img src={imageDataUrl} alt={imageName || "Uploaded image preview"} />
            {regionNotes.map((region) => (
              <span
                key={region.id}
                className="region-overlay"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                }}
              >
                {region.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">Upload an image or use the sample image to preview it before sending.</p>
        )}
      </div>

      <div className="image-metadata-panel" role="region" aria-label="Image Metadata">
        <div className="panel-title">Image Metadata</div>
        <div className="image-metadata-grid">
          <div>
            <span>Name</span>
            <strong>{metadata?.name || imageName || "none"}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{metadata?.mimeType || imageMimeType || "unknown"}</strong>
          </div>
          <div>
            <span>Size</span>
            <strong>{metadata?.size || imageSize || 0} bytes</strong>
          </div>
          <div>
            <span>Dimensions</span>
            <strong>{metadata ? `${metadata.width || "?"} x ${metadata.height || "?"}` : "pending"}</strong>
          </div>
        </div>
      </div>

      <div className="image-analysis-panel" role="region" aria-label="Image Analysis">
        <div className="panel-title">Image Analysis</div>
        <div className="answer-box compact-answer">{final || answer || "No image analysis yet."}</div>
        <div className="observation-list">
          {observations.map((observation) => (
            <article key={observation.label} className="observation-card">
              <strong>{observation.label}</strong>
              <p>{observation.detail}</p>
              <span>confidence {percent(observation.confidence)}%</span>
            </article>
          ))}
        </div>
      </div>

      <div className="region-notes-panel" role="region" aria-label="Region Notes">
        <div className="panel-title">Region Notes</div>
        <div className="region-note-list">
          {regionNotes.length === 0 ? (
            <p className="muted">Region notes appear after analysis.</p>
          ) : (
            regionNotes.map((region) => (
              <article key={region.id} className="region-note-card">
                <strong>{region.label}</strong>
                <p>{region.note}</p>
                <code>
                  x {region.x.toFixed(2)} / y {region.y.toFixed(2)} / w {region.width.toFixed(2)} / h{" "}
                  {region.height.toFixed(2)}
                </code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="image-events-panel" role="region" aria-label="Image Events">
        <div className="panel-title">Image Events</div>
        <div className="image-event-list">
          {imageEvents.length === 0 ? (
            <p className="muted">Image stream events appear after the run.</p>
          ) : (
            imageEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="image-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel image-input-final-state" role="region" aria-label="Final State">
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
