"""
실패하는 외부 검색 tool 들의 mock 모음.

- TransientError / RateLimitError / PermanentError 클래스 정의
- `flaky_search`     : 첫 N(default=2)번은 TransientError, 이후 성공
- `always_failing_search`: 항상 PermanentError
- `slow_then_ok_search`  : 매 호출 시도 카운트 출력 후 성공
- `cached_answer`        : 항상 성공하는 fallback
- `secondary_search`     : 항상 성공하는 보조 tool

각 tool 은 호출 카운터를 들고 있어 retry / fallback 동작 검증에 사용됩니다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from langchain_core.tools import tool


class TransientError(Exception):
    """일시 오류 (네트워크 / 5xx). 재시도 대상."""


class RateLimitError(Exception):
    """429 Too Many Requests. 재시도 대상."""


class PermanentError(Exception):
    """영구 실패 (404 / 인증 / 스키마). 재시도 대상 아님."""


@dataclass
class _Counters:
    flaky: int = 0
    always: int = 0
    slow: int = 0
    secondary: int = 0
    cached: int = 0
    history: list[str] = field(default_factory=list)

    def reset(self) -> None:
        self.flaky = 0
        self.always = 0
        self.slow = 0
        self.secondary = 0
        self.cached = 0
        self.history.clear()


COUNTERS = _Counters()

FLAKY_FAIL_TIMES = 2  # 처음 2번 실패 후 성공


@tool
def flaky_search(query: str) -> str:
    """일시 오류로 처음 몇 번 실패하다가 결국 성공하는 외부 검색 (retry 대상)."""
    COUNTERS.flaky += 1
    COUNTERS.history.append(f"flaky#{COUNTERS.flaky}")
    if COUNTERS.flaky <= FLAKY_FAIL_TIMES:
        raise TransientError(f"transient failure (attempt {COUNTERS.flaky})")
    return f"[flaky_search OK] '{query}' → result-after-{COUNTERS.flaky}-tries"


@tool
def always_failing_search(query: str) -> str:
    """항상 영구 실패하는 외부 검색 (fallback 검증용)."""
    COUNTERS.always += 1
    COUNTERS.history.append(f"always#{COUNTERS.always}")
    raise PermanentError(f"permanent failure for '{query}'")


@tool
def slow_then_ok_search(query: str) -> str:
    """무조건 성공하지만 호출 횟수 카운트만 보여주는 보조 tool."""
    COUNTERS.slow += 1
    COUNTERS.history.append(f"slow#{COUNTERS.slow}")
    return f"[slow_search OK] '{query}'"


@tool
def secondary_search(query: str) -> str:
    """primary 가 실패했을 때 사용하는 보조 검색."""
    COUNTERS.secondary += 1
    COUNTERS.history.append(f"secondary#{COUNTERS.secondary}")
    return f"[secondary_search OK] '{query}'"


@tool
def cached_answer(query: str) -> str:
    """모든 검색이 실패했을 때 마지막으로 시도하는 캐시 응답."""
    COUNTERS.cached += 1
    COUNTERS.history.append(f"cached#{COUNTERS.cached}")
    return f"[cached_answer] stale result for '{query}' (may be outdated)"


__all__ = [
    "TransientError",
    "RateLimitError",
    "PermanentError",
    "flaky_search",
    "always_failing_search",
    "slow_then_ok_search",
    "secondary_search",
    "cached_answer",
    "COUNTERS",
    "FLAKY_FAIL_TIMES",
]
