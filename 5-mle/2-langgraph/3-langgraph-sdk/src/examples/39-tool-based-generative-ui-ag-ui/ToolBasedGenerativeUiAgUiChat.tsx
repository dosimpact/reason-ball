import { CopilotChat } from "@copilotkit/react-core/v2";
import { useToolBasedGenerativeUiAgUiChat } from "./useToolBasedGenerativeUiAgUiChat";
import { styles } from "./styles";

export function ToolBasedGenerativeUiAgUiChat() {
  useToolBasedGenerativeUiAgUiChat();

  return (
    <section style={styles.surface}>
      <div style={styles.chatPanel}>
        <CopilotChat agentId="39_tool_based_generative_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}
