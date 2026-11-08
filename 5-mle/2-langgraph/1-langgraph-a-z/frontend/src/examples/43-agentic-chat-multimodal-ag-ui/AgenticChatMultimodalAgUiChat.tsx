import { CopilotChat } from "@copilotkit/react-core/v2";
import { FileImage, ImagePlus, RotateCcw } from "lucide-react";
import { useAgenticChatMultimodalAgUiChat } from "./useAgenticChatMultimodalAgUiChat";
import { layoutStyle, panelStyle, buttonStyle } from "./styles";
import { maxImageBytes } from "./model";

export function AgenticChatMultimodalAgUiChat() {
  const { preview, uploadError, setUploadError, fileInputRef, resetPreview, handlePreviewFile, loadSampleImage } = useAgenticChatMultimodalAgUiChat();

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
              onChange={(event) => { void handlePreviewFile(event.target.files?.[0]); }}
              style={{ display: "none" }}
              type="file"
            />
          </label>
          <button style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }} type="button" onClick={loadSampleImage}>
            <ImagePlus size={16} />
            Sample
          </button>
          <button
            style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }}
            type="button"
            onClick={resetPreview}
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
          agentId="43_agentic_chat_multimodal"
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
