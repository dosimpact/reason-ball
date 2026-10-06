import { useMemo } from "react";
import { useAgentContext, useConfigureSuggestions, useFrontendTool, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { useSharedStateAgentUiAgUiChatState } from "./useSharedStateAgentUiAgUiChatState";
import { type RecipeState, suggestRecipePatchParameters } from "./model";
import { SuggestRecipePatchRenderer } from "./ToolRenderers";

export function useSharedStateAgentUiAgUiChat() {
  const { recipe, activity, replaceRecipe } = useSharedStateAgentUiAgUiChatState();

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
    parameters: suggestRecipePatchParameters,
    render: (props) => <SuggestRecipePatchRenderer {...props} />,
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

  return { recipe, activity, replaceRecipe };
}
