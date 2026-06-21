"""
Graceful Degradation — Tool 실패 시 5가지 전략.

심화주제 §4 직접 구현. 외부 검색 tool 이 실패할 때 그래프 전체가 죽는 대신
사용자에게 "이 부분은 못 했지만 이만큼은 했어요" 를 줄 수 있는 패턴 모음.

본 파일은 4개의 작은 그래프를 한 번에 정의하고 dict 로 노출합니다.

전략 1) RetryPolicy            → graph_retry         (일시 오류만 자동 재시도)
전략 2) Tool 안 try/except     → graph_try_except    (예외를 결과 문자열로 변환)
전략 3) Fallback 체인          → graph_fallback      (primary → secondary → cached)
전략 4) Partial Result         → graph_partial       (map-reduce, 일부 실패 허용)

전략 5) LLM 재프롬프트 → LangGraph prebuilt `ToolNode` 가 자동 처리하므로 별도 그래프 생략 (README 참고).

기본 export `graph` 는 가장 종합적인 graph_fallback.
"""
from __future__ import annotations

import operator
import sys
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, Send

from flaky_tools import (
    COUNTERS,
    PermanentError,
    TransientError,
    always_failing_search,
    cached_answer,
    flaky_search,
    secondary_search,
    slow_then_ok_search,
)


# ---------------------------------------------------------------------------
# 공통 State
# ---------------------------------------------------------------------------
class SimpleState(TypedDict, total=False):
    query: str
    result: str
    used_strategy: str
    error: str


# ---------------------------------------------------------------------------
# 전략 1) RetryPolicy — 일시 오류만 자동 재시도
# ---------------------------------------------------------------------------
def _retry_node(state: SimpleState) -> dict:
    """flaky_search 를 호출. TransientError 발생 시 LangGraph 가 자동 재시도."""
    out = flaky_search.invoke({"query": state["query"]})
    return {"result": str(out), "used_strategy": "retry"}


def build_retry_graph():
    builder = StateGraph(SimpleState)
    builder.add_node(
        "search",
        _retry_node,
        retry_policy=RetryPolicy(
            retry_on=(TransientError,),
            max_attempts=4,
            initial_interval=0.1,
            backoff_factor=2.0,
        ),
    )
    builder.add_edge(START, "search")
    builder.add_edge("search", END)
    return builder.compile()


# ---------------------------------------------------------------------------
# 전략 2) Tool 안 try/except — 예외 → 결과 문자열
# ---------------------------------------------------------------------------
def _safe_search_node(state: SimpleState) -> dict:
    """always_failing_search 를 try/except 로 감싸 에러 메시지를 결과로."""
    try:
        out = always_failing_search.invoke({"query": state["query"]})
        return {"result": str(out), "used_strategy": "try_except"}
    except PermanentError as e:
        return {
            "result": f"(search unavailable: {type(e).__name__}: {e})",
            "used_strategy": "try_except",
            "error": str(e),
        }


def build_try_except_graph():
    builder = StateGraph(SimpleState)
    builder.add_node("search", _safe_search_node)
    builder.add_edge(START, "search")
    builder.add_edge("search", END)
    return builder.compile()


# ---------------------------------------------------------------------------
# 전략 3) Fallback 체인 — primary → secondary → cached
# ---------------------------------------------------------------------------
def _primary(state: SimpleState) -> dict:
    try:
        out = always_failing_search.invoke({"query": state["query"]})
        return {"result": str(out), "used_strategy": "primary"}
    except PermanentError as e:
        return {"error": f"primary: {e}"}


def _secondary(state: SimpleState) -> dict:
    try:
        out = secondary_search.invoke({"query": state["query"]})
        return {"result": str(out), "used_strategy": "secondary"}
    except Exception as e:
        return {"error": (state.get("error", "") + f" | secondary: {e}").strip(" |")}


def _cached(state: SimpleState) -> dict:
    out = cached_answer.invoke({"query": state["query"]})
    return {"result": str(out), "used_strategy": "cached"}


def _route_after_primary(state: SimpleState) -> Literal["secondary", "__end__"]:
    return "__end__" if state.get("result") else "secondary"


def _route_after_secondary(state: SimpleState) -> Literal["cached", "__end__"]:
    return "__end__" if state.get("result") else "cached"


