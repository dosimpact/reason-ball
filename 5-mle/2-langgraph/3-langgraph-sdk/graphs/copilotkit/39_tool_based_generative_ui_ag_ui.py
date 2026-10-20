"""Example 39: CopilotKit AG-UI tool-based generative UI graph."""
# 예제 개요: 도구 출력의 시 문구와 색상 정보를 카드 UI로 렌더링합니다.
# 핵심 흐름: 도구는 입력 주제와 분위기를 반영한 고정 형식 데이터를 반환하고 agent는 이를 설명합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("generate_haiku_card")
def generate_haiku_card(topic: str, mood: str = "calm") -> dict[str, Any]:
    """Generate a deterministic haiku card payload for frontend rendering."""

    clean_topic = topic.strip() or "LangGraph"
    clean_mood = mood.strip() or "calm"

    return {
        "topic": clean_topic,
        "mood": clean_mood,
        "palette": {
            "background": "#f7efe2",
            "accent": "#256f68",
            "text": "#1d2b2a",
        },
        "lines": [
            f"{clean_topic[:18]} wakes",
            "Signals flow through patient graphs",
            "Small tools shape the screen",
        ],
        "explanation": (
            "The backend tool returns the haiku, visual palette, and explanation "
            "as structured UI data."
        ),
    }


SYSTEM_PROMPT = (
    "You are the tool-based generative UI demo agent. When the user asks for a "
    "haiku, poem card, generated card, mood card, or visual poem, always call "
    "generate_haiku_card. After the tool returns, summarize the card mood in one "
    "short sentence. For unrelated questions, answer briefly."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[generate_haiku_card],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
