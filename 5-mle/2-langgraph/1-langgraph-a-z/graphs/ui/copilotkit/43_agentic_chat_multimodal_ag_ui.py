"""Example 43: multimodal AG-UI chat graph.

쉽게 이해하기
-------------
이미지 채팅은 글과 이미지 정보를 함께 읽어 답하는 대화다.
예: 첨부 이미지에서 보이는 항목을 설명해 달라고 요청한다.
이 그래프는 모델의 이미지 관찰을 도구 결과로 정리한다.

그래프 구조
-----------
첨부 이미지의 모델 관찰을 도구 결과로 정리해 답변하고, 이미지가 없으면 텍스트 요청 경로로 처리한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "No image is attached. Explain what this demo can do."
    }
  ]
}
```
관찰할 결과: describe_text_only_request의 텍스트 fallback을 확인합니다. 실제 이미지 연습은 UI 첨부 또는 유효한 image_url content block을 사용합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
# 예제 개요: 이미지 첨부 대화와 텍스트 전용 대화를 같은 agent로 처리합니다.
# 핵심 흐름: 모델이 파악한 이미지 관찰을 구조화된 도구 결과로 정리합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("record_image_observations")
def record_image_observations(subject: str, visible_text: str = "", colors: str = "") -> dict[str, Any]:
    """Record structured observations after inspecting an attached image."""
    clean_subject = subject.strip() or "attached image"
    return {
        "subject": clean_subject,
        "visible_text": visible_text.strip() or "No readable text reported.",
        "colors": colors.strip() or "No dominant colors reported.",
        "checks": [
            "main subject",
            "visible text",
            "layout or composition",
            "uncertainties",
        ],
    }


@tool("describe_text_only_request")
def describe_text_only_request(prompt: str) -> dict[str, Any]:
    """Handle text-only fallback requests in the same multimodal chat."""
    return {
        "prompt": prompt.strip() or "empty prompt",
        "mode": "text-only",
        "message": "No attachment is required for this response.",
    }


SYSTEM_PROMPT = (
    "You are a multimodal AG-UI chat assistant. If the user attaches an image, inspect it "
    "and summarize visible subject, text, colors, layout, and uncertainty. Then call "
    "record_image_observations with concise structured notes. If the message is text-only, "
    "call describe_text_only_request when useful and answer normally. Do not claim details "
    "that are not visible."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm("luna"),
        tools=[record_image_observations, describe_text_only_request],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
