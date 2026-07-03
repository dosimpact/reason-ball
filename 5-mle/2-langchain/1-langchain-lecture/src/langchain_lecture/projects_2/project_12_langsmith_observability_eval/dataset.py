"""LangSmith 관측성과 평가 루프를 함께 다루는 예제입니다. 평가에 사용할 데이터셋 로딩과 기본 케이스를 제공합니다."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_CASES_PATH = Path(__file__).with_name("eval_cases.jsonl")


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    question: str
    reference: str
    expected_sources: list[str]
    tags: list[str]


def _parse_case(payload: dict[str, Any], *, line_number: int) -> EvaluationCase:
    try:
        case_id = str(payload["case_id"])
        question = str(payload["question"])
        reference = str(payload["reference"])
    except KeyError as exc:
        raise ValueError(f"Missing required field {exc.args[0]!r} on line {line_number}.") from exc

    expected_sources = payload.get("expected_sources", [])
    tags = payload.get("tags", [])
    if not isinstance(expected_sources, list) or not all(isinstance(item, str) for item in expected_sources):
        raise ValueError(f"expected_sources must be a list of strings on line {line_number}.")
    if not isinstance(tags, list) or not all(isinstance(item, str) for item in tags):
        raise ValueError(f"tags must be a list of strings on line {line_number}.")

    return EvaluationCase(
        case_id=case_id,
        question=question,
        reference=reference,
        expected_sources=expected_sources,
        tags=tags,
    )


def load_eval_cases(path: str | Path = DEFAULT_CASES_PATH) -> list[EvaluationCase]:
    cases: list[EvaluationCase] = []
    source = Path(path)
    with source.open(encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            line = raw_line.strip()
            if not line:
                continue
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError(f"Evaluation case on line {line_number} must be a JSON object.")
            cases.append(_parse_case(payload, line_number=line_number))
    return cases
