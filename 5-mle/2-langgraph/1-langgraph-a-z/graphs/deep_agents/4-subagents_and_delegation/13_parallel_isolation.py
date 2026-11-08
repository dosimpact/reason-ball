"""13 — 병렬 위임과 컨텍스트 격리

쉽게 이해하기
-------------
병렬 위임은 여러 담당자에게 한 번에 작업을 보내는 것이다.
예: 조사와 검토를 동시에 요청하고 결과를 모은다.
각 담당의 대화는 나뉘며 파일 공유 여부는 backend 구성에 따른다.

학습 목표: 한 라운드의 task 두 개를 실행. 자식 대화는 격리되지만 backend 파일은 공유 가능.
실행: uv run --extra deep-agents python graphs/deep_agents/4-subagents_and_delegation/13_parallel_isolation.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
자료 정리와 검토 subagent에게 작업을 동시에 위임하고, 분리된 대화에서 만든 각 결과를 부모가 받는다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "PARENT_ONLY_MARKER. 조사와 검토 담당에게 각각 독립 작업을 위임해줘."
    }
  ]
}
```
관찰할 결과: 두 task의 결과를 확인합니다. 자식 대화에 PARENT_ONLY_MARKER가 전달되지 않으며 backend 파일 공유 가능성과는 구분합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
config={"max_concurrency": 2, "recursion_limit": 60}으로 부모 실행의 동시성을 제한합니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "PARENT_ONLY_MARKER. 조사와 검토 담당에게 각각 독립 작업을 위임해줘."


def build_graph(model=None, researcher=None, reviewer=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [
                    call(
                        "task",
                        subagent_type="researcher",
                        description="A=10, B=20 수치를 정리해줘.",
                    ),
                    call(
                        "task",
                        subagent_type="reviewer",
                        description="비교 보고서 검증 체크리스트를 줘.",
                    ),
                ]
            ]
        ),
        subagents=[
            {
                "name": "researcher",
                "description": "자료 정리",
                "tools": [],
                "system_prompt": "전달받은 수치만 정리하세요.",
                "model": researcher or create_model(answer="A=10, B=20"),
            },
            {
                "name": "reviewer",
                "description": "검증",
                "tools": [],
                "system_prompt": "출처, 단위, 계산을 확인하세요.",
                "model": reviewer or create_model(answer="출처·단위·계산 확인 필요"),
            },
        ],
        name="parallel_isolation",
    )


graph = build_graph()

if __name__ == "__main__":
    run(
        graph,
        {"messages": [("user", PROMPT)]},
        {"max_concurrency": 2, "recursion_limit": 60},
    )
