"""
Example 08 — Map-Reduce (Send API).

런타임에 결정되는 N 개의 항목을 **병렬로 분기**해서 처리한 뒤
다시 하나로 모으는(reduce) 패턴.

시나리오
--------
입력: `{"topics": ["langgraph", "bedrock", "fastapi"]}`


학습 포인트
-----------

1. 상태정의

class State(TypedDict, total=False):
    topics: list[str]
    # results: list[dict] ← reducer 없음
    results: Annotated[list[dict], operator.add]
    answer: str

# results: Annotated[list[dict], operator.add]
#         └────┬────┘  └─────┬─────┘  └────┬────┘
#           표준         값의 타입         이 키의 reducer
#           Python      (타입체커용)       (LangGraph 가 읽음)
#           기능
  • Annotated[X, Y] 는 Python 표준 — X 는 진짜 타입, Y 는 메타데이터.
  • 일반 코드에서 Y 는 무시되지만, LangGraph 는 Y 를 reducer 로 해석.

2. Send로 fan-out 동적 수행
- `from langgraph.constants import Send` — 동적 fan-out
-  conditional edge 에서 `[Send(...), Send(...), ...]` 를 반환하면 병렬 분기

3. aggregate 에서 reducer 로 합치기
- reducer 가 병합 (LangGraph 가 자동)
- 3개 worker 가 끝날 때까지 LangGraph 가 wait barrier 를 걸고, 모두 완료되면 operator.add 로 합침
- aggregate 진입 시 state (순서는 보장되지 않음, 인덱스 넣어서 순서 정렬 가능)
{
    "topics": ["langgraph", "bedrock", "fastapi"],
    "results": [
        {"topic": "langgraph", "info": "LangGraph is..."},
        {"topic": "bedrock",   "info": "Amazon Bedrock..."},
        {"topic": "fastapi",   "info": "FastAPI is..."},
    ],
}

그래프 구조
-----------
START ─▶ dispatch ─┬─▶ worker (topic_1) ─┐
                   ├─▶ worker (topic_2) ─┼─▶ aggregate ─▶ END
                   └─▶ worker (topic_N) ─┘

테스트 입력 예시 (state.topics: list[str])
-----------------------------------------
worker 가 lookup_info 를 호출하므로 인식되는 키워드를 섞으면 좋습니다.
인식 키워드: "langgraph", "bedrock", "fastapi"

- {"topics": ["langgraph", "bedrock", "fastapi"]}     ← 3-way 병렬 (정상 케이스)
- {"topics": ["langgraph"]}                            ← 단일 (fan-out=1 동작 확인)
- {"topics": ["bedrock", "unknown_topic"]}             ← 한쪽은 "No specific information"
- {"topics": ["langgraph", "langgraph", "bedrock"]}    ← 동일 토픽 중복 — reducer append 확인
- {"topics": []}                                       ← 빈 리스트 → fan-out 안 일어남, aggregate 가 빈 answer
"""

import operator
from typing import Annotated, TypedDict

from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from common.tools import lookup_info


class State(TypedDict, total=False):
    topics: list[str]
    # 동시에 실행되는 worker 들이 자기 결과를 append → operator.add 가 list 들을 합쳐준다
    results: Annotated[list[dict], operator.add]
    answer: str


class WorkerInput(TypedDict):
    topic: str


def dispatch(state: State) -> dict:
    """초기 상태 확인용 noop. 실제 fan-out 은 conditional edge 에서 일어남."""
    return {}


def fanout(state: State) -> list[Send]:
    """각 topic 을 독립된 worker 호출로 변환."""
    return [Send("worker", {"topic": t}) for t in state.get("topics", [])]


def worker(payload: WorkerInput) -> dict:
    """단일 topic 에 대한 정보 조회."""
    info = lookup_info.invoke({"topic": payload["topic"]})
    return {"results": [{"topic": payload["topic"], "info": info}]}


def aggregate(state: State) -> dict:
    """병렬 결과를 하나의 답변 문자열로 결합."""
    lines = [f"- {r['topic']}: {r['info']}" for r in state.get("results", [])]
    return {"answer": "\n".join(lines)}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("dispatch", dispatch)
    builder.add_node("worker", worker)
    builder.add_node("aggregate", aggregate)

    builder.add_edge(START, "dispatch")
    # dispatch → (Send 들) → 각 worker 인스턴스가 병렬 실행
    builder.add_conditional_edges("dispatch", fanout, ["worker"])
    builder.add_edge("worker", "aggregate")
    builder.add_edge("aggregate", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"topics": ["langgraph", "bedrock", "fastapi"]})
    print(out["answer"])
