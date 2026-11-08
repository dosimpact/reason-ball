import * as R from "remeda";
import { useRef, useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";

import { defaultPrompt, type ImageEvent, type ImageMetadata, type JsonRecord, mergeImageEvents, normalizeImageEvents, normalizeMetadata, normalizeObservations, normalizeRegionNotes, type Observation, type RegionNote } from "./model";

// Local state, derived values, and synchronous state transitions.
export function useMultimodalImageInputState() {
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

  function applyValues(values: JsonRecord) {
    if (R.isPlainObject(values.image_metadata)) setMetadata(normalizeMetadata(values.image_metadata));
    if (R.isArray(values.observations)) setObservations(normalizeObservations(values.observations));
    if (R.isArray(values.region_notes)) setRegionNotes(normalizeRegionNotes(values.region_notes));
    if (R.isArray(values.image_events)) {
      setImageEvents((current) => mergeImageEvents(current, normalizeImageEvents(values.image_events)));
    }
    if (R.isString(values.answer)) setAnswer(values.answer);
    if (R.isString(values.final)) setFinal(values.final);
    if (R.isString(values.final_status)) setFinalStatus(values.final_status);
    if (R.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!R.isPlainObject(data) || data.type !== "26_multimodal_image_input") return;
    setImageEvents((current) => mergeImageEvents(current, normalizeImageEvents([[data]].flat())));
  }

  function startRun() {
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
  }

  function failRun(caught: unknown) {
    setError(caught instanceof Error ? caught.message : String(caught));
    setStatus("Run failed");
    setFinalStatus("failed");
  }

  return {
    prompt,
    setPrompt,
    imageDataUrl,
    imageName,
    imageMimeType,
    imageSize,
    validationError,
    setValidationError,
    threadId,
    setThreadId,
    status,
    setStatus,
    finalStatus,
    metadata,
    observations,
    regionNotes,
    imageEvents,
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
    setImagePayload,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  };
}
