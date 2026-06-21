"""
11 — Multi-tenancy: 사용자별 thread / store 격리 + JWT + rate limit.

핵심 원칙
---------
1. thread_id 는 반드시 `{user_id}:{conv_id}` 로 prefix → 다른 사용자가
   타인의 conv_id 를 추측해도 서버에서 user_id 불일치로 403.
2. Store namespace 는 `("memories", user_id)` — 메모리도 사용자 분리.
3. JWT (HS256) 로 user_id 추출. 토큰 없으면 401.
4. rate limit: 사용자별 시간당 N 회 (in-memory; TODO Redis 교체).

그래프 구조
-----------
START ─▶ agent ⇄ tools(remember, recall)
            │
            ▼
           END
"""
from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.store.base import BaseStore
from typing_extensions import Annotated

from common.llm import create_llm


@tool
def remember(
    key: str,
    value: str,
    config: Annotated[RunnableConfig, InjectedToolArg],
    store: Annotated[BaseStore, InjectedToolArg],
) -> str:
    """현재 사용자의 메모리에 (key, value) 를 저장."""
    user_id = (config.get("configurable") or {}).get("user_id")
    if not user_id:
        return "ERROR: missing user_id in config"
    store.put(("memories", user_id), key, {"value": value})
    return f"saved key={key} for user={user_id}"


@tool
def recall(
    key: str,
    config: Annotated[RunnableConfig, InjectedToolArg],
    store: Annotated[BaseStore, InjectedToolArg],
) -> str:
    """현재 사용자의 메모리에서 key 를 조회."""
    user_id = (config.get("configurable") or {}).get("user_id")
    if not user_id:
        return "ERROR: missing user_id in config"
    item = store.get(("memories", user_id), key)
    if item is None:
        return "(not found)"
    return str(item.value.get("value"))


TOOLS = [remember, recall]


def _agent_node(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    return {"messages": [llm.invoke(state["messages"])]}


def _should_continue(state: MessagesState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    # langgraph dev 는 checkpointer/store 자동 주입.
    # server.py 에서는 build_graph_with_storage(saver, store) 로 명시 부착.
    return builder.compile()


def build_graph_with_storage(checkpointer, store):
    """외부에서 주입한 checkpointer/store 로 그래프를 컴파일해 반환.

    server.py 가 PostgresSaver/PostgresStore 를 lifespan 에서 만들어
    이 함수에 넘긴다. 내부 함수(_agent_node 등) 직접 import 회피용 공개 인터페이스.
    """
    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile(checkpointer=checkpointer, store=store)


graph = build_graph()


__all__ = ["graph", "build_graph", "build_graph_with_storage", "TOOLS"]


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.store.memory import InMemoryStore

    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    standalone = builder.compile(
        checkpointer=MemorySaver(), store=InMemoryStore()
    )
    cfg = {"configurable": {"thread_id": "alice:c1", "user_id": "alice"}}
    out = standalone.invoke(
        {"messages": [HumanMessage(content="내 이름은 alice 라고 기억해줘")]},
        config=cfg,
    )
    print(out["messages"][-1].content)
