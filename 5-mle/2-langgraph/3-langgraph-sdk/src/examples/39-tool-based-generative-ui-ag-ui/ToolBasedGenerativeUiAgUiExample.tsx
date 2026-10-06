import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { ToolBasedGenerativeUiAgUiChat } from "./ToolBasedGenerativeUiAgUiChat";

export function ToolBasedGenerativeUiAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")}
      showDevConsole={false}
      agent="39_tool_based_generative_ui"
    >
      <ToolBasedGenerativeUiAgUiChat />
    </CopilotKit>
  );
}
