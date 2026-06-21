"""
시멘틱 캐시 — 의미 기반 응답 캐싱.

심화주제 §1 의 직접 구현. 같은 의미의 질문이 들어오면 임베딩 코사인 유사도로
이전 응답을 재사용해 LLM 호출 비용을 절감합니다.

핵심 메커니즘
-------------
- 질문을 임베딩 → 캐시에 저장된 (vec, answer) 와 코사인 유사도 비교
- threshold(기본 0.95) 이상이면 cache hit → LLM 호출 생략
- miss 시 ReAct agent 실행 후 결과를 캐시에 저장

그래프 구조
-----------
START ─▶ cache_lookup ──hit──▶ END
              │miss
              ▼
            agent ⇄ tools
              │
              ▼
         cache_store ─▶ END

테스트 시나리오
---------------
같은 의미 질문 3개를 차례로 invoke 하면 첫 호출만 miss, 나머지는 hit:
  1) "지금 몇 시야"
  2) "현재 시간 알려줘"
  3) "What time is it"
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from embedder import embed_text
from cache_store import SemanticCache
from tools import TOOLS

_CACHE = SemanticCache(threshold=0.95)


class State(MessagesState):
    cache_hit: bool
    query_vec: list[float]
    user_query: str


def _last_user_text(state: MessagesState) -> str:
    for m in reversed(state["messages"]):
        if isinstance(m, HumanMessage):
            content = m.content
            if isinstance(content, list):
                return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            return str(content)
    return ""


def cache_lookup(state: State) -> dict[str, Any]:
    """질문 임베딩으로 캐시 조회. hit 이면 응답 메시지를 그대로 추가."""
    query = _last_user_text(state)
    if not query:
        return {"cache_hit": False, "user_query": "", "query_vec": []}

    vec = embed_text(query)
    hit = _CACHE.lookup(vec)
    if hit is not None:
        score, answer = hit
        print(f"[cache] HIT  score={score:.4f}  q={query!r}")
        return {
            "cache_hit": True,
            "user_query": query,
            "query_vec": vec,
            "messages": [AIMessage(content=answer)],
        }
    print(f"[cache] MISS                q={query!r}")
    return {"cache_hit": False, "user_query": query, "query_vec": vec}


def route_after_lookup(state: State) -> Literal["agent", "__end__"]:
    return "__end__" if state.get("cache_hit") else "agent"


def make_agent_node():
    llm = create_llm().bind_tools(TOOLS)
    system = SystemMessage(
        content=(
            "You are a helpful assistant. Use tools when needed. "
            "Answer concisely in the user's language."
        )
    )

    def call_model(state: MessagesState) -> dict:
        response = llm.invoke([system] + state["messages"])
        return {"messages": [response]}

    return call_model


def should_continue(state: MessagesState) -> Literal["tools", "cache_store"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "cache_store"


def cache_store(state: State) -> dict[str, Any]:
    """최종 AI 응답을 캐시에 저장."""
    query = state.get("user_query") or _last_user_text(state)
    vec = state.get("query_vec") or []
    last = state["messages"][-1]
    answer = last.content if isinstance(last, AIMessage) else ""
    if isinstance(answer, list):
        answer = " ".join(b.get("text", "") for b in answer if isinstance(b, dict))
    if query and vec and answer:
        _CACHE.add(vec, str(answer))
        print(f"[cache] STORE size={len(_CACHE)}  q={query!r}")
    return {}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("cache_lookup", cache_lookup)
    builder.add_node("agent", make_agent_node())
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_node("cache_store", cache_store)

    builder.add_edge(START, "cache_lookup")
    builder.add_conditional_edges(
        "cache_lookup", route_after_lookup, {"agent": "agent", "__end__": END}
    )
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "cache_store": "cache_store"}
    )
    builder.add_edge("tools", "agent")
    builder.add_edge("cache_store", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    queries = [
        "지금 몇 시야",
        "현재 시간 알려줘",
        "What time is it",
    ]
    for q in queries:
        out = graph.invoke({"messages": [HumanMessage(content=q)]})
        print(f"  → {out['messages'][-1].content}\n")
    print(f"final cache size = {len(_CACHE)}")
