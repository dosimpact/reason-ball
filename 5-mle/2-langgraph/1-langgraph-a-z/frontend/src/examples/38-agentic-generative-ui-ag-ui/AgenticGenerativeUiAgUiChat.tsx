import { CopilotChat } from "@copilotkit/react-core/v2";
import { FileText } from "lucide-react";
import { useAgenticGenerativeUiAgUiChat } from "./useAgenticGenerativeUiAgUiChat";
import { styles } from "./styles";

export function AgenticGenerativeUiAgUiChat() {
  useAgenticGenerativeUiAgUiChat();

  return (
    <section style={styles.shell}>
      <aside style={styles.preview}>
        <div style={styles.title}>
          <FileText aria-hidden="true" size={18} />
          Generated Workspace
        </div>
        <div style={styles.empty}>The latest backend workspace payload renders here during tool execution.</div>
      </aside>
      <div style={styles.chat}>
        <CopilotChat agentId="38_agentic_generative_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}
