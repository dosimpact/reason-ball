import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";
import { HumanInTheLoopAgUiChat } from "./HumanInTheLoopAgUiChat";

export function HumanInTheLoopAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={(import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "/api/copilotkit")}
      showDevConsole={false}
      agent="37_human_in_the_loop_ag_ui"
    >
      <HumanInTheLoopAgUiChat />
    </CopilotKit>
  );
}
