import { useConfigureSuggestions, useFrontendTool, useRenderTool } from "@copilotkit/react-core/v2";
import { useState } from "react";
import { z } from "zod";
import { buildAdvancedA2uiParameters } from "./model";
import { BuildAdvancedA2uiRenderer } from "./ToolRenderers";

export function useA2uiAdvancedAgUiChat() {
  const [actionResult, setActionResult] = useState("");

  async function confirmSelection(selectionId: string, selectionLabel: string) {
    const message = `Confirmed ${selectionLabel} (${selectionId})`;
    setActionResult(message);
    return {
      status: "confirmed",
      selectionId,
      selectionLabel,
      message,
    };
  }

  useFrontendTool({
    name: "confirm_advanced_selection",
    description: "Confirm the selected option from the advanced A2UI decision panel.",
    parameters: z.object({
      selection_id: z.string().describe("Stable id for the selected option."),
      selection_label: z.string().describe("Human-readable selected option label."),
    }),
    handler: async ({
      selection_id: selectionId,
      selection_label: selectionLabel,
    }: {
      selection_id: string;
      selection_label: string;
    }) => confirmSelection(selectionId, selectionLabel),
  });

  useRenderTool({
    name: "build_advanced_a2ui",
    parameters: buildAdvancedA2uiParameters,
    render: (props) => <BuildAdvancedA2uiRenderer {...props} actionResult={actionResult} confirmSelection={confirmSelection} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Build decision UI",
        message: "Create an advanced A2UI release decision panel with progress and a frontend confirmation action.",
      },
      {
        title: "Incident review",
        message: "Build an advanced incident review UI with progress phases and a recommended action.",
      },
    ],
    available: "always",
  });

  return { actionResult };
}
