"""Example 46: CopilotKit AG-UI dynamic-schema A2UI graph.

쉽게 이해하기
-------------
동적 UI schema는 허용한 화면 종류 중 요청에 맞는 구성을 고르는 방식이다.
예: 비교 요청은 비교표로, 입력 요청은 폼으로 보여준다.
도구가 정해진 컴포넌트 집합에서 종류와 데이터를 선택한다.

그래프 구조
-----------
요청에 맞는 UI 종류를 허용된 컴포넌트 집합에서 선택하고, 동적 스키마와 표시 데이터를 생성한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Generate a dynamic table schema for a launch summary."
    }
  ]
}
```
관찰할 결과: generate_dynamic_schema의 selected_kind, schema_version과 데이터 payload를 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
# 예제 개요: 요청에 따라 허용된 컴포넌트 종류를 골라 동적 UI 스키마를 만듭니다.
# 핵심 흐름: 지원하지 않는 노드도 샘플에 포함하여 프런트엔드의 fallback 렌더링을 확인합니다.

from __future__ import annotations

from typing import Any, Literal

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


SchemaKind = Literal["form", "list", "comparison", "summary"]


def _choose_kind(request: str) -> SchemaKind:
    lowered = request.lower()
    if any(word in lowered for word in ("compare", "versus", "vs", "option")):
        return "comparison"
    if any(word in lowered for word in ("form", "intake", "collect", "fields")):
        return "form"
    if any(word in lowered for word in ("list", "todo", "tasks", "steps")):
        return "list"
    return "summary"


@tool("generate_dynamic_schema")
def generate_dynamic_schema(request: str) -> dict[str, Any]:
    """Generate a deterministic dynamic UI schema from an approved component set."""
    kind = _choose_kind(request or "")
    base = {
        "schema_version": "dynamic-a2ui-v1",
        "request": request or "Create a launch summary.",
        "selected_kind": kind,
        "stream_notes": [
            {"phase": "schema", "status": "completed", "detail": "Selected an approved renderer type."},
            {"phase": "data", "status": "completed", "detail": "Filled deterministic fixture data."},
        ],
    }

    if kind == "comparison":
        component = {
            "type": "comparison",
            "title": "Deployment options",
            "options": [
                {"id": "managed", "label": "Managed Cloud", "price": "$240/mo", "fit": "Fastest setup", "score": 91},
                {"id": "self-hosted", "label": "Self hosted", "price": "$120/mo", "fit": "More control", "score": 84},
                {"id": "hybrid", "label": "Hybrid", "price": "$180/mo", "fit": "Balanced rollout", "score": 88},
            ],
        }
    elif kind == "form":
        component = {
            "type": "form",
            "title": "Launch intake",
            "fields": [
                {"id": "owner", "label": "Owner", "value": "Platform team"},
                {"id": "deadline", "label": "Deadline", "value": "2026-07-01"},
                {"id": "risk", "label": "Highest risk", "value": "Unverified runtime wiring"},
            ],
        }
    elif kind == "list":
        component = {
            "type": "list",
            "title": "Implementation checklist",
            "items": [
                {"id": "schema", "label": "Validate schema", "status": "done"},
                {"id": "renderer", "label": "Render approved component", "status": "done"},
                {"id": "fallback", "label": "Show unsupported fallback", "status": "done"},
            ],
        }
    else:
        component = {
            "type": "summary",
            "title": "Generated summary panel",
            "stats": [
                {"label": "Components", "value": "1"},
                {"label": "Allowed types", "value": "4"},
                {"label": "Fallbacks", "value": "0"},
            ],
            "body": "The backend selected one whitelisted renderer and supplied sanitized props.",
        }

    return {
        **base,
        "components": [component],
        "unsupported": {
            "type": "timeline",
            "title": "Unsupported node",
            "reason": "The frontend intentionally renders this through a fallback.",
        },
        "final_summary": f"Generated a {kind} UI from an allowlisted schema.",
    }


SYSTEM_PROMPT = (
    "You are the A2UI dynamic schema demo agent. Always call generate_dynamic_schema "
    "before answering. Describe which whitelisted component type was selected and "
    "mention that unsupported nodes use a fallback renderer."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[generate_dynamic_schema],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
