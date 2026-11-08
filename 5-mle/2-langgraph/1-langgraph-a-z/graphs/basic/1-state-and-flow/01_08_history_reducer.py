"""Example 01-08 — Reducer로 실행 history 누적.

쉽게 이해하기
-------------
실행 history는 어느 작업이 시작하고 끝났는지 state에 쌓는 기록이다.
예: normalize와 annotate가 각각 시작·종료 기록을 남겨 네 항목이 쌓인다.
with_history가 작업 함수를 감싸 시작·끝 기록을 더하고 reducer가 기존 이력에 합친다.

선행 개념
---------
- ``Annotated`` reducer와 여러 노드의 state update

새 개념
-------
- ``Annotated[list[dict], operator.add]`` append-only history
- decorator가 노드별 start/end entry를 state delta로 반환하는 계측 패턴
- state에 넣은 실행 기록이 최종 응답과 checkpoint에 함께 남는다는 점

그래프에는 ``normalize``와 ``annotate`` 두 노드가 있고 각 노드가 start/end 두 항목을
추가하므로 한 번의 invoke 결과에는 정확히 4개의 history 항목이 생긴다. 같은
checkpointer thread에서 다시 실행하면 기존 history 뒤에 4개가 더 붙는다.

이 패턴은 교육용 state-level trace다. 실행 실패 시 노드 update가 commit되지 않으므로
실패 로그까지 보장하는 observability 시스템은 아니다. 운영 추적에는 LangSmith나
구조화 로그를 함께 사용한다.

그래프 구조
-----------
입력 텍스트의 공백과 대소문자를 정리해 길이를 표시하고, 각 노드의 시작·종료 정보를 이력에 누적한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "  Hello   Graph  "
}
```
관찰할 결과: normalized="hello graph", result="hello graph (11 chars)", history에 normalize/annotate의 start/end 총 4개 기록이 생깁니다. 시간값은 실행마다 달라집니다.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from functools import wraps
from operator import add
from typing import Annotated, Any, TypedDict

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    text: str
    normalized: str
    result: str
    history: Annotated[list[dict[str, Any]], add]


Node = Callable[[State], dict[str, Any]]


def with_history(name: str) -> Callable[[Node], Node]:
    """성공한 노드 실행의 start/end 정보를 history delta로 추가한다."""

    def decorator(node: Node) -> Node:
        @wraps(node)
        def wrapped(state: State) -> dict[str, Any]:
            started_at = time.time()
            started_perf = time.perf_counter()
            output = node(state)
            entries = [
                {
                    "event": "start",
                    "node": name,
                    "ts": started_at,
                    "in_keys": sorted(key for key in state if key != "history"),
                },
                {
                    "event": "end",
                    "node": name,
                    "ts": time.time(),
                    "elapsed_ms": round(
                        (time.perf_counter() - started_perf) * 1000,
                        3,
                    ),
                    "out_keys": sorted(output),
                },
            ]
            return {**output, "history": entries}

        return wrapped

    return decorator


@with_history("normalize")
def normalize(state: State) -> dict[str, Any]:
    normalized = " ".join(state.get("text", "").split()).lower()
    return {"normalized": normalized}


@with_history("annotate")
def annotate(state: State) -> dict[str, Any]:
    normalized = state.get("normalized", "")
    return {"result": f"{normalized} ({len(normalized)} chars)"}


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(State)
    builder.add_node("normalize", normalize)
    builder.add_node("annotate", annotate)
    builder.add_edge(START, "normalize")
    builder.add_edge("normalize", "annotate")
    builder.add_edge("annotate", END)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"text": "  LangGraph   Makes State Explicit  "})
    print(output["result"])
    print("history entries:", len(output["history"]))
    for entry in output["history"]:
        print(entry)
