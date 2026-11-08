"""12 — 전문 서브에이전트

쉽게 이해하기
-------------
Subagent는 전체 작업 중 일부를 맡는 담당 agent다.
예: 부모가 analyst에게 수치 비교를 맡기고 결과를 받는다.
담당별로 모델·지침·도구를 따로 설정할 수 있다.

학습 목표: 부모와 다른 도구/모델/지침을 갖는 analyst에게 task로 위임.
실행: uv run --extra deep-agents python graphs/deep_agents/4-subagents_and_delegation/12_specialized_subagent.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
부모 agent가 analyst에게 수치 비교를 위임하고, analyst가 연습 자료 조회 도구로 차이와 출처를 확인한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "analyst에게 A와 B의 연습 수치를 비교하도록 위임해줘."
    }
  ]
}
```
관찰할 결과: task가 analyst에 위임되고 자식의 lookup_sample 도구와 출처 결과가 부모에게 반환됩니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from langchain_core.tools import tool

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "analyst에게 A와 B의 연습 수치를 비교하도록 위임해줘."


@tool
def lookup_sample() -> str:
    """고정된 연습 수치와 출처를 조회한다."""
    return "A=10, B=20; source=fixture://comparison"


def build_graph(model=None, child_model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [
                    call(
                        "task",
                        subagent_type="analyst",
                        description="lookup_sample을 호출해 A/B 차이를 보고해줘.",
                    )
                ]
            ]
        ),
        subagents=[
            {
                "name": "analyst",
                "description": "연습 수치 비교 분석 담당",
                "system_prompt": "lookup_sample로 수치를 확인하고 차이와 출처를 보고하세요.",
                "tools": [lookup_sample],
                "model": child_model
                or create_model(
                    [[call("lookup_sample")]],
                    answer="차이는 10. 출처는 fixture://comparison",
                ),
            }
        ],
        name="specialized_subagent",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
