import { CopilotChat } from "@copilotkit/react-core/v2";
import { ClipboardList, Plus, RefreshCcw, Save } from "lucide-react";
import { useSharedStateAgentUiAgUiChat } from "./useSharedStateAgentUiAgUiChat";
import { surfaceStyle, panelStyle, labelStyle, inputStyle, buttonStyle } from "./styles";
import { cleanLines, initialRecipe } from "./model";

export function SharedStateAgentUiAgUiChat() {
  const { recipe, activity, replaceRecipe } = useSharedStateAgentUiAgUiChat();

  return (
    <section style={surfaceStyle}>
      <div style={panelStyle} data-testid="shared-recipe-panel">
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <ClipboardList size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Shared Recipe State</h3>
        </div>

        <label style={labelStyle}>
          Title
          <input
            style={inputStyle}
            value={recipe.title}
            onChange={(event) => replaceRecipe({ ...recipe, title: event.target.value }, "UI edited the title.")}
          />
        </label>

        <label style={labelStyle}>
          Servings
          <input
            min={1}
            max={12}
            style={inputStyle}
            type="number"
            value={recipe.servings}
            onChange={(event) =>
              replaceRecipe({ ...recipe, servings: Number(event.target.value) || 1 }, "UI changed servings.")
            }
          />
        </label>

        <label style={labelStyle}>
          Ingredients
          <textarea
            rows={5}
            style={inputStyle}
            value={recipe.ingredients.join("\n")}
            onChange={(event) =>
              replaceRecipe({ ...recipe, ingredients: cleanLines(event.target.value) }, "UI edited ingredients.")
            }
          />
        </label>

        <label style={labelStyle}>
          Notes
          <textarea
            rows={4}
            style={inputStyle}
            value={recipe.notes}
            onChange={(event) => replaceRecipe({ ...recipe, notes: event.target.value }, "UI edited notes.")}
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            style={{ ...buttonStyle, background: "#174f8c", color: "#ffffff" }}
            type="button"
            onClick={() =>
              replaceRecipe(
                { ...recipe, ingredients: [...recipe.ingredients, "1 cup roasted tofu"] },
                "UI added roasted tofu.",
              )
            }
          >
            <Plus size={16} />
            Add protein
          </button>
          <button
            style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }}
            type="button"
            onClick={() => replaceRecipe(initialRecipe, "UI reset the shared recipe.")}
          >
            <RefreshCcw size={16} />
            Reset
          </button>
        </div>

        <div style={{ ...panelStyle, background: "#f4faf7" }}>
          <strong>Activity</strong>
          {activity.map((entry) => (
            <div key={entry.id} style={{ borderTop: "1px solid #d7dfdc", paddingTop: 8 }}>
              <span style={{ color: entry.source === "agent" ? "#174f8c" : "#5b6b66", fontWeight: 700 }}>
                {entry.source}
              </span>
              <p style={{ margin: "4px 0 0" }}>{entry.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, minHeight: 680 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Save size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Agent Collaboration</h3>
        </div>
        <CopilotChat agentId="40_shared_state_agent_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}
