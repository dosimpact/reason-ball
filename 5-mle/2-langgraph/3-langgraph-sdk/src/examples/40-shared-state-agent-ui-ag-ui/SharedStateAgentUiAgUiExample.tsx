import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { SharedStateAgentUiAgUiChat } from "./SharedStateAgentUiAgUiChat";

export function SharedStateAgentUiAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="40_shared_state_agent_ui">
      <SharedStateAgentUiAgUiChat />
    </CopilotKit>
  );
}
