import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { AgenticChatReasoningAgUiChat } from "./AgenticChatReasoningAgUiChat";

export function AgenticChatReasoningAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="42_agentic_chat_reasoning">
      <AgenticChatReasoningAgUiChat />
    </CopilotKit>
  );
}
