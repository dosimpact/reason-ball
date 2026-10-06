import { useState } from "react";
import { useConfigureSuggestions, useFrontendTool, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { type ReasoningStatus, publishReasoningSummaryParameters, lookupPolicyFactParameters } from "./model";
import { PublishReasoningSummaryRenderer, LookupPolicyFactRenderer } from "./ToolRenderers";

export function useAgenticChatReasoningAgUiChat() {
  const [statuses, setStatuses] = useState<ReasoningStatus[]>([
    {
      id: "seed",
      label: "Ready",
      detail: "Public reasoning summaries will appear as tool-rendered blocks.",
    },
  ]);

  useFrontendTool(
    {
      name: "record_reasoning_status",
      description: "Record a concise public reasoning status in the side panel.",
      parameters: z.object({
        label: z.string(),
        detail: z.string(),
      }),
      handler: async ({ label, detail }) => {
        setStatuses((current) => [{ id: `status-${current.length + 1}`, label, detail }, ...current].slice(0, 5));
        return { status: "recorded", label, detail };
      },
    },
    [],
  );

  useRenderTool({
    name: "publish_reasoning_summary",
    parameters: publishReasoningSummaryParameters,
    render: (props) => <PublishReasoningSummaryRenderer {...props} />,
  });

  useRenderTool({
    name: "lookup_policy_fact",
    parameters: lookupPolicyFactParameters,
    render: (props) => <LookupPolicyFactRenderer {...props} />,
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Show reasoning summary",
        message: "Use publish_reasoning_summary for planning a safe AG-UI reasoning answer, then give the final answer separately.",
      },
      {
        title: "Policy fact",
        message: "Look up the reasoning UI policy fact and explain why hidden chain-of-thought is not displayed.",
      },
    ],
    available: "always",
  });

  return { statuses };
}
