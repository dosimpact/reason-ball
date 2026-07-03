"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. 답변 품질, 출처, 지연 시간 같은 평가 기준을 계산합니다."""

from __future__ import annotations

from dataclasses import dataclass

from langchain_lecture.projects_2.project_12_langsmith_observability_eval.dataset import (
    EvaluationCase,
)
from langchain_lecture.shared.documents import tokenize


@dataclass(frozen=True)
class EvaluatorScore:
    name: str
    passed: bool
    score: float
    reason: str


def reference_keyword_evaluator(case: EvaluationCase, output: str) -> EvaluatorScore:
    reference_terms = {term for term in tokenize(case.reference) if len(term) > 3}
    if not reference_terms:
        return EvaluatorScore("reference_keywords", True, 1.0, "No reference terms required.")

    output_terms = set(tokenize(output))
    matched = sorted(reference_terms & output_terms)
    score = len(matched) / len(reference_terms)
    return EvaluatorScore(
        "reference_keywords",
        score >= 0.35,
        score,
        f"Matched {len(matched)}/{len(reference_terms)} reference terms.",
    )


def source_coverage_evaluator(case: EvaluationCase, output: str, sources: list[str]) -> EvaluatorScore:
    if not case.expected_sources:
        return EvaluatorScore("source_coverage", True, 1.0, "No expected sources required.")

    cited_set = {source for source in case.expected_sources if source in output}
    score = len(cited_set) / len(case.expected_sources)
    retrieved_note = " Retrieved expected source." if set(case.expected_sources) & set(sources) else ""
    return EvaluatorScore(
        "source_coverage",
        score >= 1.0,
        score,
        f"Cited {len(cited_set)}/{len(case.expected_sources)} expected sources.{retrieved_note}",
    )


def format_evaluator(output: str) -> EvaluatorScore:
    has_sources = "Sources:" in output and output.split("Sources:", 1)[1].strip()
    return EvaluatorScore(
        "format",
        bool(has_sources),
        1.0 if has_sources else 0.0,
        "Answer includes a Sources section." if has_sources else "Answer is missing a Sources section.",
    )


def latency_evaluator(latency_ms: float, *, max_latency_ms: float = 500.0) -> EvaluatorScore:
    passed = latency_ms <= max_latency_ms
    score = 1.0 if passed else max(0.0, max_latency_ms / latency_ms)
    return EvaluatorScore(
        "latency",
        passed,
        score,
        f"Latency {latency_ms:.1f} ms with budget {max_latency_ms:.1f} ms.",
    )


def evaluate_answer(
    case: EvaluationCase,
    output: str,
    *,
    sources: list[str],
    latency_ms: float,
) -> list[EvaluatorScore]:
    return [
        reference_keyword_evaluator(case, output),
        source_coverage_evaluator(case, output, sources),
        format_evaluator(output),
        latency_evaluator(latency_ms),
    ]
