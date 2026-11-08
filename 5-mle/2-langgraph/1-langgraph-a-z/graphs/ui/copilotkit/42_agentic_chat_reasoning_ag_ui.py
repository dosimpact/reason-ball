"""Example 42: AG-UI chat with public reasoning summaries.

쉽게 이해하기
-------------
공개 작업 요약은 사용자가 답변의 진행을 이해할 수 있도록 제공하는 설명이다.
예: 어떤 확인 단계를 거쳤는지 짧게 보여준다.
이 예제는 표시용 요약 도구와 고정 사실 카드를 사용한다.

그래프 구조
-----------
표시용 작업 요약과 고정 사실 카드를 도구로 제공하고, 이를 활용한 채팅 응답을 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Give a public summary of how you will explain checkpointing."
    }
  ]
}
```
관찰할 결과: publish_reasoning_summary/lookup_policy_fact 결과를 확인합니다. 비공개 모델 사고 과정이 아니라 공개 상태 요약입니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
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
        model=create_llm("luna"),
        tools=[publish_reasoning_summary, lookup_policy_fact],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
