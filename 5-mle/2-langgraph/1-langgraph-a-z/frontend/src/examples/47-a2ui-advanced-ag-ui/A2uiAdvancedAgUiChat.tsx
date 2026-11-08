import { CopilotChat } from "@copilotkit/react-core/v2";
import { Rocket } from "lucide-react";
import { useA2uiAdvancedAgUiChat } from "./useA2uiAdvancedAgUiChat";

export function A2uiAdvancedAgUiChat() {
  const { actionResult } = useA2uiAdvancedAgUiChat();

  return (
    <section className="advanced-a2ui-shell">
      <aside className="advanced-a2ui-side">
        <div className="advanced-a2ui-side-title">
          <Rocket size={18} aria-hidden="true" />
          Advanced A2UI
        </div>
        <p>Backend payloads provide progress, generated UI, and action metadata. The button records the confirmed intent.</p>
        <div className="advanced-a2ui-action-state">{actionResult || "No frontend action confirmed yet."}</div>
      </aside>
      <div className="advanced-a2ui-chat">
        <CopilotChat agentId="47_a2ui_advanced" className="advanced-a2ui-chat-window" />
      </div>
    </section>
  );
}
