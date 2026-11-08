"""01 — 최소 Deep Agent

쉽게 이해하기
-------------
Deep Agents harness는 모델에 도구·파일 작업·위임 기능을 붙이는 실행 틀이다.
예: 질문에 답하는 모델에 파일 도구와 담당 agent 호출 기능을 함께 제공한다.
create_deep_agent()가 이 구성을 만들고 이 파일은 최소 실행을 보여준다.

학습 목표: create_deep_agent의 입력/출력과 compiled graph 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/1-harness_and_planning/01_minimal_agent.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
최소 구성의 Deep Agent가 사용자 메시지에 답하며, 기본 scripted 모드는 고정 응답으로 harness 실행을 보여준다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Deep Agents의 역할을 한국어 한 문장으로 설명해줘."
    }
  ]
}
```
관찰할 결과: 최종 AIMessage를 확인합니다. 기본 scripted 답변은 추론 품질 검증이 아닙니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent

from common.deep_agents.demo import run
from common.deep_agents.model import create_model

PROMPT = "Deep Agents의 역할을 한국어 한 문장으로 설명해줘."


def build_graph(model=None):
    return create_deep_agent(
        model=model or create_model(answer="Deep Agents는 복잡한 작업을 돕는 agent harness입니다."),
        system_prompt="한국어로 짧게 답하세요.",
        name="minimal_agent",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]})
