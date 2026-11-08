"""Example 40: shared recipe state between an AG-UI agent and React UI.

쉽게 이해하기
-------------
공유 state는 화면과 agent가 같은 작업 내용을 참고하는 것이다.
예: 사용자가 편집한 레시피를 agent가 읽고 수정안을 제안한다.
백엔드는 패치를 반환하고 화면의 apply_recipe_patch 도구가 반영한다.

그래프 구조
-----------
화면의 레시피 상태를 읽어 수정 패치를 제안하고, 프런트엔드 도구가 반영할 변경 데이터를 반환한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Change the current recipe to four servings."
    }
  ]
}
```
관찰할 결과: suggest_recipe_patch → apply_recipe_patch 프런트 도구를 통한 상태 반영을 확인합니다. 현재 recipe는 React가 context로 제공합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.

UI 협력 실습
-------------
React recipe → useAgentContext → suggest_recipe_patch → apply_recipe_patch → replaceRecipe 순서로 읽습니다. context 제공과 화면 변경은 별도 단계입니다. 동시 편집 충돌 보호와 영구 저장은 구현되어 있지 않습니다.
전체 실습: docs/stock/ui-learning-system.md (프로젝트 루트 기준).
"""
# 예제 개요: 레시피 UI 상태를 agent가 읽고 수정 패치를 제안하는 공유 상태 예제입니다.
# 핵심 흐름: 백엔드는 패치를 반환하며, 실제 화면 상태 반영은 프런트엔드 apply_recipe_patch 도구가 담당합니다.

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


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm("luna"),
        tools=[suggest_recipe_patch, summarize_recipe_state],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
