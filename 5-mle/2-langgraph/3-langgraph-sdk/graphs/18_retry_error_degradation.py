"""Example 18: deterministic retry, error, and graceful degradation states."""
# 예제 개요: 실패, 재시도, 대체 응답을 상태와 이벤트로 보여주는 오류 처리 예제입니다.
# 핵심 흐름: 실패를 재현하는 데모 조건과 최대 시도 횟수에 따라 재호출·fallback·완료로 분기합니다.

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FailureMode = Literal["normal", "flaky_success", "fallback_success", "final_failure"]
FinalStatus = Literal["idle", "running", "success", "success_with_retries", "fallback_success", "failed"]


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
class RetryAttempt(TypedDict):
    attempt: int
    status: str
    error_type: str
    message: str
    recoverable: bool
    backoff_ms: int
    result: str


class ErrorRecord(TypedDict):
    node: str
    attempt: int
    error_type: str
    message: str
    recoverable: bool


class RetryEvent(TypedDict):
    type: str
    phase: str
    attempt: int
    status: str
    detail: str
    backoff_ms: int


# RetryState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
class RetryState(TypedDict, total=False):
    query: str
    failure_mode: FailureMode
    max_attempts: int
    fallback_enabled: bool
    retry_status: str
    current_attempt: int
    attempts: list[RetryAttempt]
    errors: list[ErrorRecord]
    primary_result: str
    fallback_result: str
    final_status: FinalStatus
    final: str
    retry_events: list[RetryEvent]
    trace: list[dict[str, Any]]


DEFAULT_QUERY = "Summarize retry and fallback behavior for a LangGraph SDK learning demo."


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def _max_attempts(state: RetryState) -> int:
    raw = state.get("max_attempts", 3)
    return min(max(int(raw) if isinstance(raw, int) else 3, 1), 4)


def _event(phase: str, attempt: int, status: str, detail: str, backoff_ms: int = 0) -> RetryEvent:
    return {
        "type": "retry_status",
        "phase": phase,
        "attempt": attempt,
        "status": status,
        "detail": detail,
        "backoff_ms": backoff_ms,
    }


def _error(attempt: int, error_type: str, message: str, recoverable: bool) -> ErrorRecord:
    return {
        "node": "primary_call",
        "attempt": attempt,
        "error_type": error_type,
        "message": message,
        "recoverable": recoverable,
    }


def _attempt_record(
    attempt: int,
    status: str,
    *,
    error_type: str = "",
    message: str = "",
    recoverable: bool = False,
    backoff_ms: int = 0,
    result: str = "",
) -> RetryAttempt:
    return {
        "attempt": attempt,
        "status": status,
        "error_type": error_type,
        "message": message,
        "recoverable": recoverable,
        "backoff_ms": backoff_ms,
        "result": result,
    }


def prepare(state: RetryState) -> dict:
    mode = state.get("failure_mode", "flaky_success")
    if mode not in ("normal", "flaky_success", "fallback_success", "final_failure"):
        mode = "flaky_success"
    fallback_enabled = bool(state.get("fallback_enabled", mode != "final_failure"))
    max_attempts = _max_attempts(state)
    return {
        "query": state.get("query", DEFAULT_QUERY),
        "failure_mode": mode,
        "max_attempts": max_attempts,
        "fallback_enabled": fallback_enabled,
        "retry_status": "prepared",
        "current_attempt": 0,
        "attempts": [],
        "errors": [],
        "primary_result": "",
        "fallback_result": "",
        "final_status": "running",
        "retry_events": [],
        "trace": [
            {
                "node": "prepare",
                "event": "prepared",
                "mode": mode,
                "max_attempts": max_attempts,
                "fallback_enabled": fallback_enabled,
            }
        ],
    }


