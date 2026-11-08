"""03 — 계획 작성과 갱신

쉽게 이해하기
-------------
작업 계획은 해야 할 일을 목록으로 적고 진행에 맞춰 갱신하는 것이다.
예: 계산하기를 진행 중으로 두었다가 결과를 저장한 뒤 완료로 바꾼다.
여기서는 TodoListMiddleware를 추가해 todos와 작업 결과가 맞는지 살펴본다.

학습 목표: TodoListMiddleware를 명시적으로 추가하고 todos 상태 변화를 관찰.
실행: uv run --extra deep-agents python graphs/deep_agents/1-harness_and_planning/03_task_planning.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
할 일을 진행 중으로 등록하고 답을 파일에 저장한 뒤, 같은 할 일을 완료 상태로 갱신한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "숫자 42를 /answer.txt에 저장하는 계획을 세우고 실행 후 계획을 완료 처리해줘."
    }
  ]
}
```
관찰할 결과: todos가 in_progress → completed로 갱신되고 /answer.txt에 42가 저장됩니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware

from common.deep_agents.model import call, create_model

PROMPT = "숫자 42를 /answer.txt에 저장하는 계획을 세우고 실행 후 계획을 완료 처리해줘."


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model(
            [
                [
                    call(
                        "write_todos",
                        todos=[{"content": "답 저장", "status": "in_progress"}],
                    )
                ],
                [call("write_file", file_path="/answer.txt", content="42")],
                [
                    call(
                        "write_todos",
                        todos=[{"content": "답 저장", "status": "completed"}],
                    )
                ],
            ]
        ),
        middleware=[TodoListMiddleware()],
        name="task_planning",
    )


graph = build_graph()

if __name__ == "__main__":
    # updates에서 in_progress -> completed 순서를 확인한다.
    for update in graph.stream(
        {"messages": [("user", PROMPT)]},
        stream_mode="updates",
        config={"recursion_limit": 60},
    ):
        print(update)
