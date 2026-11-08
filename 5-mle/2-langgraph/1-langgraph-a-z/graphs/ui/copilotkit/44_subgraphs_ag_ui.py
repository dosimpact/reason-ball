"""Example 44: CopilotKit AG-UI subgraph coordination graph.

쉽게 이해하기
-------------
Subgraph 조정은 여러 담당 작업의 진행과 결과를 부모가 모으는 방식이다.
예: 조사와 검토 담당의 진행을 한 화면에 표시한다.
이 예제의 도구는 고정 worker 자료를 만들어 그 표시 방식을 연습한다.

그래프 구조
-----------
요청에 맞는 모의 worker 진행·결과 데이터를 도구로 만들어, 여러 담당 작업을 화면에서 표시하도록 전달한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Run the subgraph workers for a release readiness brief."
    }
  ]
}
```
관찰할 결과: run_subgraph_workers의 고정 worker 진행·결과 payload를 확인합니다. 실제 외부 worker 병렬 실행과 구분합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
# 예제 개요: 여러 워커의 진행과 부모 집계를 AG-UI에서 표시하는 예제입니다.
# 핵심 흐름: 도구가 고정 워커 결과를 구성하는 데모이며, 실제 하위 그래프나 병렬 작업을 실행하지 않습니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


def _preview(text: str, limit: int = 96) -> str:
    cleaned = " ".join(str(text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


# 하위 그래프의 실행 모양을 보여주는 고정 결과를 반환합니다. 실제 워커 그래프를 호출하지 않습니다.
@tool("run_subgraph_workers")
def run_subgraph_workers(task: str) -> dict[str, Any]:
    """Run deterministic worker subgraphs and aggregate their results."""
    prompt = _preview(task or "Prepare a release readiness brief for a LangGraph SDK demo.")
    workers = [
        {
            "id": "research_subgraph",
            "name": "Research subgraph",
            "task": "Collect the concrete facts needed for the answer.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Found three stable facts and one assumption to verify.",
            "result": f"Source task: {prompt}. Key fact: the user needs a concise AG-UI coordination demo.",
        },
        {
            "id": "analysis_subgraph",
            "name": "Analysis subgraph",
            "task": "Turn facts into risks, priorities, and ordering.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Ranked output quality ahead of breadth.",
            "result": "Recommendation: keep worker state explicit, deterministic, and easy to inspect.",
        },
        {
            "id": "writing_subgraph",
            "name": "Writing subgraph",
            "task": "Compose the parent-facing final response.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Drafted a short synthesis from the worker outputs.",
            "result": "Final response should name each worker contribution and the parent aggregation.",
        },
    ]
    return {
        "run_id": "subgraphs-demo-44",
        "task": prompt,
        "parent_state": {
            "route": "parallel_workers",
            "active_worker_count": len(workers),
            "aggregation_status": "completed",
        },
        "workers": workers,
        "failed_workers": [],
        "aggregate": (
            "The parent graph routed the task through research, analysis, and writing subgraphs, "
            "then aggregated their completed outputs into one response."
        ),
    }


SYSTEM_PROMPT = (
    "You are the Subgraphs AG-UI demo agent. For any user task, call "
    "run_subgraph_workers exactly once. After the tool returns, summarize the parent "
    "state, each worker result, and the aggregate in concise language."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[run_subgraph_workers],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
