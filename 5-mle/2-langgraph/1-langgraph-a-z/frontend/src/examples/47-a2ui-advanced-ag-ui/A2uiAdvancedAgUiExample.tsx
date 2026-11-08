import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-advanced-ag-ui.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { A2uiAdvancedAgUiChat } from "./A2uiAdvancedAgUiChat";

export function A2uiAdvancedAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="47_a2ui_advanced">
      <A2uiAdvancedAgUiChat />
    </CopilotKit>
  );
}
