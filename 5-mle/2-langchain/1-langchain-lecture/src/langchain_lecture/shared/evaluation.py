"""예제 전반에서 재사용할 간단한 평가 헬퍼입니다."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Callable


@dataclass(frozen=True)
class EvaluationCase:
    question: str
    reference: str
    expected_sources: list[str]


@dataclass(frozen=True)
class EvaluationResult:
    question: str
    passed: bool
    score: float
    reason: str
    latency_ms: float


def includes_reference(output: str, reference: str) -> tuple[bool, float, str]:
    output_lower = output.lower()
    terms = [term for term in reference.lower().split() if len(term) > 2]
    if not terms:
        return True, 1.0, "No reference terms required."
    matched = sum(1 for term in terms if term in output_lower)
    score = matched / len(terms)
    return score >= 0.5, score, f"Matched {matched}/{len(terms)} reference terms."


def evaluate_case(
    case: EvaluationCase,
    run: Callable[[str], str],
    scorer: Callable[[str, str], tuple[bool, float, str]] = includes_reference,
) -> EvaluationResult:
    start = perf_counter()
    output = run(case.question)
    latency_ms = (perf_counter() - start) * 1000
    passed, score, reason = scorer(output, case.reference)
    return EvaluationResult(
        question=case.question,
        passed=passed,
        score=score,
        reason=reason,
        latency_ms=latency_ms,
    )
