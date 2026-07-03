"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_12_langsmith_observability_eval.app import (
    answer_question,
)


class ObservabilityEvalState(TypedDict):
    question: NotRequired[str]
    prompt_variant: NotRequired[str]
    answer: NotRequired[str]
    sources: NotRequired[list[str]]
    trace_id: NotRequired[str]
    langsmith_usable: NotRequired[bool]
    events: NotRequired[list[str]]
    error: NotRequired[str]


DEFAULT_QUESTION = "What does a LangSmith trace show?"


def answer_with_observability_node(state: ObservabilityEvalState) -> dict[str, Any]:
    try:
        observed = answer_question(
            state.get("question") or DEFAULT_QUESTION,
            prompt_variant=state.get("prompt_variant") or "baseline",
        )
        return {
            "answer": observed.answer,
            "sources": observed.sources,
            "trace_id": observed.trace_id,
            "langsmith_usable": observed.langsmith.usable,
            "events": [event.name for event in observed.events],
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(ObservabilityEvalState)
builder.add_node("answer_with_observability", answer_with_observability_node)
builder.add_edge(START, "answer_with_observability")
builder.add_edge("answer_with_observability", END)

graph = builder.compile()
