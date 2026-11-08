import { useMemo } from "react";
import { createLangGraphClient, normalizeStreamChunk } from "../../lib/langgraphClient";

import { createSamplePng, readFileAsDataUrl } from "./media";
import { maxImageBytes, nodePayloads, valuesOf } from "./model";

import { useMultimodalImageInputState } from "./useMultimodalImageInputState";

// SDK requests, browser input preparation, and stream consumption.
export function useMultimodalImageInput() {
  const state = useMultimodalImageInputState();
  const {
    prompt,
    imageDataUrl,
    imageName,
    imageMimeType,
    imageSize,
    setValidationError,
    setThreadId,
    setStatus,
    setEvents,
    setBusy,
    fileInputRef,
    setImagePayload,
    applyValues,
    applyCustomEvent,
    startRun,
    failRun,
  } = state;
  const client = useMemo(() => createLangGraphClient(), []);

  async function handleFileChange(file: File | undefined) {
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

  function loadSampleImage() {
    const sample = createSamplePng();
    setImagePayload(sample.dataUrl, sample.name, sample.mimeType, sample.size);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runImageAnalysis() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || !imageDataUrl) return;

    startRun();

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
      failRun(caught);
    } finally {
      setBusy(false);
    }
  }

  return {
    prompt,
    setPrompt: state.setPrompt,
    imageDataUrl,
    imageName,
    imageMimeType,
    imageSize,
    validationError: state.validationError,
    threadId: state.threadId,
    status: state.status,
    finalStatus: state.finalStatus,
    metadata: state.metadata,
    observations: state.observations,
    regionNotes: state.regionNotes,
    imageEvents: state.imageEvents,
    answer: state.answer,
    final: state.final,
    finalState: state.finalState,
    events: state.events,
    error: state.error,
    busy: state.busy,
    fileInputRef,
    resetView: state.resetView,
    handleFileChange,
    loadSampleImage,
    runImageAnalysis,
  };
}
