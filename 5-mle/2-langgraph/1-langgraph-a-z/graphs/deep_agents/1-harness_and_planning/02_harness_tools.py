"""02 — Harness 기본 도구 관찰

쉽게 이해하기
-------------
Harness 기본 도구는 agent를 만들 때 실행 틀이 함께 제공하는 기능이다.
예: ls로 파일 목록을 보고 task로 다른 담당에게 일을 맡긴다.
직접 추가한 도구가 없어도 어떤 도구가 있는지 호출 결과로 확인한다.

학습 목표: 추가하지 않은 ls/task가 기본 도구에 포함되는지 실제 호출로 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/1-harness_and_planning/02_harness_tools.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
파일 목록을 조회하고 일반 담당 subagent에게 인사를 위임해, harness가 기본 제공하는 ls와 task 도구를 실행한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "루트 파일 목록을 조회하고, general-purpose에게 인사 한 문장을 위임해줘."
    }
  ]
}
```
관찰할 결과: 기본 ls/task 도구 호출과 general-purpose 자식 응답을 확인합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "루트 파일 목록을 조회하고, general-purpose에게 인사 한 문장을 위임해줘."


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [call("ls", path="/")],
                [
                    call(
                        "task",
                        subagent_type="general-purpose",
                        description="인사 한 문장만 반환해줘.",
                    )
                ],
            ]
        ),
        # 기본 subagent에도 같은 scripted 모델이 상속되면 재귀 위임한다.
        # 독립 모델을 명시하여 부모와 자식의 실행 범위를 분리한다.
        subagents=[
            {
                "name": "general-purpose",
                "description": "짧은 일반 작업 담당",
                "system_prompt": "짧게 인사하세요.",
                "model": create_model(answer="안녕하세요."),
                "tools": [],
            }
        ],
        name="harness_tools",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
