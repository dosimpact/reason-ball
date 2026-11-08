"""17 — CLI 스트리밍

쉽게 이해하기
-------------
Stream namespace는 이벤트가 부모와 자식 중 어디에서 왔는지 보여주는 주소다.
예: 담당 agent의 메시지와 부모의 상태 변경을 구분한다.
subgraphs=True로 받은 namespace와 stream mode를 함께 살펴본다.

학습 목표: messages/updates와 subgraphs namespace로 부모/자식 실행을 관찰. UI 없음.
실행: uv run --extra deep-agents python graphs/deep_agents/6-observability_and_workflow/17_streaming_observability.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
작성 subagent에게 인사를 위임하고, 부모·자식의 메시지와 상태 변경을 namespace별 스트림으로 관찰한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "writer에게 짧은 인사를 위임해줘."
    }
  ]
}
```
관찰할 결과: messages/updates와 subgraph namespace를 관찰합니다. scripted는 완성 메시지 단위이며 live 모델의 token 청크와 다릅니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent

from common.deep_agents.model import call, create_model

PROMPT = "writer에게 짧은 인사를 위임해줘."


def build_graph(model=None):
    return create_deep_agent(
        model=model
        or create_model([[call("task", subagent_type="writer", description="인사해줘.")]]),
        subagents=[
            {
                "name": "writer",
                "description": "인사 작성",
                "tools": [],
                "system_prompt": "한국어로 인사하세요.",
                "model": create_model(answer="안녕하세요. 스트리밍 연습입니다."),
            }
        ],
        name="streaming_observability",
    )


graph = build_graph()

if __name__ == "__main__":
    # scripted는 완성 메시지 단위다. --live에서 실제 모델 token chunk를 관찰한다.
    for namespace, mode, event in graph.stream(
        {"messages": [("user", PROMPT)]},
        stream_mode=["messages", "updates"],
        subgraphs=True,
        config={"recursion_limit": 60},
    ):
        print("namespace:", namespace or "parent", "mode:", mode, "event:", event)
