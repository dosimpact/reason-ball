"""토큰과 이벤트를 스트리밍하는 챗봇 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_07_streaming_chatbot.streaming_chatbot import (
    collect_stream,
)
from langchain_lecture.shared.events import render_event


class StreamingChatbotState(TypedDict):
    question: NotRequired[str]
    answer: NotRequired[str]
    events: NotRequired[list[str]]
    error: NotRequired[str]


DEFAULT_QUESTION = "LangChain streaming을 5문장으로 설명해줘"


def streaming_chatbot_node(state: StreamingChatbotState) -> dict[str, Any]:
    try:
        response = collect_stream(state.get("question") or DEFAULT_QUESTION)
        return {
            "answer": response.answer,
            "events": [render_event(event) for event in response.events],
            "error": response.error,
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(StreamingChatbotState)
builder.add_node("streaming_chatbot", streaming_chatbot_node)
builder.add_edge(START, "streaming_chatbot")
builder.add_edge("streaming_chatbot", END)

graph = builder.compile()
