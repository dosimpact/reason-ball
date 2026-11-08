import { CopilotChat } from "@copilotkit/react-core/v2";
import { Brain, CheckCircle2, ListChecks } from "lucide-react";
import { useAgenticChatReasoningAgUiChat } from "./useAgenticChatReasoningAgUiChat";
import { layoutStyle, panelStyle } from "./styles";

export function AgenticChatReasoningAgUiChat() {
  const { statuses } = useAgenticChatReasoningAgUiChat();

  return (
    <section style={layoutStyle}>
      <aside style={panelStyle} data-testid="reasoning-status-panel">
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Brain size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Reasoning Status</h3>
        </div>
        <div style={{ ...panelStyle, background: "#f4faf7" }}>
          <strong>Visible Contract</strong>
          <span>Public summaries and tool activity are visible. Hidden chain-of-thought is not requested.</span>
        </div>
        {statuses.map((item) => (
          <article key={item.id} style={{ borderTop: "1px solid #d7dfdc", paddingTop: 10 }}>
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <CheckCircle2 color="#20745c" size={16} />
              <strong>{item.label}</strong>
            </div>
            <p style={{ margin: "6px 0 0" }}>{item.detail}</p>
          </article>
        ))}
      </aside>

      <div style={{ ...panelStyle, minHeight: 680 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <ListChecks size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Reasoning Chat</h3>
        </div>
        <CopilotChat agentId="42_agentic_chat_reasoning" className="agentic-chat-window" />
      </div>
    </section>
  );
}
