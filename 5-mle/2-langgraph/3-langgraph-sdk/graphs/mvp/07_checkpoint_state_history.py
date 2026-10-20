"""Example 07: checkpointed state history with visible state mutations."""
# 예제 개요: 노드마다 상태 값을 바꾸어 체크포인트 이력과 상태 차이를 관찰하는 예제입니다.
# 핵심 흐름: history_events는 학습용 기록이며, 실제 체크포인트 저장은 서버 또는 checkpointer가 담당합니다.

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
# CheckpointHistoryState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
class CheckpointHistoryState(TypedDict, total=False):
    topic: str
    prompt: str
    draft: str
    final: str
    stage: str
    revision_count: int
    key_takeaways: list[str]
    history_events: list[dict[str, Any]]


def _append_event(
    state: CheckpointHistoryState,
    *,
    node: str,
    detail: str,
) -> list[dict[str, Any]]:
    events = state.get("history_events", [])
    return events + [
        {
            "index": len(events) + 1,
            "node": node,
            "detail": detail,
        }
    ]


def prepare_request(state: CheckpointHistoryState) -> dict:
    topic = state.get("topic", "checkpoint history for LangGraph debugging")
    prompt = (
        "Explain why checkpoint history helps debug LangGraph runs. "
        f"Focus on this topic: {topic}. Keep the answer under 50 words."
    )
    return {
        "topic": topic,
        "prompt": prompt,
        "stage": "prepared",
        "revision_count": 1,
        "history_events": _append_event(
            state,
            node="prepare_request",
            detail="Input normalized and model prompt prepared.",
        ),
    }


def draft_answer(state: CheckpointHistoryState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Checkpoint State History UI example. "
                    "Return a concise, concrete explanation for SDK learners."
                )
            ),
            HumanMessage(content=state["prompt"]),
        ]
    )
    draft = response.content if isinstance(response.content, str) else str(response.content)
    return {
        "draft": draft,
        "stage": "drafted",
        "revision_count": state.get("revision_count", 1) + 1,
        "history_events": _append_event(
            state,
            node="draft_answer",
            detail="OpenAI returned a draft explanation.",
        ),
    }


def finalize_answer(state: CheckpointHistoryState) -> dict:
    topic = state.get("topic", "checkpoint history")
    draft = state.get("draft", "")
    final = f"Checkpoint history for {topic}: {draft}"
    return {
        "final": final,
        "stage": "finalized",
        "revision_count": state.get("revision_count", 2) + 1,
        "key_takeaways": [
            "Each checkpoint captures state after a graph step.",
            "History lets the UI inspect older values without rerunning.",
            "Diffs make state changes easier to explain.",
        ],
        "history_events": _append_event(
            state,
            node="finalize_answer",
            detail="Final response and learning takeaways assembled.",
        ),
    }


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(CheckpointHistoryState)
    builder.add_node("prepare_request", prepare_request)
    builder.add_node("draft_answer", draft_answer)
    builder.add_node("finalize_answer", finalize_answer)
    builder.add_edge(START, "prepare_request")
    builder.add_edge("prepare_request", "draft_answer")
    builder.add_edge("draft_answer", "finalize_answer")
    builder.add_edge("finalize_answer", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver

    demo_builder = StateGraph(CheckpointHistoryState)
    demo_builder.add_node("prepare_request", prepare_request)
    demo_builder.add_node("draft_answer", draft_answer)
    demo_builder.add_node("finalize_answer", finalize_answer)
    demo_builder.add_edge(START, "prepare_request")
    demo_builder.add_edge("prepare_request", "draft_answer")
    demo_builder.add_edge("draft_answer", "finalize_answer")
    demo_builder.add_edge("finalize_answer", END)
    local = demo_builder.compile(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "checkpoint-demo"}}
    out = local.invoke({"topic": "debugging state changes"}, config=cfg)
    print(out["final"])
