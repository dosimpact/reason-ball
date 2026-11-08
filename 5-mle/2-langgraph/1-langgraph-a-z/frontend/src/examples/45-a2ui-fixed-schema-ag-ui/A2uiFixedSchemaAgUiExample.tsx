import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-fixed-schema-ag-ui.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { A2uiFixedSchemaAgUiChat } from "./A2uiFixedSchemaAgUiChat";

export function A2uiFixedSchemaAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="45_a2ui_fixed_schema">
      <A2uiFixedSchemaAgUiChat />
    </CopilotKit>
  );
}
