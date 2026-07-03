"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. 패키지 예제를 실행하기 위한 얇은 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_12_langsmith_observability_eval.app import (
    answer_question,
)
from langchain_lecture.projects_2.project_12_langsmith_observability_eval.run_eval import (
    analyze_failed_runs,
    compare_experiments,
    run_experiment,
)


# 예제 실행 진입점입니다.
def main() -> None:
    observed = answer_question("How should failed LangSmith runs be analyzed?")
    print(observed.answer)
    print(f"trace_id={observed.trace_id} langsmith_usable={observed.langsmith.usable}")

    baseline = run_experiment("baseline")
    weak = run_experiment("weak-prompt", prompt_variant="weak")
    comparison = compare_experiments(baseline, weak)
    print(f"baseline score={baseline.average_score:.2f} weak score={weak.average_score:.2f}")
    print(f"regressions={comparison.regressions}")
    for failed in analyze_failed_runs(weak):
        print(f"{failed.case_id}: {failed.category}")


if __name__ == "__main__":
    main()
