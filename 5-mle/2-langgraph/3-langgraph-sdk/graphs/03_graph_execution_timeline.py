"""Example 03: multi-node graph for execution timeline visualisation."""
# 예제 개요: 입력 준비, 모델 호출, 결과 정리를 분리해 노드 실행 타임라인을 보여줍니다.
# 핵심 흐름: steps와 node_updates에 실행 기록을 남겨 UI가 단계별 변화를 표시합니다.

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
# TimelineState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
class TimelineState(TypedDict, total=False):
    topic: str
    prompt: str
    draft: str
    final: str
    steps: list[str]
    node_updates: list[dict[str, Any]]


def _append_update(
    state: TimelineState,
    *,
    node: str,
    status: str,
    detail: str,
) -> list[dict[str, Any]]:
    return state.get("node_updates", []) + [
        {"node": node, "status": status, "detail": detail}
    ]


# 입력 주제를 모델용 프롬프트로 바꾸고 준비 단계의 실행 기록을 남깁니다.
def prepare_topic(state: TimelineState) -> dict:
    topic = state.get("topic", "LangGraph SDK")
    prompt = (
        "Explain this topic for a developer learning LangGraph SDK UI patterns: "
        f"{topic}. Keep the answer under 40 words."
    )
    return {
        "topic": topic,
        "prompt": prompt,
        "steps": state.get("steps", []) + ["prepare_topic"],
        "node_updates": _append_update(
            state,
            node="prepare_topic",
            status="done",
            detail=f"Prepared prompt for topic: {topic}",
        ),
    }


# 현재 단계의 입력으로 모델을 호출하고 응답을 다음 노드가 사용할 상태로 반환합니다.
def call_model(state: TimelineState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the timeline example node. Produce a concise, concrete "
                    "developer-facing explanation."
                )
            ),
            HumanMessage(content=state["prompt"]),
        ]
    )
    draft = response.content if isinstance(response.content, str) else str(response.content)
    return {
        "draft": draft,
        "steps": state.get("steps", []) + ["call_model"],
        "node_updates": _append_update(
            state,
            node="call_model",
            status="done",
            detail="OpenAI model returned a draft explanation.",
        ),
    }


# 각 단계에서 만든 결과를 최종 응답과 UI 표시 상태로 정리합니다.
def finalize(state: TimelineState) -> dict:
    topic = state.get("topic", "LangGraph SDK")
    draft = state.get("draft", "")
    final = f"Timeline result for {topic}: {draft}"
    return {
        "final": final,
        "steps": state.get("steps", []) + ["finalize"],
        "node_updates": _append_update(
            state,
            node="finalize",
            status="done",
            detail="Final response assembled from graph state.",
        ),
    }


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(TimelineState)
    builder.add_node("prepare_topic", prepare_topic)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_topic")
    builder.add_edge("prepare_topic", "call_model")
    builder.add_edge("call_model", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    out = graph.invoke({"topic": "streaming graph updates", "steps": [], "node_updates": []})
    print(out["final"])
