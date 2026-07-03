"""비정형 입력을 정해진 스키마로 추출하는 구조화 출력 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_09_structured_output_extractor.app import (
    DEFAULT_MEETING_NOTE,
)
from langchain_lecture.projects_2.project_09_structured_output_extractor.extractor import (
    extract_meeting,
)


class StructuredExtractorState(TypedDict):
    text: NotRequired[str]
    extraction: NotRequired[dict[str, Any]]
    method: NotRequired[str]
    errors: NotRequired[list[str]]
    error: NotRequired[str]


def extract_node(state: StructuredExtractorState) -> dict[str, Any]:
    try:
        outcome = extract_meeting(state.get("text") or DEFAULT_MEETING_NOTE)
        return {
            "extraction": outcome.extraction.model_dump(mode="json"),
            "method": outcome.method,
            "errors": outcome.errors,
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(StructuredExtractorState)
builder.add_node("extract", extract_node)
builder.add_edge(START, "extract")
builder.add_edge("extract", END)

graph = builder.compile()
