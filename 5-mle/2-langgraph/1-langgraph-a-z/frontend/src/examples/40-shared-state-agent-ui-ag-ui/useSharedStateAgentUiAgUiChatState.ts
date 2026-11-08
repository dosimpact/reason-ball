import { useState } from "react";
import { type RecipeState, initialRecipe, type ActivityEntry } from "./model";

export function useSharedStateAgentUiAgUiChatState() {
  const [recipe, setRecipe] = useState<RecipeState>(initialRecipe);

  const [activity, setActivity] = useState<ActivityEntry[]>([
    { id: "ui-0", source: "ui", detail: "Loaded starter recipe state." },
  ]);

  function record(source: ActivityEntry["source"], detail: string) {
    setActivity((current) => [{ id: `${source}-${current.length + 1}`, source, detail }, ...current].slice(0, 6));
  }

  function replaceRecipe(nextRecipe: RecipeState, detail: string, source: ActivityEntry["source"] = "ui") {
    setRecipe(nextRecipe);
    record(source, detail);
  }

  return { recipe, activity, replaceRecipe };
}
