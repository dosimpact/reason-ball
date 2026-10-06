import { CopilotChat } from "@copilotkit/react-core/v2";
import { Plane } from "lucide-react";
import { useA2uiFixedSchemaAgUiChat } from "./useA2uiFixedSchemaAgUiChat";

export function A2uiFixedSchemaAgUiChat() {
  useA2uiFixedSchemaAgUiChat();

  return (
    <section className="fixed-a2ui-shell">
      <aside className="fixed-a2ui-side">
        <div className="fixed-a2ui-side-title">
          <Plane size={18} aria-hidden="true" />
          Fixed Schema
        </div>
        <p>Flight cards render only when the backend returns the expected schema version and required option list.</p>
      </aside>
      <div className="fixed-a2ui-chat">
        <CopilotChat agentId="45_a2ui_fixed_schema" className="fixed-a2ui-chat-window" />
      </div>
    </section>
  );
}
