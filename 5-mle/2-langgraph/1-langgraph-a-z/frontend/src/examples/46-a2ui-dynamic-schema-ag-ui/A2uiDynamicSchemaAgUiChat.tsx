import { CopilotChat } from "@copilotkit/react-core/v2";
import { LayoutTemplate } from "lucide-react";
import { useA2uiDynamicSchemaAgUiChat } from "./useA2uiDynamicSchemaAgUiChat";

export function A2uiDynamicSchemaAgUiChat() {
  useA2uiDynamicSchemaAgUiChat();

  return (
    <section className="dynamic-a2ui-shell">
      <aside className="dynamic-a2ui-side">
        <div className="dynamic-a2ui-side-title">
          <LayoutTemplate size={18} aria-hidden="true" />
          Dynamic Schema
        </div>
        <p>Only form, list, comparison, and summary nodes render directly. Everything else uses a fallback.</p>
      </aside>
      <div className="dynamic-a2ui-chat">
        <CopilotChat agentId="46_a2ui_dynamic_schema" className="dynamic-a2ui-chat-window" />
      </div>
    </section>
  );
}
