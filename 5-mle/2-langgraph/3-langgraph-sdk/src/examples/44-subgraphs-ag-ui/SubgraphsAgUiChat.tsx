import { CopilotChat } from "@copilotkit/react-core/v2";
import { GitBranch } from "lucide-react";
import { useSubgraphsAgUiChat } from "./useSubgraphsAgUiChat";

export function SubgraphsAgUiChat() {
  useSubgraphsAgUiChat();

  return (
    <section className="subgraphs-ag-ui-shell">
      <aside className="subgraphs-side-panel">
        <div className="subgraphs-side-title">
          <GitBranch size={18} aria-hidden="true" />
          Subgraph State
        </div>
        <p>
          The backend tool returns a parent state plus stable worker rows. The renderer keeps failed workers separate
          from completed workers so manual testing can inspect each path.
        </p>
        <ul>
          <li>Parent route and aggregation status</li>
          <li>Named worker subgraph results</li>
          <li>Final aggregate response</li>
        </ul>
      </aside>
      <div className="subgraphs-chat-panel">
        <CopilotChat agentId="44_subgraphs_ag_ui" className="subgraphs-chat-window" />
      </div>
    </section>
  );
}
