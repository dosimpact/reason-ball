"""Example 23 — Static breakpoint (``interrupt_before``).

선행 개념
---------
- Checkpointer, state snapshot, 중단된 실행 재개

새 개념
-------
- ``compile(interrupt_before=["execute"])``로 노드 진입 직전 정지
- ``get_state(config).next``로 다음 실행 노드 확인
- 같은 thread에서 ``invoke(None, config)``로 그대로 계속 실행

복습 개념
---------
- ``thread_id``와 checkpoint 기반 실행 위치 보존

Static breakpoint는 payload나 사용자 결정을 모델링하는 승인 API가 아니라 실행 위치에
고정한 디버깅용 중단점이다. 승인/수정 같은 애플리케이션 흐름에는 Example 22의
``interrupt()``를 사용한다.

흐름: ``prepare -> [breakpoint] -> execute``
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    value: int
    prepared: bool
    result: int


def prepare(_: State) -> dict:
    return {"prepared": True}


def execute(state: State) -> dict:
    return {"result": state.get("value", 0) * 2}


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(State)
    builder.add_node("prepare", prepare)
    builder.add_node("execute", execute)
    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "execute")
    builder.add_edge("execute", END)
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["execute"],
    )


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver

    standalone = build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "static-breakpoint-demo"}}

    standalone.invoke({"value": 21}, config=config)
    snapshot = standalone.get_state(config)
    print("paused before:", snapshot.next)  # ('execute',)

    completed = standalone.invoke(None, config=config)
    print("result:", completed["result"])  # 42
