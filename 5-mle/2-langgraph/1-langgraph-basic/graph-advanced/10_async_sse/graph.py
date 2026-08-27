"""
10 — Async ReAct + FastAPI SSE 토큰 스트리밍.

부모 `graph-basic/17_streaming.py` 는 동기 `graph.stream()` 을 CLI 에서 print 했을 뿐.
실제 서비스는 HTTP 위에서 토큰을 한 줄씩 client 에 흘려야 한다.

핵심
----
- 노드를 `async def` 로 정의하고 `llm.ainvoke()` 사용 → 이벤트 루프 점유 X
- `graph.astream(stream_mode="messages")` 로 토큰 단위 chunk 를 async iter
- FastAPI + sse-starlette 의 `EventSourceResponse` 로 SSE 송출

그래프 구조
-----------
START ─▶ agent ⇄ tools(get_time, calc)
            │
            ▼
           END

테스트 시나리오
---------------
▶ curl -N "http://localhost:8000/stream?q=langgraph%20에%20대해%20설명해줘"
▶ 브라우저: http://localhost:8000/  (static/index.html EventSource 데모)
"""
from __future__ import annotations

import datetime as _dt

from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm


@tool
def get_current_time() -> str:
    """현재 시각을 ISO 형식으로 반환한다."""
    return _dt.datetime.now().isoformat(timespec="seconds")


@tool
def calculate(expression: str) -> str:
    """간단한 산술식을 평가한다 (eval — 데모용)."""
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


TOOLS = [get_current_time, calculate]


async def _agent_node(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    msg = await llm.ainvoke(state["messages"])
    return {"messages": [msg]}


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
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    import asyncio

    from langchain_core.messages import HumanMessage

    async def _demo():
        async for chunk, meta in graph.astream(
            {"messages": [HumanMessage(content="지금 몇 시야?")]},
            stream_mode="messages",
        ):
            text = getattr(chunk, "content", "")
            if text:
                print(text, end="", flush=True)
        print()

    asyncio.run(_demo())
