"""Example 38: CopilotKit AG-UI agentic generative UI graph."""
# 예제 개요: 도구가 작업 공간의 섹션과 체크리스트를 반환하는 생성형 UI 예제입니다.
# 핵심 흐름: 화면 자체를 실행하지 않고, 고정 규칙으로 만든 구조화 데이터를 프런트엔드에 전달합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("build_task_workspace")
def build_task_workspace(request: str) -> dict[str, Any]:
    """Build a deterministic task workspace payload for generative UI rendering."""

    topic = request.strip() or "LangGraph SDK onboarding"
    sections = [
        {
            "heading": "Objective",
            "content": f"Create a compact execution workspace for: {topic}.",
        },
        {
            "heading": "Implementation Notes",
            "content": (
                "Use the SDK client, stream progress visibly, and keep backend "
                "state as the source of truth for UI snapshots."
            ),
        },
        {
            "heading": "Verification",
            "content": (
                "Run a deterministic prompt, confirm each step is rendered, and "
                "verify the final artifact remains visible after completion."
            ),
        },
    ]

    return {
        "version": 1,
        "title": "Generated task workspace",
        "status": "complete",
        "activeStep": "Verify",
        "progress": 100,
        "checklist": [
            {"label": "Decompose request", "state": "complete"},
            {"label": "Draft workspace sections", "state": "complete"},
            {"label": "Verify generated UI payload", "state": "complete"},
        ],
        "sections": sections,
        "summary": f"Workspace ready for {topic}.",
    }


SYSTEM_PROMPT = (
    "You are the agentic generative UI demo agent. When the user asks you to "
    "plan, generate, build, decompose, or create a workspace, always call "
    "build_task_workspace with the user's request. Then explain in one concise "
    "sentence that the generated workspace is ready. For unrelated questions, "
    "answer briefly."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[build_task_workspace],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
