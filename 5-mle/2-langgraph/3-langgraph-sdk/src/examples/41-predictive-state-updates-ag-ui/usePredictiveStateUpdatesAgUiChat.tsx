import { useMemo } from "react";
import { useAgentContext, useConfigureSuggestions, useFrontendTool, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { usePredictiveStateUpdatesAgUiChatState } from "./usePredictiveStateUpdatesAgUiChatState";
import { editDocumentParameters } from "./model";
import { EditDocumentRenderer } from "./ToolRenderers";

export function usePredictiveStateUpdatesAgUiChat() {
  const { documentState, setDocumentState, pending, startPrediction, confirmPrediction, resetDocument, applyDocumentUpdate } = usePredictiveStateUpdatesAgUiChatState();

  const context = useMemo(
    () => ({
      example: "41-predictive-state-updates-ag-ui",
      document: documentState,
      pending,
    }),
    [documentState, pending],
  );

  useAgentContext({
    description: "Current document state and predictive edit status",
    value: context,
  });

  useFrontendTool(
    {
      name: "apply_document_update",
      description: "Apply a backend-confirmed document patch to the predictive editor.",
      parameters: z.object({
        title: z.string().optional(),
        body: z.string().optional(),
        operation: z.string(),
        status: z.enum(["confirmed", "reverted"]).default("confirmed"),
      }),
      handler: async (update) => applyDocumentUpdate(update),
    },
    [documentState],
  );

  useRenderTool({
    name: "edit_document",
    parameters: editDocumentParameters,
    render: (props) => <EditDocumentRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Shorten document",
        message: `Call edit_document with title "${documentState.title}", the current body, and operation "shorten". Then apply the patch with apply_document_update.`,
      },
      {
        title: "Explain revision",
        message: `Explain revision ${documentState.revision} and last operation ${documentState.lastOperation}.`,
      },
    ],
    available: "always",
  });

  return { documentState, setDocumentState, pending, startPrediction, confirmPrediction, resetDocument };
}
