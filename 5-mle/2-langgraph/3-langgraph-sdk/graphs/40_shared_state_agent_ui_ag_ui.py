"""Example 40: shared recipe state between an AG-UI agent and React UI."""

from __future__ import annotations

import json
from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


DEFAULT_RECIPE: dict[str, Any] = {
    "title": "Weeknight Chickpea Bowls",
    "servings": 2,
    "ingredients": [
        "1 can chickpeas",
        "1 cup cooked rice",
        "1 cucumber",
        "2 tbsp yogurt sauce",
    ],
    "instructions": [
        "Warm chickpeas with a pinch of salt and paprika.",
        "Divide rice, chickpeas, cucumber, and sauce between bowls.",
    ],
    "notes": "Keep it vegetarian and ready in 20 minutes.",
}


def _coerce_recipe(recipe_json: str | None) -> dict[str, Any]:
    if not recipe_json:
        return DEFAULT_RECIPE
    try:
        value = json.loads(recipe_json)
    except json.JSONDecodeError:
        return DEFAULT_RECIPE
    if not isinstance(value, dict):
        return DEFAULT_RECIPE
    return {**DEFAULT_RECIPE, **value}


@tool("suggest_recipe_patch")
def suggest_recipe_patch(recipe_json: str, request: str) -> dict[str, Any]:
    """Return a deterministic patch for the current shared recipe state."""
    recipe = _coerce_recipe(recipe_json)
    normalized = request.lower()
    patch: dict[str, Any] = {}

    if "serving" in normalized or "four" in normalized or "4" in normalized:
        patch["servings"] = 4
    if "protein" in normalized:
        patch["ingredients"] = list(recipe["ingredients"]) + ["1 cup roasted tofu"]
        patch["notes"] = "Added tofu for a higher-protein vegetarian version."
    elif "spicy" in normalized or "heat" in normalized:
        patch["ingredients"] = list(recipe["ingredients"]) + ["1 tsp chili crisp"]
        patch["notes"] = "Added chili crisp for gentle heat."
    elif "vegan" in normalized:
        patch["ingredients"] = [
            ingredient.replace("yogurt sauce", "tahini lemon sauce")
            for ingredient in recipe["ingredients"]
        ]
        patch["notes"] = "Swapped dairy for tahini lemon sauce."

    if not patch:
        patch["notes"] = f"Reviewed request: {request[:80]}. Keep the current recipe structure."

    return {
        "patch": patch,
        "summary": "Apply this patch with the frontend apply_recipe_patch tool if the user wants the UI state updated.",
    }


@tool("summarize_recipe_state")
def summarize_recipe_state(recipe_json: str) -> dict[str, Any]:
    """Summarize the recipe state the UI provided to the agent."""
    recipe = _coerce_recipe(recipe_json)
    return {
        "title": recipe["title"],
        "servings": recipe["servings"],
        "ingredient_count": len(recipe["ingredients"]),
        "instruction_count": len(recipe["instructions"]),
        "notes": recipe["notes"],
    }


SYSTEM_PROMPT = (
    "You are a recipe copilot for a LangGraph SDK AG-UI shared state demo. "
    "The React UI sends the current recipe through AG-UI context. When asked to inspect "
    "or modify the recipe, use summarize_recipe_state or suggest_recipe_patch. If a patch "
    "should update the UI, call the frontend tool named apply_recipe_patch with only the "
    "fields that changed. Keep responses concise and mention which shared state changed."
)


def build_graph():
    return create_agent(
        model=create_llm("fast"),
        tools=[suggest_recipe_patch, summarize_recipe_state],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
