"""Example 21 — State snapshots, 수정, history, replay.

선행 개념
---------
- Example 20의 checkpointer와 ``thread_id``

새 개념
-------
- ``get_state(config)``로 최신 ``StateSnapshot`` 조회
- ``update_state(config, values, as_node=...)``로 새 checkpoint 생성
- ``get_state_history(config)``로 checkpoint history 조회
- 과거 snapshot의 ``config``를 다시 invoke해 그 지점에서 replay/fork

복습 개념
---------
- reducer, 직선 그래프, 동일 thread의 checkpoint 누적

``update_state``는 기존 checkpoint를 덮어쓰지 않는다. 새 checkpoint를 만들기 때문에
과거 snapshot은 history에 남는다. ``as_node="increment"``는 수정값을 increment
노드의 출력처럼 기록해 다음 노드인 double부터 이어갈 수 있게 한다.
"""

from operator import add
from typing import Annotated, TypedDict

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    value: int
    trace: Annotated[list[str], add]


def increment(state: State) -> dict:
    value = state.get("value", 0) + 1
    return {"value": value, "trace": [f"increment:{value}"]}


def double(state: State) -> dict:
    value = state["value"] * 2
    return {"value": value, "trace": [f"double:{value}"]}


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(State)
    builder.add_node("increment", increment)
    builder.add_node("double", double)
    builder.add_edge(START, "increment")
    builder.add_edge("increment", "double")
    builder.add_edge("double", END)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver

    standalone = build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "snapshot-demo"}}

    first = standalone.invoke({"value": 2, "trace": []}, config=config)
    latest = standalone.get_state(config)
    print("first:", first)  # value=6
    print("latest next:", latest.next)  # () because the run completed

    updated_config = standalone.update_state(
        config,
        {"value": 10, "trace": ["manual:10"]},
        as_node="increment",
    )
    updated = standalone.get_state(updated_config)
    print("after update next:", updated.next)  # ('double',)
    resumed = standalone.invoke(None, config=updated_config)
    print("resumed:", resumed)  # value=20

    history = list(standalone.get_state_history(config))
    print("history checkpoints:", len(history))

    original_increment = next(
        snapshot
        for snapshot in history
        if snapshot.values.get("value") == 3 and snapshot.next == ("double",)
    )
    replayed = standalone.invoke(None, config=original_increment.config)
    print("replayed:", replayed)  # original branch: value=6
