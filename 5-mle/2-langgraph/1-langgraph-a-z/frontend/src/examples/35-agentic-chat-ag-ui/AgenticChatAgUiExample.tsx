import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { AgenticChatAgUiChat } from "./AgenticChatAgUiChat";

export function AgenticChatAgUiExample() {
  return (
    <CopilotKit runtimeUrl={import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit"} showDevConsole={false} agent="35_agentic_chat">
      <AgenticChatAgUiChat />
    </CopilotKit>
  );
}
