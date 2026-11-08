import { useMemo } from "react";
import { useAgentContext, useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { useAgenticChatMultimodalAgUiChatState } from "./useAgenticChatMultimodalAgUiChatState";
import { maxImageBytes, recordImageObservationsParameters, describeTextOnlyRequestParameters } from "./model";
import { readFileAsDataUrl, createSampleImage } from "./media";
import { RecordImageObservationsRenderer, DescribeTextOnlyRequestRenderer } from "./ToolRenderers";

export function useAgenticChatMultimodalAgUiChat() {
  const { preview, uploadError, setUploadError, fileInputRef, applyPreview, resetPreview } = useAgenticChatMultimodalAgUiChatState();

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

  async function handlePreviewFile(file: File | undefined) {
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
    applyPreview({ dataUrl, name: file.name, mimeType: file.type, size: file.size });
  }

  function loadSampleImage() {
    applyPreview(createSampleImage());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useRenderTool({
    name: "record_image_observations",
    parameters: recordImageObservationsParameters,
    render: (props) => <RecordImageObservationsRenderer {...props} />,
  });

  useRenderTool({
    name: "describe_text_only_request",
    parameters: describeTextOnlyRequestParameters,
    render: (props) => <DescribeTextOnlyRequestRenderer {...props} />,
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

  return { preview, uploadError, setUploadError, fileInputRef, resetPreview, handlePreviewFile, loadSampleImage };
}
