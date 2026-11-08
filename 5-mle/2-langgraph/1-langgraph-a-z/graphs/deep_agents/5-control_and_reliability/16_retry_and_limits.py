"""16 — Harness에 retry와 호출 제한 조합

쉽게 이해하기
-------------
Retry는 실패한 호출을 다시 시도하고, 호출 제한은 반복 작업의 횟수를 막는다.
예: 일시 오류는 한 번 더 시도하되 다음 논리 호출은 제한한다.
두 middleware를 배치하는 순서에 따라 무엇을 한 번으로 셀지가 달라진다.

학습 목표: 일시 실패를 retry하고 반복 호출을 제한. 호출 제한과 비용 상한은 다르다.
실행: uv run --extra deep-agents python graphs/deep_agents/5-control_and_reliability/16_retry_and_limits.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
일시적으로 실패하는 도구 호출을 재시도하고, 같은 실행에서 추가 논리 호출은 middleware의 횟수 제한으로 막는다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "unstable_lookup으로 자료를 조회해줘. 일시 오류는 재시도하고 불필요한 반복은 멈춰줘."
    }
  ]
}
```
관찰할 결과: 일시 실패를 한 번 retry해 값을 읽고 두 번째 논리 호출은 limit 오류로 차단합니다. 호출 제한은 금액 상한과 다릅니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
"""

from __future__ import annotations

from deepagents import create_deep_agent
from langchain.agents.middleware import ToolCallLimitMiddleware, ToolRetryMiddleware
from langchain_core.tools import tool

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "unstable_lookup으로 자료를 조회해줘. 일시 오류는 재시도하고 불필요한 반복은 멈춰줘."


def make_unstable_lookup(attempts=None):
    attempts = attempts if attempts is not None else []

    @tool
    def unstable_lookup() -> str:
        """첫 시도는 일시 실패하고 다음 시도는 성공하는 읽기 전용 연습 도구."""
        attempts.append("attempt")
        if len(attempts) == 1:
            raise TimeoutError("연습용 일시 오류")
        return "verified-value=42"

    return unstable_lookup


def build_graph(model=None, attempts=None):
    return create_deep_agent(
        model=model or create_model([[call("unstable_lookup")], [call("unstable_lookup")]]),
        tools=[make_unstable_lookup(attempts)],
        middleware=[
            ToolCallLimitMiddleware(tool_name="unstable_lookup", run_limit=1),
            ToolRetryMiddleware(
                tools=["unstable_lookup"],
                retry_on=(TimeoutError,),
                max_retries=1,
                initial_delay=0,
                jitter=False,
            ),
        ],
        name="retry_and_limits",
    )


graph = build_graph()

if __name__ == "__main__":
    run(graph, {"messages": [("user", PROMPT)]}, {"recursion_limit": 20})
