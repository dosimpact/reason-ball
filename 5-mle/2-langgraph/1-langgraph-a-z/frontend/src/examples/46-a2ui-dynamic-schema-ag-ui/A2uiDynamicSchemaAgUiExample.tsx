import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-dynamic-schema-ag-ui.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { A2uiDynamicSchemaAgUiChat } from "./A2uiDynamicSchemaAgUiChat";

export function A2uiDynamicSchemaAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="46_a2ui_dynamic_schema">
      <A2uiDynamicSchemaAgUiChat />
    </CopilotKit>
  );
}
