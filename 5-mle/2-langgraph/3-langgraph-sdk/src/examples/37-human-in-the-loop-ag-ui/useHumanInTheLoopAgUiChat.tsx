import { useConfigureSuggestions, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { useHumanInTheLoopAgUiChatState } from "./useHumanInTheLoopAgUiChatState";
import { type ApprovalRequest } from "./model";

export function useHumanInTheLoopAgUiChat() {
  const { pending, draftSteps, setDraftSteps, lastDecision, requestApproval, resolveApproval } = useHumanInTheLoopAgUiChatState();

  useFrontendTool({
    name: "request_task_approval",
    description: "Ask the human to approve, reject, or edit a proposed task plan before continuing.",
    parameters: z.object({
      title: z.string(),
      steps: z.array(z.string()).min(1),
      riskNote: z.string(),
      action: z.string().optional(),
    }),
    handler: async (request: ApprovalRequest) => requestApproval(request),
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Approve a rollout",
        message: "Draft a three step rollout plan for enabling AG-UI backend tool cards.",
      },
      {
        title: "Review a publish plan",
        message: "Prepare a plan to publish the deterministic haiku card demo.",
      },
    ],
    available: "always",
  });

  return { pending, draftSteps, setDraftSteps, lastDecision, resolveApproval };
}
