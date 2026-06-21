from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_01_prompt_chaining.prompts import (
    EXTRACT_SPECS_SYSTEM_PROMPT,
    EXTRACT_SPECS_USER_PROMPT,
    REPAIR_JSON_SYSTEM_PROMPT,
    REPAIR_JSON_USER_PROMPT,
    TRANSFORM_TO_JSON_SYSTEM_PROMPT,
    TRANSFORM_TO_JSON_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_01_prompt_chaining.state import (
    Artifact,
    PromptChainingState,
)
from agentic_design_patterns.shared.models import get_chat_model


REQUIRED_FIELDS = ("cpu", "memory", "storage")
MAX_INPUT_CHARS = 6000


# 원본 입력을 LLM이 다루기 쉬운 단일 문자열로 정리하고 기본 상태를 초기화한다.
def prepare_input(state: PromptChainingState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    clean_text = _normalize_text(raw_input)
    artifacts = _append_artifact(
        state,
        "prepare_input",
        {
            "input_length": len(raw_input),
            "clean_length": len(clean_text),
            "truncated": len(clean_text) > MAX_INPUT_CHARS,
        },
    )

    if not clean_text:
        return {
            "clean_text": "",
            "retry_count": state.get("retry_count", 0),
            "max_retries": state.get("max_retries", 1),
            "missing_fields": list(REQUIRED_FIELDS),
            "validation_errors": ["Input is empty."],
            "status": "failed",
            "intermediate_artifacts": artifacts,
        }

    if len(clean_text) > MAX_INPUT_CHARS:
        clean_text = clean_text[:MAX_INPUT_CHARS].rstrip()
        artifacts = artifacts + [
            {
                "step": "truncate_input",
                "data": {"max_input_chars": MAX_INPUT_CHARS},
            }
        ]

    return {
        "clean_text": clean_text,
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", 1),
        "missing_fields": [],
        "validation_errors": [],
        "intermediate_artifacts": artifacts,
    }


# 첫 번째 LLM 단계: 원문에서 기술 사양 후보만 뽑아낸다.
def extract_specs(state: PromptChainingState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            EXTRACT_SPECS_SYSTEM_PROMPT,
            EXTRACT_SPECS_USER_PROMPT.format(clean_text=state.get("clean_text", "")),
        )
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        return _runtime_failure(state, "extract_specs", exc)

    return {
        "raw_extraction": content,
        "intermediate_artifacts": _append_artifact(
            state,
            "extract_specs",
            {"raw_extraction": content},
        ),
    }


# 두 번째 LLM 단계: 추출 결과를 고정된 JSON 스키마로 변환한다.
def transform_to_json(state: PromptChainingState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            TRANSFORM_TO_JSON_SYSTEM_PROMPT,
            TRANSFORM_TO_JSON_USER_PROMPT.format(
                raw_extraction=state.get("raw_extraction", "")
            ),
        )
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        return _runtime_failure(state, "transform_to_json", exc)

    return {
        "raw_transformation": content,
        "intermediate_artifacts": _append_artifact(
            state,
            "transform_to_json",
            {"raw_transformation": content},
        ),
    }


# 결정론적 검증 단계: JSON 파싱, 필수 필드, 원문 근거 여부를 확인한다.
def validate_output(state: PromptChainingState) -> dict[str, Any]:
    raw_transformation = state.get("raw_transformation", "")
    parsed, parse_errors = _parse_json_object(raw_transformation)

    validation_errors = list(parse_errors)
    missing_fields: list[str] = []
    specifications: dict[str, Any] = {}

    if parsed is not None:
        specifications = _extract_specifications(parsed)
        missing_fields = _missing_required_fields(specifications)
        validation_errors.extend(
            _unsupported_evidence_errors(specifications, state.get("clean_text", ""))
        )

    if missing_fields:
        validation_errors.append(
            "Missing required fields: " + ", ".join(missing_fields) + "."
        )

    status = "ok" if not validation_errors and not missing_fields else "needs_review"

    return {
        "specifications": specifications,
        "missing_fields": missing_fields,
        "validation_errors": validation_errors,
        "status": status,
        "intermediate_artifacts": _append_artifact(
            state,
            "validate_output",
            {
                "parsed": parsed,
                "missing_fields": missing_fields,
                "validation_errors": validation_errors,
                "status": status,
            },
        ),
    }


# 복구 단계: 원문, 이전 출력, 검증 오류를 함께 주고 LLM에게 JSON만 다시 만들게 한다.
def repair_output(state: PromptChainingState) -> dict[str, Any]:
    retry_count = state.get("retry_count", 0) + 1

    try:
        content = _invoke_model(
            REPAIR_JSON_SYSTEM_PROMPT,
            REPAIR_JSON_USER_PROMPT.format(
                clean_text=state.get("clean_text", ""),
                raw_transformation=state.get("raw_transformation", ""),
                validation_errors="\n".join(state.get("validation_errors", [])),
                missing_fields=", ".join(state.get("missing_fields", [])),
            ),
        )
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        failure = _runtime_failure(state, "repair_output", exc)
        failure["retry_count"] = retry_count
        return failure

    return {
        "raw_transformation": content,
        "retry_count": retry_count,
        "intermediate_artifacts": _append_artifact(
            state,
            "repair_output",
            {
                "retry_count": retry_count,
                "raw_transformation": content,
            },
        ),
    }


# 성공 또는 실패 상태를 Studio/API에서 보기 쉬운 최종 출력 형태로 모은다.
def finalize(state: PromptChainingState) -> dict[str, Any]:
    final_output = {
        "status": state.get("status", "ok"),
        "specifications": state.get("specifications", {}),
        "missing_fields": state.get("missing_fields", []),
        "validation_errors": state.get("validation_errors", []),
        "retry_count": state.get("retry_count", 0),
    }
    return {
        "final_output": final_output,
        "intermediate_artifacts": _append_artifact(
            state,
            "finalize",
            {"final_output": final_output},
        ),
    }


# 복구 한도를 넘었거나 정보가 부족하면 검토 필요 상태로 종료한다.
def mark_needs_review(state: PromptChainingState) -> dict[str, Any]:
    status = "failed" if state.get("status") == "failed" else "needs_review"
    final_output = {
        "status": status,
        "specifications": state.get("specifications", {}),
        "missing_fields": state.get("missing_fields", []),
        "validation_errors": state.get("validation_errors", []),
        "retry_count": state.get("retry_count", 0),
    }
    return {
        "status": status,
        "final_output": final_output,
        "intermediate_artifacts": _append_artifact(
            state,
            "mark_needs_review",
            {"final_output": final_output},
        ),
    }


def _invoke_model(system_prompt: str, user_prompt: str) -> str:
    response = get_chat_model().invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    content = getattr(response, "content", response)
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _append_artifact(
    state: PromptChainingState, step: str, data: dict[str, Any]
) -> list[Artifact]:
    return [*state.get("intermediate_artifacts", []), {"step": step, "data": data}]


def _runtime_failure(
    state: PromptChainingState, step: str, exc: Exception
) -> dict[str, Any]:
    error = f"{step} model invocation failed: {exc}"
    return {
        "status": "failed",
        "validation_errors": [*state.get("validation_errors", []), error],
        "intermediate_artifacts": _append_artifact(
            state,
            step,
            {"error": error},
        ),
    }


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any] | None, list[str]]:
    candidate = _strip_code_fence(raw_text)
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return None, [f"Malformed JSON: {exc.msg}."]

    if not isinstance(parsed, dict):
        return None, ["JSON root must be an object."]

    return parsed, []


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _extract_specifications(parsed: dict[str, Any]) -> dict[str, Any]:
    nested = parsed.get("specifications")
    source = nested if isinstance(nested, dict) else parsed
    return {field: source.get(field) for field in REQUIRED_FIELDS}


def _missing_required_fields(specifications: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    for field in REQUIRED_FIELDS:
        value = specifications.get(field)
        if value is None or str(value).strip().lower() in {"", "null", "none"}:
            missing.append(field)
    return missing


def _unsupported_evidence_errors(
    specifications: dict[str, Any], clean_text: str
) -> list[str]:
    source_tokens = set(_significant_tokens(clean_text))
    errors: list[str] = []

    for field, value in specifications.items():
        if value is None:
            continue
        value_tokens = _significant_tokens(str(value))
        if value_tokens and not source_tokens.intersection(value_tokens):
            errors.append(f"{field} value is not supported by the source text.")

    return errors


def _significant_tokens(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9.]+", text.lower())
        if len(token) >= 3
    ]
