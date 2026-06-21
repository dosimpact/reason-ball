"""
06 — Postgres Checkpointer 로 영속 멀티턴 대화.

부모 `graph/06_checkpointer.py` 의 MemorySaver 를 PostgresSaver 로 교체.
컨테이너/프로세스 재시작 후에도 thread_id 단위 대화 히스토리가 유지된다.

핵심 메커니즘
-------------
- `langgraph-checkpoint-postgres` 의 `PostgresSaver` 가 SQL 테이블에 체크포인트 저장
- `setup()` 한 번 호출로 스키마 자동 마이그레이션
- 단독 실행: `__main__` 에서 명시적으로 PostgresSaver 부착
- `langgraph dev`: 플랫폼이 자동 주입하므로 기본 build_graph() 는 checkpointer 없이 컴파일

그래프 구조 (03 / 06 동일)
-----------
START ─▶ agent ⇄ tools ─▶ END

테스트 시나리오
---------------
1) docker compose up -d  # postgres 기동
2) python graph.py       # 1턴/2턴 실행 → "도경" 으로 답
3) docker compose restart postgres
4) python graph.py --replay  # 재시작 후에도 thread 가 살아있는지 확인
"""
from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm
from tools import TOOLS
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from langgraph.prebuilt import ToolNode


SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Use tools when appropriate. "
    "Remember context from earlier in the conversation."
)


def _make_call_model(llm: BaseChatModel, tools: list[BaseTool]):
    bound = llm.bind_tools(tools)

    def call_model(state: MessagesState) -> dict:
        msgs = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        return {"messages": [bound.invoke(msgs)]}

    return call_model


def _should_continue(state: MessagesState):
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "__end__"


def _builder() -> StateGraph:
    llm = create_llm()
    b = StateGraph(MessagesState)
    b.add_node("agent", _make_call_model(llm, TOOLS))
    b.add_node("tools", ToolNode(TOOLS))
    b.add_edge(START, "agent")
    b.add_conditional_edges("agent", _should_continue, {"tools": "tools", "__end__": END})
    b.add_edge("tools", "agent")
    return b


def build_graph():
    """`langgraph dev` 진입점. 플랫폼이 checkpointer 를 자동 주입."""
    return _builder().compile()


graph = build_graph()


# ---------------------------------------------------------------------------
# 단독 실행 헬퍼 — PostgresSaver 직접 부착
# ---------------------------------------------------------------------------
def _db_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL 미설정. .env.example 을 참고해 .env 를 만들거나 "
            "DATABASE_URL=postgresql://langgraph:langgraph@localhost:5432/langgraph 를 export."
        )
    return url


@contextmanager
def compiled_with_postgres() -> Iterator:
    """PostgresSaver 가 부착된 standalone 그래프를 yield."""
    from langgraph.checkpoint.postgres import PostgresSaver

    with PostgresSaver.from_conn_string(_db_url()) as saver:
        saver.setup()  # idempotent — 첫 실행 시 테이블 생성
        yield _builder().compile(checkpointer=saver)


if __name__ == "__main__":
    import sys
    from langchain_core.messages import HumanMessage

    cfg = {"configurable": {"thread_id": "user-42"}}

    if "--replay" in sys.argv:
        # 재시작 후 동일 thread_id 로 호출 → 이전 대화 복원 검증
        with compiled_with_postgres() as g:
            out = g.invoke(
                {"messages": [HumanMessage(content="내 이름이 뭐였지?")]}, config=cfg
            )
            print("[REPLAY]", out["messages"][-1].content)
    else:
        with compiled_with_postgres() as g:
            g.invoke(
                {"messages": [HumanMessage(content="내 이름은 도경이야.")]}, config=cfg
            )
            out = g.invoke(
                {"messages": [HumanMessage(content="내 이름이 뭐였지?")]}, config=cfg
            )
            print("[TURN-2]", out["messages"][-1].content)
            print("\n다음 명령으로 영속성 검증:")
            print("  docker compose restart postgres")
            print("  python graph.py --replay")
