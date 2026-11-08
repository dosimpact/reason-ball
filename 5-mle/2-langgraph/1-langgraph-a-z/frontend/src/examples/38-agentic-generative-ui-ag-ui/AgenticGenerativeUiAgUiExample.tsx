import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { AgenticGenerativeUiAgUiChat } from "./AgenticGenerativeUiAgUiChat";

export function AgenticGenerativeUiAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")}
      showDevConsole={false}
      agent="38_agentic_generative_ui"
    >
      <AgenticGenerativeUiAgUiChat />
    </CopilotKit>
  );
}
