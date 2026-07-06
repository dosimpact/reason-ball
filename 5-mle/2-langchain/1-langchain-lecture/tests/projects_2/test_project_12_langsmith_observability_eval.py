from __future__ import annotations

import importlib

from langchain_lecture.projects_2.project_12_langsmith_observability_eval.app import (
    ObservedAnswer,
    answer_question,
    detect_langsmith_environment,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.dataset import (
    load_eval_cases,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.evaluators import (
    evaluate_answer,
    format_evaluator,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.run_eval import (
    analyze_failed_runs,
    compare_experiments,
    run_experiment,
)


def test_detect_langsmith_environment_does_not_require_api_key():
    detected = detect_langsmith_environment({"LANGSMITH_TRACING": "true"})

    assert detected.tracing_enabled is True
    assert detected.api_key_present is False
    assert detected.usable is False
    assert "LANGSMITH_API_KEY" in detected.reason


def test_answer_question_records_local_trace_and_sources():
    observed = answer_question("What does a LangSmith trace show?")

    assert observed.trace_id.startswith("local-")
    assert observed.sources
    assert "Sources:" in observed.answer
    assert [event.name for event in observed.events] == ["retriever", "answer_chain"]


def test_load_eval_cases_reads_jsonl_dataset():
    cases = load_eval_cases()

    assert len(cases) >= 5
    assert cases[0].case_id == "trace-001"
    assert cases[0].expected_sources == ["observability.md"]


def test_rule_evaluators_pass_for_local_answer():
    case = load_eval_cases()[0]
    observed = answer_question(case.question)

    scores = evaluate_answer(
        case,
        observed.answer,
        sources=observed.sources,
        latency_ms=observed.latency_ms,
    )

    assert all(score.passed for score in scores)


def test_format_evaluator_fails_when_sources_are_missing():
    score = format_evaluator("LangSmith helps with traces.")

    assert score.passed is False
    assert score.score == 0.0


def test_experiment_comparison_and_failed_run_analysis():
    cases = load_eval_cases()
    baseline = run_experiment("baseline", cases)
    weak = run_experiment("weak", cases, prompt_variant="weak")

    comparison = compare_experiments(baseline, weak)
    failures = analyze_failed_runs(weak)

    assert baseline.average_score > weak.average_score
    assert comparison.regressions
    assert failures
    assert {failure.category for failure in failures} >= {"format"}


def test_run_experiment_accepts_injected_answer_function():
    case = load_eval_cases()[0]

    def fake_answer(question: str) -> ObservedAnswer:
        return ObservedAnswer(
            question=question,
            answer="A trace shows model calls and latency. Sources: observability.md",
            sources=["observability.md"],
            trace_id="local-test",
            events=[],
            langsmith=detect_langsmith_environment({}),
            latency_ms=1.0,
        )

    experiment = run_experiment("fake", [case], answer_fn=fake_answer)

    assert experiment.pass_rate == 1.0
    assert experiment.runs[0].trace_id == "local-test"


def test_project_12_graph_compiles_without_external_clients():
    module = importlib.import_module(
        "langchain_lecture.projects_2.project_12_langsmith_observability_eval.graph"
    )

    assert module.graph is not None
    assert module.graph.get_graph().nodes
