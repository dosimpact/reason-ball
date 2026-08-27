"""Example 19 — 노드별 ``RetryPolicy``.

선행 개념
---------
- 노드 등록과 직선 그래프 실행

새 개념
-------
- ``add_node(..., retry_policy=RetryPolicy(...))``
- 재시도 가능한 일시 오류와 즉시 전파할 영구 오류 구분
- ``max_attempts``는 최초 실행을 포함한 전체 시도 횟수라는 점

복습 개념
---------
- 노드의 부분 state update와 예외 전파

각 invoke 앞의 ``prepare`` 노드가 ``request_id``별 예제용 failure counter를 0으로
초기화한다. 따라서 같은 프로세스에서 예제를 여러 번 실행해도 일시 오류 시나리오는
항상 두 번 실패한 뒤 세 번째 시도에 성공한다. 동시에 실행할 요청에는 서로 다른
``request_id``를 사용해야 한다. ``jitter=False``도 사용해 대기 시간의 무작위성을
제거했다.
"""

from __future__ import annotations

from threading import Lock
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy


class TransientError(Exception):
    """재시도하면 복구될 수 있는 일시 오류."""


class PermanentError(Exception):
    """재시도하지 않을 영구 오류."""


class State(TypedDict, total=False):
    request_id: str
    target: str
    attempts: int
    result: str


_attempts_by_request: dict[str, int] = {}
_attempt_lock = Lock()
FAIL_FIRST_N = 2


def _request_id(state: State) -> str:
    return state.get("request_id") or state.get("target") or "default"


def prepare(state: State) -> dict:
    """새 graph invocation의 재시도 카운터를 초기화한다."""
    with _attempt_lock:
        _attempts_by_request[_request_id(state)] = 0
    return {}


def flaky_call(state: State) -> dict:
    """일시 오류는 두 번 발생시키고 세 번째 호출에서 성공한다."""
    request_id = _request_id(state)
    with _attempt_lock:
        attempt = _attempts_by_request.get(request_id, 0) + 1
        _attempts_by_request[request_id] = attempt

    if state.get("target") == "always_fail":
        raise PermanentError("permanent failure")
    if attempt <= FAIL_FIRST_N:
        raise TransientError(f"transient failure on attempt {attempt}")
    return {"attempts": attempt, "result": f"OK on attempt #{attempt}"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("prepare", prepare)
    builder.add_node(
        "flaky_call",
        flaky_call,
        retry_policy=RetryPolicy(
            max_attempts=4,
            initial_interval=0.01,
            backoff_factor=1.0,
            jitter=False,
            retry_on=TransientError,
        ),
    )
    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "flaky_call")
    builder.add_edge("flaky_call", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    for run in range(2):
        output = graph.invoke(
            {"request_id": f"run-{run}", "target": f"demo-{run}"}
        )
        print(output)

    try:
        graph.invoke({"target": "always_fail"})
    except PermanentError as exc:
        print(f"not retried: {exc}")
