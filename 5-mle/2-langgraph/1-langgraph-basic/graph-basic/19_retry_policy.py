"""
Example 19 — Per-node retry policy.

특정 노드에 재시도 정책을 부여해 일시적 오류(네트워크 일시 단절, 429 등)를
자동 복구하는 패턴.

학습 포인트
-----------
- `from langgraph.types import RetryPolicy`
- `builder.add_node("name", fn, retry_policy=RetryPolicy(...))`
- `max_attempts`, `initial_interval`, `backoff_factor`, `retry_on` (예외 클래스 또는 콜러블)
- 영속적 오류는 그대로 raise, 일시 오류만 재시도하도록 retry_on 으로 필터링

그래프 구조
-----------
START ─▶ flaky_call (RetryPolicy) ─▶ finalize ─▶ END

테스트 입력 예시 (state.target: str)
-----------------------------------
모듈 레벨 카운터(_attempt_counter) 와 _FAIL_FIRST_N=2 로 동작합니다.
**프로세스가 살아있는 동안 카운터가 누적**되므로 Studio 에서 여러 번 invoke
하면 이미 _FAIL_FIRST_N 을 넘긴 상태가 될 수 있음 (한 번 실행 후 재시작 권장).

▶ 정상 — TransientError 후 재시도 성공
   - {"target": "anything"}              → 처음 2회는 TransientError, 3회째 성공
   - {"target": "user-42"}
   - {"target": "demo"}

▶ 영구 실패 — retry_on 에 없으므로 재시도 안 됨, 즉시 raise
   - {"target": "always_fail"}            → PermanentError 그대로 전파

확인 포인트
- out["attempts"]: 성공한 시도 번호 (재시도 후엔 3 이상)
- out["result"]: "OK on attempt #N"
- 카운터 리셋: dev 서버 재시작 또는 _attempt_counter["count"] = 0
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy


class TransientError(Exception):
    """일시적 네트워크/서비스 오류 (재시도 대상)."""


class PermanentError(Exception):
    """영속적 오류 (재시도해도 동일하게 실패)."""


class State(TypedDict, total=False):
    target: str
    attempts: int     # 실제 시도 횟수 추적 (디버깅용)
    result: str


# 데모용: 모듈 레벨 카운터로 처음 N 회는 일부러 실패시킴.
_attempt_counter = {"count": 0}
_FAIL_FIRST_N = 2


def flaky_call(state: State) -> dict:
    _attempt_counter["count"] += 1
    n = _attempt_counter["count"]
    target = state.get("target", "")

    if target == "always_fail":
        # PermanentError 는 retry_on 에 없으므로 재시도되지 않고 즉시 전파
        raise PermanentError("This will never succeed")

    if n <= _FAIL_FIRST_N:
        raise TransientError(f"transient failure (attempt #{n})")

    return {"attempts": n, "result": f"OK on attempt #{n}"}


def finalize(state: State) -> dict:
    return {"result": state.get("result", "(no result)")}


def build_graph():
    builder = StateGraph(State)
    builder.add_node(
        "flaky_call",
        flaky_call,
        retry_policy=RetryPolicy(
            max_attempts=4,
            initial_interval=0.05,
            backoff_factor=2.0,
            retry_on=(TransientError,),  # PermanentError 는 재시도 안 함
        ),
    )
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "flaky_call")
    builder.add_edge("flaky_call", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    # 1) 일시 오류 시나리오: 처음 2회 실패 후 3번째 성공
    _attempt_counter["count"] = 0
    out = graph.invoke({"target": "ok"})
    print(f"transient case → {out}")

    # 2) 영속 오류 시나리오: 즉시 PermanentError 전파
    _attempt_counter["count"] = 0
    try:
        graph.invoke({"target": "always_fail"})
    except PermanentError as e:
        print(f"permanent case → raised as expected: {e}")
