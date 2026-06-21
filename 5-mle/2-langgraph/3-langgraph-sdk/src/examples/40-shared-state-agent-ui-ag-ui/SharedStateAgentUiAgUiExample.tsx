import { useMemo, useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useAgentContext,
  useConfigureSuggestions,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { ClipboardList, Plus, RefreshCcw, Save } from "lucide-react";
import { z } from "zod";

type RecipeState = {
  title: string;
  servings: number;
  ingredients: string[];
  instructions: string[];
  notes: string;
};

type ActivityEntry = {
  id: string;
  source: "ui" | "agent";
  detail: string;
};

const initialRecipe: RecipeState = {
  title: "Weeknight Chickpea Bowls",
  servings: 2,
  ingredients: ["1 can chickpeas", "1 cup cooked rice", "1 cucumber", "2 tbsp yogurt sauce"],
  instructions: [
    "Warm chickpeas with a pinch of salt and paprika.",
    "Divide rice, chickpeas, cucumber, and sauce between bowls.",
  ],
  notes: "Keep it vegetarian and ready in 20 minutes.",
};

const surfaceStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(320px, 0.9fr) minmax(360px, 1.1fr)",
  minHeight: 720,
} as const;

const panelStyle = {
  background: "#fbfcfb",
  border: "1px solid #cfd8d5",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
} as const;

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
} as const;

const inputStyle = {
  border: "1px solid #cfd8d5",
  borderRadius: 6,
  padding: "9px 10px",
  width: "100%",
} as const;

const buttonStyle = {
  alignItems: "center",
  border: "1px solid #9fb3ad",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
  padding: "9px 12px",
} as const;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function parseJsonResult(result: unknown): Record<string, unknown> {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseJsonResult(parsed);
    } catch {
      return { text: result };
    }
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return {};
}

function cleanLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function ChatWithRecipeState() {
  const [recipe, setRecipe] = useState<RecipeState>(initialRecipe);
  const [activity, setActivity] = useState<ActivityEntry[]>([
    { id: "ui-0", source: "ui", detail: "Loaded starter recipe state." },
  ]);

  const recipeContext = useMemo(
    () => ({
      example: "40-shared-state-agent-ui-ag-ui",
      recipe,
    }),
    [recipe],
  );

  useAgentContext({
    description: "Current editable recipe state shared by the React UI",
    value: recipeContext,
  });

  function record(source: ActivityEntry["source"], detail: string) {
    setActivity((current) => [{ id: `${source}-${current.length + 1}`, source, detail }, ...current].slice(0, 6));
  }

  function replaceRecipe(nextRecipe: RecipeState, detail: string, source: ActivityEntry["source"] = "ui") {
    setRecipe(nextRecipe);
    record(source, detail);
  }

  useFrontendTool(
    {
      name: "apply_recipe_patch",
      description: "Apply a structured patch to the shared recipe UI state.",
      parameters: z.object({
        title: z.string().optional(),
        servings: z.number().int().min(1).max(12).optional(),
        ingredients: z.array(z.string()).optional(),
        instructions: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
      handler: async (patch) => {
        const nextRecipe: RecipeState = {
          title: patch.title ?? recipe.title,
          servings: patch.servings ?? recipe.servings,
          ingredients: patch.ingredients ?? recipe.ingredients,
          instructions: patch.instructions ?? recipe.instructions,
          notes: patch.notes ?? recipe.notes,
        };
        replaceRecipe(nextRecipe, "Agent patch applied to shared recipe state.", "agent");
        return { status: "success", recipe: nextRecipe };
      },
    },
    [recipe],
  );

  useFrontendTool(
    {
      name: "read_recipe_state",
      description: "Read the current shared recipe UI state.",
      parameters: z.object({}),
      handler: async () => ({ status: "success", recipe }),
    },
    [recipe],
  );

  useRenderTool({
    name: "suggest_recipe_patch",
    parameters: z.object({
      recipe_json: z.string(),
      request: z.string(),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseJsonResult(result);
      const patch = parseJsonResult(parsed.patch);
      return (
        <div style={{ ...panelStyle, gap: 8 }} data-testid="recipe-patch-tool">
          <strong>{status === "complete" ? "Recipe patch suggested" : "Preparing recipe patch"}</strong>
          <span>{parameters.request || "Waiting for request..."}</span>
          {status === "complete" ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(patch, null, 2)}</pre> : null}
        </div>
      );
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Read recipe",
        message: "Read the current shared recipe state and summarize it.",
      },
      {
        title: "Make it spicy",
        message: `Use suggest_recipe_patch with recipe_json ${JSON.stringify(recipe)} and request "make it spicy", then apply the patch.`,
      },
    ],
    available: "always",
  });

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
        <CopilotChat agentId="shared_state_agent_ui" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function SharedStateAgentUiAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="shared_state_agent_ui">
      <ChatWithRecipeState />
    </CopilotKit>
  );
}