def build_fallback_graph():
    builder = StateGraph(SimpleState)
    builder.add_node("primary", _primary)
    builder.add_node("secondary", _secondary)
    builder.add_node("cached", _cached)

    builder.add_edge(START, "primary")
    builder.add_conditional_edges(
        "primary", _route_after_primary, {"secondary": "secondary", "__end__": END}
    )
    builder.add_conditional_edges(
        "secondary", _route_after_secondary, {"cached": "cached", "__end__": END}
    )
    builder.add_edge("cached", END)
    return builder.compile()


# ---------------------------------------------------------------------------
# 전략 4) Partial Result — map-reduce 변형. 3개 검색 중 1개만 실패해도 부분 답변.
# ---------------------------------------------------------------------------
class PartialState(TypedDict, total=False):
    query: str
    topics: list[str]
    results: Annotated[list[dict[str, str]], operator.add]
    summary: str


_TOPIC_TOOLS = {
    "topic_a": flaky_search,         # retry 없으면 처음 실패
    "topic_b": always_failing_search,  # 항상 실패 → 부분 실패
    "topic_c": slow_then_ok_search,  # 항상 성공
}


def _fanout(state: PartialState) -> list[Send]:
    topics = state.get("topics") or list(_TOPIC_TOOLS.keys())
    return [Send("worker", {"query": state["query"], "topic": t}) for t in topics]


def _worker(payload: dict) -> dict:
    topic = payload["topic"]
    tool = _TOPIC_TOOLS[topic]
    try:
        out = tool.invoke({"query": payload["query"]})
        return {"results": [{"topic": topic, "info": str(out)}]}
    except Exception as e:
        return {"results": [{"topic": topic, "info": f"(failed: {type(e).__name__})"}]}


def _reduce(state: PartialState) -> dict:
    parts = state.get("results", [])
    succeeded = [r for r in parts if not r["info"].startswith("(failed")]
    failed = [r for r in parts if r["info"].startswith("(failed")]
    summary = (
        f"부분 응답: {len(succeeded)}/{len(parts)} 성공.\n"
        + "\n".join(f"- {r['topic']}: {r['info']}" for r in parts)
    )
    if failed:
        summary += f"\n실패한 토픽: {[r['topic'] for r in failed]}"
    return {"summary": summary}


def build_partial_graph():
    builder = StateGraph(PartialState)
    builder.add_node("worker", _worker)
    builder.add_node("reduce", _reduce)
    builder.add_conditional_edges(START, _fanout, ["worker"])
    builder.add_edge("worker", "reduce")
    builder.add_edge("reduce", END)
    return builder.compile()


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
graph_retry = build_retry_graph()
graph_try_except = build_try_except_graph()
graph_fallback = build_fallback_graph()
graph_partial = build_partial_graph()

# langgraph.json 의 기본 진입점 (가장 종합적인 fallback 체인)
graph = graph_fallback

GRAPHS: dict[str, Any] = {
    "retry": graph_retry,
    "try_except": graph_try_except,
    "fallback": graph_fallback,
    "partial": graph_partial,
}


if __name__ == "__main__":
    print("=" * 60, "\n[1] retry — flaky_search 처음 2회 실패 후 성공")
    COUNTERS.reset()
    out = graph_retry.invoke({"query": "langgraph"})
    print("  result:", out.get("result"))
    print("  history:", COUNTERS.history)

    print("=" * 60, "\n[2] try_except — 영구 실패를 결과 문자열로")
    COUNTERS.reset()
    out = graph_try_except.invoke({"query": "langgraph"})
    print("  result:", out.get("result"))

    print("=" * 60, "\n[3] fallback — primary 실패 → secondary 성공")
    COUNTERS.reset()
    out = graph_fallback.invoke({"query": "langgraph"})
    print("  result:", out.get("result"))
    print("  used_strategy:", out.get("used_strategy"))
    print("  history:", COUNTERS.history)

    print("=" * 60, "\n[4] partial — 3개 토픽 중 1개 실패해도 부분 응답")
    COUNTERS.reset()
    out = graph_partial.invoke({"query": "langgraph", "topics": list(_TOPIC_TOOLS.keys())})
    print(out.get("summary"))
