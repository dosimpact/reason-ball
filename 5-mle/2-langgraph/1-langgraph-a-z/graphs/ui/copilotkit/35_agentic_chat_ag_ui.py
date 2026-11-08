"""Example 35: CopilotKit AG-UI agentic chat graph.

쉽게 이해하기
-------------
AG-UI는 agent의 실행 소식을 화면과 주고받는 이벤트 형식이다.
예: 글 조각과 도구 호출을 채팅 화면에 표시한다.
여기서는 CopilotKit이 연결을 맡고 날씨 도구는 고정 연습 값을 반환한다.

그래프 구조
-----------
대화 요청에 따라 고정 날씨 자료를 반환하는 도구를 사용하고, AG-UI 채팅에 전달할 모델 응답을 생성한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "서울 날씨를 get_weather 도구로 알려줘."
    }
  ]
}
```
관찰할 결과: get_weather의 고정 날씨 payload와 최종 messages를 확인합니다. 실제 날씨 조회가 아닙니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
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
