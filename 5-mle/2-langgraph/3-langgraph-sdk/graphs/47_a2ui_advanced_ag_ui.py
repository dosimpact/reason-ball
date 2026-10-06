"""Example 47: CopilotKit AG-UI advanced A2UI graph."""
# 예제 개요: 진행 단계, 생성된 패널, 사용자 액션을 한 A2UI 결과로 묶습니다.
# 핵심 흐름: 진행과 선택지는 고정 샘플 데이터이며, 확인 액션은 프런트엔드 도구로 연결합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("build_advanced_a2ui")
def build_advanced_a2ui(request: str) -> dict[str, Any]:
    """Return dynamic A2UI, explicit progress, and action metadata."""
    return {
        "schema_version": "advanced-a2ui-v1",
        "request": request or "Plan an incident response review.",
        "progress": [
            {"id": "planning", "label": "Planning", "status": "completed", "detail": "Selected the workflow shape."},
            {"id": "fetching", "label": "Fetching", "status": "completed", "detail": "Loaded deterministic fixture data."},
            {"id": "composing", "label": "Composing", "status": "completed", "detail": "Built the generated UI payload."},
            {"id": "waiting", "label": "Waiting for action", "status": "active", "detail": "Frontend can confirm one option."},
        ],
        "panel": {
            "type": "decision_panel",
            "title": "Release decision",
            "summary": "The graph recommends a staged launch with explicit confirmation.",
            "options": [
                {"id": "approve-staged", "label": "Approve staged launch", "impact": "Low risk", "selected": True},
                {"id": "request-review", "label": "Request security review", "impact": "Adds one day", "selected": False},
                {"id": "hold-release", "label": "Hold release", "impact": "Blocks rollout", "selected": False},
            ],
        },
        "actions": [
            {
                "id": "confirm_advanced_selection",
                "label": "Confirm selection",
                "tool_name": "confirm_advanced_selection",
                "payload": {"selection_id": "approve-staged", "selection_label": "Approve staged launch"},
            }
        ],
        "final_summary": "Advanced A2UI payload includes progress, a generated decision panel, and a frontend action.",
    }


SYSTEM_PROMPT = (
    "You are the A2UI advanced demo agent. Always call build_advanced_a2ui before "
    "answering. After the tool returns, briefly explain the progress phases, the "
    "recommended generated UI, and the frontend confirmation action."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[build_advanced_a2ui],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
