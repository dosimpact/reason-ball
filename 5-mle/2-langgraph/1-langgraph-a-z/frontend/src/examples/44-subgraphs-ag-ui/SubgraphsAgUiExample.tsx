import "@copilotkit/react-core/v2/styles.css";
import "./subgraphs-ag-ui.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { SubgraphsAgUiChat } from "./SubgraphsAgUiChat";

export function SubgraphsAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="44_subgraphs_ag_ui">
      <SubgraphsAgUiChat />
    </CopilotKit>
  );
}
