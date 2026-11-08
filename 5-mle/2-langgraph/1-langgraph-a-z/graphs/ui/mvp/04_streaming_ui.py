"""Example 04: graph designed to compare LangGraph stream modes.

쉽게 이해하기
-------------
Streaming은 작업이 끝날 때까지 기다리지 않고 중간 결과를 차례로 받는 것이다.
예: 현재 처리 단계와 생성 중인 글을 화면에서 먼저 본다.
state 변경과 custom 진행 이벤트는 서로 다른 종류의 데이터로 보낸다.

그래프 구조
-----------
프롬프트 준비·모델 응답·마무리를 수행하며, 상태 변경과 별도의 진행 이벤트를 스트리밍한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "prompt": "Explain streaming modes in LangGraph.",
  "progress": []
}
```
관찰할 결과: progress와 final을 확인하고 stream의 values/updates/messages/custom 출력을 비교합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.

UI 협력 실습
-------------
messages·updates·values·custom을 다른 패널로 해석합니다. 직접 SDK 화면은 매 실행 새 thread를 만들고 React hook은 threadId를 유지합니다. 두 번 제출해 비교하세요.
전체 실습: docs/stock/ui-learning-system.md (프로젝트 루트 기준).
"""
# 예제 개요: 상태 업데이트와 사용자 정의 진행 이벤트를 함께 관찰하는 스트리밍 예제입니다.
# 핵심 흐름: get_stream_writer로 즉시 이벤트를 보내고, 반환값에는 완료된 상태를 기록합니다.

from __future__ import annotations

import time
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
# StreamingState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
class StreamingState(TypedDict, total=False):
    prompt: str
    prepared_prompt: str
    answer: str
    final: str
    progress: list[dict[str, Any]]


def _progress_event(node: str, phase: str, progress: float, detail: str) -> dict[str, Any]:
    return {
        "node": node,
        "phase": phase,
        "progress": progress,
        "detail": detail,
    }


def _append_progress(state: StreamingState, event: dict[str, Any]) -> list[dict[str, Any]]:
    return state.get("progress", []) + [event]


# 이번 실행의 입력과 진행 상태를 준비합니다.
def prepare_prompt(state: StreamingState) -> dict:
    prompt = state.get(
        "prompt",
        "Explain how LangGraph streaming helps a React UI.",
    )
    prepared_prompt = (
        "Answer for a developer learning LangGraph SDK streaming modes. "
        f"Prompt: {prompt}. Keep it under 55 words."
    )
    event = _progress_event(
        "prepare_prompt",
        "prepared",
        0.25,
        "Prompt normalized for the model call.",
    )
    get_stream_writer()(event)
    time.sleep(0.05)
    return {
        "prompt": prompt,
        "prepared_prompt": prepared_prompt,
        "progress": _append_progress(state, event),
    }


# 현재 단계의 입력으로 모델을 호출하고 응답을 다음 노드가 사용할 상태로 반환합니다.
def call_model(state: StreamingState) -> dict:
    start_event = _progress_event(
        "call_model",
        "model_start",
        0.5,
        "OpenAI call started.",
    )
    get_stream_writer()(start_event)

    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Streaming UI example. Explain concrete runtime "
                    "signals without exposing hidden reasoning."
                )
            ),
            HumanMessage(content=state["prepared_prompt"]),
        ]
    )
    answer = response.content if isinstance(response.content, str) else str(response.content)

    done_event = _progress_event(
        "call_model",
        "model_done",
        0.8,
        "OpenAI response received.",
    )
    get_stream_writer()(done_event)
    return {
        "answer": answer,
        "progress": _append_progress(state, start_event) + [done_event],
    }


# 각 단계에서 만든 결과를 최종 응답과 UI 표시 상태로 정리합니다.
def finalize(state: StreamingState) -> dict:
    event = _progress_event(
        "finalize",
        "complete",
        1.0,
        "Final state assembled.",
    )
    get_stream_writer()(event)
    final = f"Streaming UI result: {state.get('answer', '')}"
    return {
        "final": final,
        "progress": _append_progress(state, event),
    }


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(StreamingState)
    builder.add_node("prepare_prompt", prepare_prompt)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_prompt")
    builder.add_edge("prepare_prompt", "call_model")
    builder.add_edge("call_model", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    out = graph.invoke(
        {
            "prompt": "Explain streaming modes in LangGraph.",
            "progress": [],
        }
    )
    print(out["final"])
