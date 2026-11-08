import { CopilotChat } from "@copilotkit/react-core/v2";
import { useBackendToolRenderingAgUiChat } from "./useBackendToolRenderingAgUiChat";
import { styles } from "./styles";

export function BackendToolRenderingAgUiChat() {
  useBackendToolRenderingAgUiChat();

  return (
    <section style={styles.surface}>
      <div style={styles.chatPanel}>
        <CopilotChat agentId="36_backend_tool_rendering" className="agentic-chat-window" />
      </div>
    </section>
  );
}
