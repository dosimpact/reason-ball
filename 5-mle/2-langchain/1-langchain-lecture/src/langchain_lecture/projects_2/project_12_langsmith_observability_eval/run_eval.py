"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. 평가 케이스를 실행하고 실험 결과를 비교하는 흐름입니다."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from langchain_lecture.projects_2.project_12_langsmith_observability_eval.app import (
    ObservedAnswer,
    answer_question,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.dataset import (
    EvaluationCase,
    load_eval_cases,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.evaluators import (
    EvaluatorScore,
    evaluate_answer,
)


AnswerFn = Callable[[str], ObservedAnswer]


@dataclass(frozen=True)
class ExperimentRun:
    case_id: str
    question: str
    answer: str
    sources: list[str]
    trace_id: str
    evaluator_scores: list[EvaluatorScore]
    passed: bool
    score: float
    latency_ms: float
    failure_category: str


@dataclass(frozen=True)
class ExperimentSummary:
    name: str
    runs: list[ExperimentRun]
    average_score: float
    pass_rate: float


@dataclass(frozen=True)
class ExperimentComparison:
    baseline_name: str
    candidate_name: str
    score_delta: float
    pass_rate_delta: float
    regressions: list[str]
    improvements: list[str]


@dataclass(frozen=True)
class FailedRunAnalysis:
    case_id: str
    category: str
    reason: str
    trace_id: str


def _classify_failure(scores: Sequence[EvaluatorScore]) -> str:
    failed_names = [score.name for score in scores if not score.passed]
    if not failed_names:
        return "none"
    if "format" in failed_names:
        return "format"
    if "source_coverage" in failed_names:
        return "retrieval"
    if "latency" in failed_names:
        return "latency"
    if "reference_keywords" in failed_names:
        return "prompt"
    return "unknown"


def run_experiment(
    name: str,
    cases: Sequence[EvaluationCase] | None = None,
    *,
    answer_fn: AnswerFn | None = None,
    prompt_variant: str = "baseline",
) -> ExperimentSummary:
    eval_cases = list(cases) if cases is not None else load_eval_cases()
    runner = answer_fn or (lambda question: answer_question(question, prompt_variant=prompt_variant))

    runs: list[ExperimentRun] = []
    for case in eval_cases:
        observed = runner(case.question)
        scores = evaluate_answer(
            case,
            observed.answer,
            sources=observed.sources,
            latency_ms=observed.latency_ms,
        )
        passed = all(score.passed for score in scores)
        run_score = sum(score.score for score in scores) / len(scores)
        runs.append(
            ExperimentRun(
                case_id=case.case_id,
                question=case.question,
                answer=observed.answer,
                sources=observed.sources,
                trace_id=observed.trace_id,
                evaluator_scores=scores,
                passed=passed,
                score=run_score,
                latency_ms=observed.latency_ms,
                failure_category=_classify_failure(scores),
            )
        )

    average_score = sum(run.score for run in runs) / len(runs) if runs else 0.0
    pass_rate = sum(1 for run in runs if run.passed) / len(runs) if runs else 0.0
    return ExperimentSummary(name=name, runs=runs, average_score=average_score, pass_rate=pass_rate)


def compare_experiments(
    baseline: ExperimentSummary,
    candidate: ExperimentSummary,
    *,
    regression_threshold: float = 0.05,
) -> ExperimentComparison:
    baseline_by_case = {run.case_id: run for run in baseline.runs}
    regressions: list[str] = []
    improvements: list[str] = []

    for candidate_run in candidate.runs:
        baseline_run = baseline_by_case.get(candidate_run.case_id)
        if baseline_run is None:
            continue
        delta = candidate_run.score - baseline_run.score
        if delta < -regression_threshold:
            regressions.append(candidate_run.case_id)
        elif delta > regression_threshold:
            improvements.append(candidate_run.case_id)

    return ExperimentComparison(
        baseline_name=baseline.name,
        candidate_name=candidate.name,
        score_delta=candidate.average_score - baseline.average_score,
        pass_rate_delta=candidate.pass_rate - baseline.pass_rate,
        regressions=regressions,
        improvements=improvements,
    )


def analyze_failed_runs(experiment: ExperimentSummary) -> list[FailedRunAnalysis]:
    analyses: list[FailedRunAnalysis] = []
    for run in experiment.runs:
        if run.passed:
            continue
        failed_reasons = [score.reason for score in run.evaluator_scores if not score.passed]
        analyses.append(
            FailedRunAnalysis(
                case_id=run.case_id,
                category=run.failure_category,
                reason="; ".join(failed_reasons),
                trace_id=run.trace_id,
            )
        )
    return analyses


# 예제 실행 진입점입니다.
def main() -> None:
    baseline = run_experiment("baseline")
    weak = run_experiment("weak-prompt", prompt_variant="weak")
    comparison = compare_experiments(baseline, weak)

    print(f"baseline score={baseline.average_score:.2f} pass_rate={baseline.pass_rate:.2f}")
    print(f"weak score={weak.average_score:.2f} pass_rate={weak.pass_rate:.2f}")
    print(f"score_delta={comparison.score_delta:.2f} regressions={comparison.regressions}")
    for analysis in analyze_failed_runs(weak):
        print(f"failed {analysis.case_id}: {analysis.category} ({analysis.reason})")


if __name__ == "__main__":
    main()
