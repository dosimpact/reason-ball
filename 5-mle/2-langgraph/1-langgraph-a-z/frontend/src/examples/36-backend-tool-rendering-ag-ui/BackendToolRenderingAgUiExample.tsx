import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { BackendToolRenderingAgUiChat } from "./BackendToolRenderingAgUiChat";

export function BackendToolRenderingAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")}
      showDevConsole={false}
      agent="36_backend_tool_rendering"
    >
      <BackendToolRenderingAgUiChat />
    </CopilotKit>
  );
}
