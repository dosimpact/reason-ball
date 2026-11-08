"""18 — 작은 리서치 통합

쉽게 이해하기
-------------
리서치 흐름은 할 일 정리 → 자료 확인 → 보고서 작성으로 이어지는 작업이다.
예: 연습 수치를 비교하고 출처를 보고서에 남긴다.
이 예제는 고정 fixture 자료로 계획·위임·파일 결과가 맞물리는지 확인한다.

학습 목표: 계획 + 분석 위임 + 근거 파일 + 보고서를 한 그래프로 실행. 외부 검색 없음.
실행: uv run --extra deep-agents python graphs/deep_agents/6-observability_and_workflow/18_research_workflow.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
계획을 등록하고 analyst에게 연습 자료 비교를 맡긴 뒤, 출처가 포함된 보고서 파일을 저장·조회하고 할 일을 완료한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "계획을 세우고 analyst에게 A/B 비교를 위임해 /report.md에 근거와 함께 저장해줘."
    }
  ]
}
```
관찰할 결과: todos 완료, analyst 위임 결과, /report.md의 수치·fixture://research 출처를 확인합니다. 실제 웹 검색이 아닙니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.tools import tool

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "계획을 세우고 analyst에게 A/B 비교를 위임해 /report.md에 근거와 함께 저장해줘."
REPORT = "# A/B 비교\nA=10, B=20, 차이=10.\n출처: fixture://research\n한계: 연습 데이터."


@tool
def fetch_sources() -> str:
    """출처가 있는 고정 연습 자료. 웹 검색 결과가 아니다."""
    return "A=10, B=20; source=fixture://research"


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [
                    call(
                        "write_todos",
                        todos=[{"content": "비교 보고서", "status": "in_progress"}],
                    )
                ],
                [
                    call(
                        "task",
                        subagent_type="analyst",
                        description="fetch_sources로 A/B를 비교하고 출처를 보고해줘.",
                    )
                ],
                [call("write_file", file_path="/report.md", content=REPORT)],
                [
                    call(
                        "write_todos",
                        todos=[{"content": "비교 보고서", "status": "completed"}],
                    )
                ],
                [call("read_file", file_path="/report.md")],
            ]
        ),
        middleware=[TodoListMiddleware()],
        subagents=[
            {
                "name": "analyst",
                "description": "출처 기반 비교",
                "tools": [fetch_sources],
                "system_prompt": "도구로 수치를 확인하고 차이와 출처, 연습 데이터라는 한계를 보고하세요.",
                "model": create_model(
                    [[call("fetch_sources")]], answer="차이=10; fixture://research"
                ),
            }
        ],
        name="research_workflow",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
