"""15 — 도구 노출 제어

쉽게 이해하기
-------------
도구 선택 제어는 요청에 관련된 도구만 모델에게 보여주는 방식이다.
예: metric_17을 묻는 요청에는 그 업무 도구를 노출한다.
이 예제는 문자열 규칙으로 선택하며 파일 등 harness 도구는 유지한다.

학습 목표: 30개 업무 도구에서 요청과 맞는 하나만 노출하고 harness 도구는 유지.
실행: uv run --extra deep-agents python graphs/deep_agents/5-control_and_reliability/15_dynamic_tool_selection.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
요청 문자열에 맞는 업무 도구를 30개 중 선택해 모델에 노출하고, harness 도구를 유지한 채 호출한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "metric_17 도구로 값을 조회해줘."
    }
  ]
}
```
관찰할 결과: 30개 metric 도구 중 metric_17만 노출되고 read_file 등 harness 도구는 유지됩니다. 결정적 selector 예제입니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from langchain.agents.middleware import AgentMiddleware
from langchain_core.tools import StructuredTool

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "metric_17 도구로 값을 조회해줘."


def metric_tool(index):
    def lookup() -> str:
        return f"metric_{index:02d}={index * 10}"

    return StructuredTool.from_function(
        lookup, name=f"metric_{index:02d}", description=f"연습 지표 {index:02d} 조회"
    )


def selected_request(request):
    # 학습용 결정적 selector. 의미 검색/LLM selector로 교체할 위치다.
    # 후보 검색과 모델에 실제 노출하는 동작은 구분한다.
    text = " ".join(str(m.content) for m in request.messages if m.type == "human")
    requested = [f"metric_{i:02d}" for i in range(30) if f"metric_{i:02d}" in text]
    selected = requested or ["metric_17"]
    tools = [t for t in request.tools if not t.name.startswith("metric_") or t.name in selected]
    return request.override(tools=tools)


class SelectToolsMiddleware(AgentMiddleware):
    """CLI sync 실행과 Agent Server async 실행 모두 같은 선택 정책을 쓴다."""

    def wrap_model_call(self, request, handler):
        return handler(selected_request(request))

    async def awrap_model_call(self, request, handler):
        return await handler(selected_request(request))


def build_graph(model=None):
    return create_deep_agent(
        model=model or create_model([[call("metric_17")]]),
        tools=[metric_tool(i) for i in range(30)],
        middleware=[SelectToolsMiddleware()],
        name="dynamic_tool_selection",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
