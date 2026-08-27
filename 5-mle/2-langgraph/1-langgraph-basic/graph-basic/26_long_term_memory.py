"""Example 26 — Runtime context와 Store 기반 long-term memory.

선행 개념
---------
- Example 20의 thread-scoped checkpoint memory
- Example 11의 ``context_schema``와 ``Runtime``

새 개념
-------
- ``runtime.store``의 ``put`` / ``search``로 thread를 넘는 데이터 저장
- namespace로 사용자 격리, key와 search ``limit``의 의미

복습 개념
---------
- ``context_schema``, ``Runtime[Context]``, run-scoped ``user_id``
- run마다 전달하는 state와 장기 저장소의 역할 구분

같은 key에 ``put``하면 새 항목이 추가되는 것이 아니라 기존 항목이 갱신된다. 단순히
``fact[:64]``를 key로 쓰면 같은 접두사의 서로 다른 사실이 충돌할 수 있으므로, 이
예제는 전체 문자열의 SHA-256을 사용한다. 같은 사실을 다시 저장하면 같은 key가 되어
의도적으로 idempotent upsert가 된다.

``store.search(..., limit=N)``은 전체 개수가 아니라 최대 N개만 반환한다. 많은 기억을
모두 가져오려면 pagination이나 semantic query가 필요하다.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.store.base import BaseStore


@dataclass(frozen=True)
class Context:
    user_id: str


class State(TypedDict, total=False):
    fact: str
    limit: int
    saved_key: str
    recalled: list[str]


def _require_store(runtime: Runtime[Context]) -> BaseStore:
    if runtime.store is None:
        raise RuntimeError("This graph requires a Store")
    return runtime.store


def remember(state: State, runtime: Runtime[Context]) -> dict:
    fact = state.get("fact", "").strip()
    if not fact:
        return {}

    store = _require_store(runtime)
    namespace = ("memories", runtime.context.user_id)
    memory_key = sha256(fact.encode("utf-8")).hexdigest()
    store.put(namespace, memory_key, {"data": fact})
    return {"saved_key": memory_key}


def recall(state: State, runtime: Runtime[Context]) -> dict:
    store = _require_store(runtime)
    namespace = ("memories", runtime.context.user_id)
    limit = max(1, min(int(state.get("limit", 5)), 100))
    items = store.search(namespace, limit=limit)
    recalled = sorted(
        (str(item.value.get("data", "")) for item in items),
        key=str.casefold,
    )
    return {"recalled": recalled}


def build_graph(*, store: BaseStore | None = None):
    builder = StateGraph(State, context_schema=Context)
    builder.add_node("remember", remember)
    builder.add_node("recall", recall)
    builder.add_edge(START, "remember")
    builder.add_edge("remember", "recall")
    builder.add_edge("recall", END)
    return builder.compile(store=store)


# LangGraph API/Studio는 실행 환경의 Store를 Runtime에 주입한다.
graph = build_graph()


if __name__ == "__main__":
    from langgraph.store.memory import InMemoryStore

    standalone = build_graph(store=InMemoryStore())
    user_1 = Context(user_id="u1")
    user_2 = Context(user_id="u2")

    standalone.invoke({"fact": "favorite color is blue"}, context=user_1)
    standalone.invoke({"fact": "lives in Seoul"}, context=user_1)
    print(standalone.invoke({"limit": 10}, context=user_1)["recalled"])
    print(standalone.invoke({"limit": 10}, context=user_2)["recalled"])
