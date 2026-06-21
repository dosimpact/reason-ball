"""
Example 18 — Custom streaming (`get_stream_writer`).

07 의 `stream_mode` 는 LangGraph 가 자동으로 emit 하는 이벤트(updates / values / messages)
지만, **노드 안에서 직접 임의의 진행률 / 디버깅 이벤트** 를 흘려보내고 싶을 때 사용하는
`get_stream_writer()` 패턴입니다.

학습 포인트
-----------
- `from langgraph.config import get_stream_writer`
- 노드 안에서 `writer = get_stream_writer(); writer({"phase": "downloading"})`
- 클라이언트는 `graph.stream(input, stream_mode="custom")` 으로 수신
- 여러 stream_mode 를 동시에 받으려면 `stream_mode=["updates","custom"]`

그래프 구조
-----------
START ─▶ download ─▶ process ─▶ upload ─▶ END
   각 노드가 "phase / progress" 이벤트를 직접 emit

테스트 입력 예시 (state.item_id: str)
------------------------------------
이 그래프는 결정론적이라 item_id 값 자체는 결과에만 영향. 핵심은 **stream 모드**.

- {"item_id": "abc-123"}
- {"item_id": "user-42"}
- {"item_id": "task-001"}

확인 포인트 (CLI)
   1) custom 만:
      for evt in graph.stream({"item_id": "abc"}, stream_mode="custom"):
          print(evt)
      → {"node":"download","progress":0.33,...}
        {"node":"process","phase":"start"}
        ... 등

   2) updates + custom 동시:
      for mode, evt in graph.stream(
          {"item_id": "abc"}, stream_mode=["updates", "custom"]
      ):
          print(mode, evt)

Studio 사용
   - Studio 는 자동으로 stream 이벤트를 표시. 노드 카드 옆에 progress / phase 페이로드가 흐르는 것을 확인.
"""

from __future__ import annotations

import time
from typing import TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    item_id: str
    result: str


def download(state: State) -> dict:
    writer = get_stream_writer()
    for i in range(1, 4):
        writer({"node": "download", "progress": i / 3, "msg": f"chunk {i}/3"})
        time.sleep(0.5)  # 데모용 지연
    return {}


def process(state: State) -> dict:
    writer = get_stream_writer()
    writer({"node": "process", "phase": "start"})
    time.sleep(0.5)
    writer({"node": "process", "phase": "transform"})
    time.sleep(0.5)
    writer({"node": "process", "phase": "validate"})
    return {}


def upload(state: State) -> dict:
    writer = get_stream_writer()
    writer({"node": "upload", "msg": "uploading..."})
    time.sleep(0.5)
    writer({"node": "upload", "msg": "done"})
    return {"result": f"processed:{state.get('item_id', 'unknown')}"}


def build_graph():
    builder = StateGraph(State)

    builder.add_node("download", download)
    builder.add_node("process", process)
    builder.add_node("upload", upload)

    builder.add_edge(START, "download")
    builder.add_edge("download", "process")
    builder.add_edge("process", "upload")
    builder.add_edge("upload", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print("=== stream_mode='custom' ===")
    for evt in graph.stream({"item_id": "abc-123"}, stream_mode="custom"):
        print(" ", evt)

    print("\n=== stream_mode=['updates','custom'] ===")
    for mode, evt in graph.stream(
        {"item_id": "abc-123"}, stream_mode=["updates", "custom"]
    ):
        print(f"  [{mode}] {evt}")
