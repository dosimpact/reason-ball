"""Example 42: AG-UI chat with public reasoning summaries."""
# 예제 개요: agent의 공개 작업 요약을 별도 UI로 보여주는 예제입니다.
# 핵심 흐름: 요약 도구의 고정 단계와 사실 카드는 사용자용 설명이며 비공개 내부 추론이 아닙니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("publish_reasoning_summary")
def publish_reasoning_summary(task: str) -> dict[str, Any]:
    """Return a safe, public reasoning summary for the requested task."""
    topic = task.strip() or "the user request"
    return {
        "title": f"Public reasoning summary for {topic[:48]}",
        "steps": [
            "Identify the user-visible goal.",
            "Check whether a tool or direct answer is needed.",
            "Return a concise answer and separate any tool result from the final response.",
        ],
        "safety_note": "This is a public summary, not hidden chain-of-thought.",
    }


@tool("lookup_policy_fact")
def lookup_policy_fact(topic: str) -> dict[str, Any]:
    """Return a deterministic fact card used by the reasoning UI demo."""
    normalized = topic.strip() or "AG-UI reasoning"
    return {
        "topic": normalized,
        "fact": "Reasoning UI should expose concise public status summaries, not hidden chain-of-thought.",
        "confidence": 0.99,
    }


SYSTEM_PROMPT = (
    "You are an AG-UI reasoning demo assistant. When the user asks how you will solve "
    "something, call publish_reasoning_summary and show only a concise public summary. "
    "Never reveal hidden chain-of-thought. If the user asks for policy or implementation "
    "details, call lookup_policy_fact. Keep final answers separate from tool activity."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm("fast"),
        tools=[publish_reasoning_summary, lookup_policy_fact],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
