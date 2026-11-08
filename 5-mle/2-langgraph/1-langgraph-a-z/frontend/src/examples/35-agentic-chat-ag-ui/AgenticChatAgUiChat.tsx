import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAgenticChatAgUiChat } from "./useAgenticChatAgUiChat";

export function AgenticChatAgUiChat() {
  const { background } = useAgenticChatAgUiChat();

  return (
    <section
      className="agentic-chat-surface"
      data-testid="background-container"
      style={{ background }}
    >
      <div className="agentic-chat-panel">
        <CopilotChat agentId="35_agentic_chat" className="agentic-chat-window" />
      </div>
    </section>
  );
}
