"""Example 35: CopilotKit AG-UI agentic chat graph."""
# 예제 개요: CopilotKit과 연결한 기본 agent 채팅 및 날씨 도구 예제입니다.
# 핵심 흐름: 모델은 실제 호출하지만 날씨 도구는 외부 조회 없이 고정 샘플 값을 반환합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("get_weather")
def get_weather(location: str) -> dict[str, Any]:
    """Get weather for a location."""
    return {
        "city": location,
        "temperature": 20,
        "conditions": "sunny",
        "humidity": 50,
        "windSpeed": 10,
        "wind_speed": 10,
        "feelsLike": 25,
    }


SYSTEM_PROMPT = (
    "You are a helpful assistant. Use get_weather when the user asks about "
    "weather, and otherwise answer conversationally and concisely."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[get_weather],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
