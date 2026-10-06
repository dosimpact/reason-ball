import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { AgenticChatMultimodalAgUiChat } from "./AgenticChatMultimodalAgUiChat";

export function AgenticChatMultimodalAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="43_agentic_chat_multimodal">
      <AgenticChatMultimodalAgUiChat />
    </CopilotKit>
  );
}
