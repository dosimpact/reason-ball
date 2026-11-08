"""
Example 03-05 — LangChain create_agent로 ReAct graph 만들기.

쉽게 이해하기
-------------
create_agent()는 모델과 도구를 주면 도구 호출 반복을 구성해 주는 함수다.
15번에서 직접 연결한 agent → tools → agent 흐름을 더 짧게 만든다.
반환된 그래프도 invoke()로 실행할 수 있다.

새 개념
-------
- `create_agent()`가 model → tools → model loop를 구성
- 직접 만든 ReAct graph와 prebuilt agent factory 비교
- 반환된 compiled graph를 그대로 Studio entrypoint로 노출

그래프 구조
-----------
create_agent로 모델과 도구를 연결해, 도구 호출과 결과 확인을 거쳐 사용자 요청에 답한다.

START ─▶ model ─┬─▶ tools ─▶ model
                 └─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "12 * 7을 계산해줘."
    }
  ]
}
```
관찰할 결과: create_agent가 만든 도구 루프와 최종 messages를 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""

from __future__ import annotations

from langchain.agents import create_agent

from common.llm import create_llm
from common.tools import TOOLS

SYSTEM_PROMPT = """
당신은 간결하고 정확한 한국어 어시스턴트입니다.
시간, 계산, 등록된 주제 조회가 필요하면 추측하지 말고 제공된 도구를 사용하세요.
""".strip()


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=TOOLS,
        system_prompt=SYSTEM_PROMPT,
        name="basic_create_agent",
    )


graph = build_graph()


if __name__ == "__main__":
    result = graph.invoke(
        {"messages": [{"role": "user", "content": "12 * 7을 계산해줘."}]}
    )
    result["messages"][-1].pretty_print()
