"""
Example 15 — Long-term memory (Store API).

`checkpointer` (06) 는 **하나의 thread** 에 묶인 상태를 저장하지만,
`BaseStore` 는 **thread 를 가로지르는** 영구 메모리(예: 사용자별 선호도, 과거 사실)를 다룹니다.

학습 포인트
-----------
- 노드 함수에 `store: BaseStore` 파라미터를 받으면 LangGraph 가 주입
- `store.put((namespace,...), key, value)` / `store.search((namespace,...))` API
- 네임스페이스를 (`"memories", user_id`) 처럼 튜플로 잡아 사용자별 격리
- langgraph dev / LangGraph Platform 으로 띄울 때,
  - 기본값은 InMemoryStore (dev 서버가 살아있는 동안만 유지, 재시작 시 전부 날아감)
  - LangGraph Platform(클라우드 배포) 에서는 관리형 Postgres 가 자동으로 붙음 → 이 때만 진짜 "DB 영속"
- 운영: `InMemoryStore`, `PostgresStore`, `RedisStore` 등으로 교체

그래프 구조
-----------
START ─▶ remember ─▶ recall ─▶ END

테스트 입력 예시 (state = {"user_id": str, "fact"?: str})
--------------------------------------------------------
같은 user_id 로 invoke 를 반복하면 store 에 누적됩니다 (thread 와 무관).

▶ 1단계 — 사실 저장 (각각 별도 invoke)
   - {"user_id": "u1", "fact": "도경's favorite color is blue."}
   - {"user_id": "u1", "fact": "도경 lives in Seoul."}
   - {"user_id": "u1", "fact": "도경 likes spicy food."}

▶ 2단계 — 같은 user_id 로 recall (fact 생략)
   - {"user_id": "u1"}                    → recalled = 위 3개 사실

▶ 3단계 — 다른 user_id 는 격리됨 (정상)
   - {"user_id": "u2"}                    → recalled = []
   - {"user_id": "u2", "fact": "u2 likes coffee."}
   - {"user_id": "u2"}                    → recalled = ["u2 likes coffee."]

※ Studio 에서는 InMemoryStore 가 dev 서버 재시작까지 유지됨
※ 단독 실행 (`python graph/15_long_term_memory.py`) 은 매번 초기화
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.store.base import BaseStore


class State(TypedDict, total=False):
    user_id: str
    fact: str            # 새로 저장할 사실 (선택)
    recalled: list[str]  # recall 결과


def remember(state: State, *, store: BaseStore) -> dict:
    """fact 가 주어지면 사용자 네임스페이스에 저장."""
    fact = state.get("fact")
    if not fact:
        return {}
    user_id = state["user_id"]
    namespace = ("memories", user_id)
    # key 는 사실 내용 해시 등 어떤 식별자든 가능 — 여기선 단순히 사실 자체
    store.put(namespace, fact[:64], {"data": fact})
    return {}


def recall(state: State, *, store: BaseStore) -> dict:
    """사용자의 모든 저장된 사실을 조회."""
    user_id = state["user_id"]
    namespace = ("memories", user_id)
    items = store.search(namespace)
    recalled = [it.value.get("data", "") for it in items]
    return {"recalled": recalled}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("remember", remember)
    builder.add_node("recall", recall)
    builder.add_edge(START, "remember")
    builder.add_edge("remember", "recall")
    builder.add_edge("recall", END)
    # 주의:
    # - LangGraph Platform / `langgraph dev` 에서는 store 가 자동 주입되므로
    #   여기서 compile(store=...) 하지 않는다.
    # - 단독 실행 시에는 __main__ 에서 InMemoryStore 를 부착해서 컴파일.
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.store.memory import InMemoryStore

    builder = StateGraph(State)
    builder.add_node("remember", remember)
    builder.add_node("recall", recall)

    builder.add_edge(START, "remember")
    builder.add_edge("remember", "recall")
    builder.add_edge("recall", END)
    
    standalone = builder.compile(store=InMemoryStore())

    # 1) 사실 저장
    standalone.invoke({"user_id": "u1", "fact": "도경's favorite color is blue."})
    standalone.invoke({"user_id": "u1", "fact": "도경 lives in Seoul."})
    # 2) 같은 user_id 로 recall (다른 invoke 호출이라도 store 는 공유)
    out = standalone.invoke({"user_id": "u1"})
    print("recalled:", out["recalled"])
    # 3) 다른 user_id 는 격리됨
    out2 = standalone.invoke({"user_id": "u2"})
    print("u2 recalled (should be empty):", out2["recalled"])