# 주 처리 경로를 시도하고 성공 또는 실패 정보를 다음 분기용 상태에 남깁니다.
def primary_call(state: RetryState) -> dict:
    attempt = int(state.get("current_attempt", 0)) + 1
    mode = state.get("failure_mode", "flaky_success")
    max_attempts = _max_attempts(state)
    writer = get_stream_writer()
    start = _event("primary_call", attempt, "running", f"Primary call attempt {attempt}.")
    writer(start)

    should_fail_transient = mode in ("flaky_success", "fallback_success") and (
        attempt <= 2 if mode == "flaky_success" else attempt <= max_attempts
    )
    should_fail_permanent = mode == "final_failure"

    events = list(state.get("retry_events", [])) + [start]
    attempts = list(state.get("attempts", []))
    errors = list(state.get("errors", []))

    if should_fail_permanent:
        message = "Permanent schema/auth failure: retry is disabled for this error class."
        record = _attempt_record(
            attempt,
            "failed",
            error_type="PermanentError",
            message=message,
            recoverable=False,
            backoff_ms=0,
        )
        err = _error(attempt, "PermanentError", message, False)
        failed = _event("primary_call", attempt, "failed", message)
        writer(failed)
        return {
            "current_attempt": attempt,
            "retry_status": "failed",
            "attempts": attempts + [record],
            "errors": errors + [err],
            "retry_events": events + [failed],
            "trace": state.get("trace", [])
            + [
                {
                    "node": "primary_call",
                    "event": "permanent_failure",
                    "attempt": attempt,
                }
            ],
        }

    if should_fail_transient:
        backoff_ms = 100 * (2 ** (attempt - 1))
        message = f"Transient upstream timeout on attempt {attempt}; retry is allowed."
        record = _attempt_record(
            attempt,
            "retrying",
            error_type="TransientError",
            message=message,
            recoverable=True,
            backoff_ms=backoff_ms,
        )
        err = _error(attempt, "TransientError", message, True)
        failed = _event("primary_call", attempt, "retrying", message, backoff_ms)
        backoff = _event("backoff", attempt, "waiting", f"Backoff scheduled for {backoff_ms}ms.", backoff_ms)
        writer(failed)
        writer(backoff)
        return {
            "current_attempt": attempt,
            "retry_status": "retrying",
            "attempts": attempts + [record],
            "errors": errors + [err],
            "retry_events": events + [failed, backoff],
            "trace": state.get("trace", [])
            + [
                {
                    "node": "primary_call",
                    "event": "transient_failure",
                    "attempt": attempt,
                    "backoff_ms": backoff_ms,
                }
            ],
        }

    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are the primary upstream service in a retry demo. Return a concise "
                    "operational answer under 70 words. Mention retry or fallback signals."
                )
            ),
            HumanMessage(content=state.get("query", DEFAULT_QUERY)),
        ]
    )
    result = _extract_text(response.content).strip()
    success = _event("primary_call", attempt, "succeeded", "Primary call succeeded.")
    writer(success)
    return {
        "current_attempt": attempt,
        "retry_status": "primary_success",
        "primary_result": result,
        "attempts": attempts
        + [
            _attempt_record(
                attempt,
                "succeeded",
                message="Primary call succeeded.",
                result=result,
            )
        ],
        "retry_events": events + [success],
        "trace": state.get("trace", [])
        + [
            {
                "node": "primary_call",
                "event": "succeeded",
                "attempt": attempt,
            }
        ],
    }


# 분기 판단: 현재 상태를 읽어 다음에 실행할 노드의 경로 이름을 반환합니다.
def route_after_primary(state: RetryState) -> str:
    if state.get("primary_result"):
        return "finalize"
    if state.get("retry_status") == "failed":
        return "fallback" if state.get("fallback_enabled") else "finalize"
    if int(state.get("current_attempt", 0)) < _max_attempts(state):
        return "primary_call"
    return "fallback" if state.get("fallback_enabled") else "finalize"


def fallback(state: RetryState) -> dict:
    writer = get_stream_writer()
    event = _event("fallback", int(state.get("current_attempt", 0)), "running", "Fallback path started.")
    writer(event)
    errors = state.get("errors", [])
    error_summary = "; ".join(f"{item['error_type']} attempt {item['attempt']}" for item in errors) or "no error"
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are a graceful-degradation fallback. Use cached/partial context, "
                    "clearly state that fallback was used, and keep the answer under 80 words."
                )
            ),
            HumanMessage(
                content=(
                    f"USER QUERY:\n{state.get('query', DEFAULT_QUERY)}\n\n"
                    f"ERROR SUMMARY:\n{error_summary}"
                )
            ),
        ]
    )
    result = _extract_text(response.content).strip()
    done = _event("fallback", int(state.get("current_attempt", 0)), "succeeded", "Fallback result produced.")
    writer(done)
    return {
        "retry_status": "fallback_success",
        "fallback_result": result,
        "retry_events": list(state.get("retry_events", [])) + [event, done],
        "trace": state.get("trace", [])
        + [
            {
                "node": "fallback",
                "event": "succeeded",
                "error_count": len(errors),
            }
        ],
    }


# 각 단계에서 만든 결과를 최종 응답과 UI 표시 상태로 정리합니다.
def finalize(state: RetryState) -> dict:
    primary = state.get("primary_result", "")
    fallback_result = state.get("fallback_result", "")
    attempts = int(state.get("current_attempt", 0))
    errors = state.get("errors", [])
    if primary and errors:
        final_status: FinalStatus = "success_with_retries"
        final = f"Recovered after {attempts} attempts.\n\n{primary}"
    elif primary:
        final_status = "success"
        final = f"Primary call succeeded on attempt {attempts}.\n\n{primary}"
    elif fallback_result:
        final_status = "fallback_success"
        final = f"Fallback succeeded after {attempts} failed primary attempts.\n\n{fallback_result}"
    else:
        final_status = "failed"
        final = f"Final failure after {attempts} attempts. No fallback result was allowed."
    return {
        "retry_status": final_status,
        "final_status": final_status,
        "final": final,
        "trace": state.get("trace", [])
        + [
            {
                "node": "finalize",
                "event": final_status,
                "attempts": attempts,
                "error_count": len(errors),
            }
        ],
    }


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(RetryState)
    builder.add_node("prepare", prepare)
    builder.add_node("primary_call", primary_call)
    builder.add_node("fallback", fallback)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "primary_call")
    builder.add_conditional_edges(
        "primary_call",
        route_after_primary,
        {"primary_call": "primary_call", "fallback": "fallback", "finalize": "finalize"},
    )
    builder.add_edge("fallback", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    output = graph.invoke({"failure_mode": "fallback_success", "query": DEFAULT_QUERY})
    print(output["final"])
