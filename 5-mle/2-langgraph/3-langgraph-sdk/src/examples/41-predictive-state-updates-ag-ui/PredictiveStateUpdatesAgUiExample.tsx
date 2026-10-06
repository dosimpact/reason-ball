import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { PredictiveStateUpdatesAgUiChat } from "./PredictiveStateUpdatesAgUiChat";

export function PredictiveStateUpdatesAgUiExample() {
  return (
    <CopilotKit runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")} showDevConsole={false} agent="41_predictive_state_updates">
      <PredictiveStateUpdatesAgUiChat />
    </CopilotKit>
  );
}
