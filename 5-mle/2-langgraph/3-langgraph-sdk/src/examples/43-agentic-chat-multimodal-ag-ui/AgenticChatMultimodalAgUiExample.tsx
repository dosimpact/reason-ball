import { ChangeEvent, useMemo, useRef, useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useAgentContext,
  useConfigureSuggestions,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { FileImage, ImagePlus, RotateCcw } from "lucide-react";
import { z } from "zod";

type PreviewImage = {
  dataUrl: string;
  name: string;
  mimeType: string;
  size: number;
};

const maxImageBytes = 1_500_000;

const layoutStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(320px, 0.85fr) minmax(380px, 1.15fr)",
  minHeight: 720,
} as const;

const panelStyle = {
  background: "#fbfcfb",
  border: "1px solid #cfd8d5",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
} as const;

const buttonStyle = {
  alignItems: "center",
  border: "1px solid #9fb3ad",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
  padding: "9px 12px",
} as const;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function parseJson(result: unknown): Record<string, unknown> {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseJson(parsed);
    } catch {
      return { text: result };
    }
  }
  if (result && typeof result === "object" && !Array.isArray(result)) return result as Record<string, unknown>;
  return {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function createSampleImage(): PreviewImage {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#f4faf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#174f8c";
  context.fillRect(32, 36, 180, 64);
  context.fillStyle = "#d8bd72";
  context.fillRect(32, 128, 416, 38);
  context.fillStyle = "#ffffff";
  context.fillRect(52, 198, 96, 56);
  context.fillRect(192, 198, 96, 56);
  context.fillRect(332, 198, 96, 56);
  context.strokeStyle = "#7f9990";
  context.lineWidth = 4;
  context.strokeRect(32, 36, 416, 218);
  context.fillStyle = "#ffffff";
  context.font = "700 24px Arial";
  context.fillText("AG-UI", 58, 76);
  context.fillStyle = "#24312d";
  context.font = "700 18px Arial";
  context.fillText("Multimodal Preview", 230, 76);
  context.font = "16px Arial";
  context.fillText("Image -> Chat attachment -> Observations", 62, 153);

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    name: "ag-ui-multimodal-sample.png",
    mimeType: "image/png",
    size: Math.round((dataUrl.length * 3) / 4),
  };
}

function MultimodalChat() {
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewContext = useMemo(
    () => ({
      example: "43-agentic-chat-multimodal-ag-ui",
      selectedPreview: preview
        ? {
            name: preview.name,
            mimeType: preview.mimeType,
            size: preview.size,
          }
        : null,
    }),
    [preview],
  );

  useAgentContext({
    description: "Current multimodal preview metadata selected in the React UI",
    value: previewContext,
  });

  async function handlePreviewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > maxImageBytes) {
      setUploadError("Image is too large for this example.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPreview({ dataUrl, name: file.name, mimeType: file.type, size: file.size });
    setUploadError("");
  }

  function useSampleImage() {
    setPreview(createSampleImage());
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useRenderTool({
    name: "record_image_observations",
    parameters: z.object({
      subject: z.string(),
      visible_text: z.string().optional(),
      colors: z.string().optional(),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseJson(result);
      const checks = stringList(parsed.checks);
      return (
        <div style={{ ...panelStyle, gap: 8 }} data-testid="image-observations-tool">
          <strong>{status === "complete" ? "Image observations recorded" : "Inspecting image"}</strong>
          <span>Subject: {parameters.subject || "pending"}</span>
          <span>Visible text: {parameters.visible_text || "pending"}</span>
          <span>Colors: {parameters.colors || "pending"}</span>
          {checks.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    },
  });

  useRenderTool({
    name: "describe_text_only_request",
    parameters: z.object({
      prompt: z.string(),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseJson(result);
      return (
        <div style={{ ...panelStyle, gap: 8 }} data-testid="text-only-tool">
          <strong>{status === "complete" ? "Text-only request" : "Checking text-only request"}</strong>
          <span>{parameters.prompt || "pending"}</span>
          {typeof parsed.message === "string" ? <p style={{ margin: 0 }}>{parsed.message}</p> : null}
        </div>
      );
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Analyze attached image",
        message: "Analyze the attached image and record concise image observations.",
      },
      {
        title: "Text-only fallback",
        message: "Answer this text-only message without using an image attachment.",
      },
    ],
    available: "always",
  });

  return (
    <section style={layoutStyle}>
      <aside style={panelStyle} data-testid="multimodal-preview-panel">
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <FileImage size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Image Preview</h3>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <label style={{ ...buttonStyle, background: "#174f8c", color: "#ffffff" }}>
            <ImagePlus size={16} />
            Select image
            <input
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePreviewFile}
              style={{ display: "none" }}
              type="file"
            />
          </label>
          <button style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }} type="button" onClick={useSampleImage}>
            <ImagePlus size={16} />
            Sample
          </button>
          <button
            style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }}
            type="button"
            onClick={() => {
              setPreview(null);
              setUploadError("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        {uploadError ? <p style={{ color: "#a43d2f", margin: 0 }}>{uploadError}</p> : null}

        <div style={{ ...panelStyle, background: "#f4faf7", minHeight: 260, placeItems: "center" }}>
          {preview ? (
            <img
              alt={preview.name}
              src={preview.dataUrl}
              style={{ borderRadius: 8, maxHeight: 320, maxWidth: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ color: "#5b6b66" }}>No preview selected.</span>
          )}
        </div>

        <div style={{ ...panelStyle, gap: 6 }}>
          <strong>Selected metadata</strong>
          <span>Name: {preview?.name ?? "none"}</span>
          <span>Type: {preview?.mimeType ?? "none"}</span>
          <span>Size: {preview?.size ?? 0} bytes</span>
        </div>
      </aside>

      <div style={{ ...panelStyle, minHeight: 680 }}>
        <h3 style={{ fontSize: 18, margin: 0 }}>Multimodal Chat</h3>
        <CopilotChat
          agentId="agentic_chat_multimodal"
          attachments={{
            enabled: true,
            accept: "image/png,image/jpeg,image/webp",
            maxSize: maxImageBytes,
            onUploadFailed: ({ message }) => setUploadError(message),
          }}
          className="agentic-chat-window"
        />
      </div>
    </section>
  );
}

export function AgenticChatMultimodalAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="agentic_chat_multimodal">
      <MultimodalChat />
    </CopilotKit>
  );
}
