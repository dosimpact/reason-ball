"""비정형 입력을 정해진 스키마로 추출하는 구조화 출력 예제입니다. 입력 텍스트를 구조화된 데이터로 변환하는 추출 로직입니다."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from langchain_core.prompts import ChatPromptTemplate
from pydantic import ValidationError

from langchain_lecture.projects_2.project_09_structured_output_extractor.schemas import (
    ActionItem,
    EvidenceSpan,
    MeetingExtraction,
    Priority,
    coerce_meeting_extraction,
    validation_error_messages,
)


EXAMPLES_PATH = Path(__file__).with_name("examples") / "inputs.jsonl"

EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Extract meeting action items as typed data. "
            "Do not guess missing owners or due dates. "
            "Use null for optional fields when the source text is ambiguous.",
        ),
        ("human", "{text}"),
    ]
)

OWNER_PATTERNS = [
    re.compile(r"(?P<owner>[A-Z][a-zA-Z가-힣]+)\s+(?:will|should|to)\s+(?P<task>.+)", re.IGNORECASE),
    re.compile(r"(?P<owner>[A-Z][a-zA-Z가-힣]+)\s*[:：-]\s*(?P<task>.+)"),
    re.compile(r"(?P<owner>[가-힣]{2,4})(?:님|씨)?(?:은|는|이|가)?\s*(?P<task>.+)"),
]
AMBIGUOUS_OWNER_TERMS = ("someone", "somebody", "누군가", "담당자 미정", "담당자 불명", "owner tbd")
ACTION_HINTS = (
    "action",
    "todo",
    "should",
    "will",
    "해야",
    "하기로",
    "준비",
    "작성",
    "공유",
    "검토",
    "예약",
    "보내",
    "완료",
    "follow up",
)


@dataclass(frozen=True)
class ExtractionOutcome:
    extraction: MeetingExtraction
    method: str
    errors: list[str]

    def to_json(self) -> str:
        return self.extraction.model_dump_json(indent=2)

    def to_api_response(self) -> dict[str, Any]:
        return {
            "data": self.extraction.model_dump(mode="json"),
            "meta": {"method": self.method, "errors": self.errors},
        }

    def to_db_rows(self, *, meeting_id: str = "demo") -> list[dict[str, Any]]:
        rows = []
        for index, item in enumerate(self.extraction.action_items, start=1):
            rows.append(
                {
                    "meeting_id": meeting_id,
                    "item_index": index,
                    "owner": item.owner,
                    "task": item.task,
                    "due_date": item.due_date,
                    "priority": item.priority,
                    "confidence": item.confidence,
                }
            )
        return rows


def build_extraction_chain(model: Any):
    structured_model = model.with_structured_output(MeetingExtraction)
    return EXTRACTION_PROMPT | structured_model


def extract_meeting(text: str, model: Any | None = None) -> ExtractionOutcome:
    if model is not None:
        try:
            response = build_extraction_chain(model).invoke({"text": text})
            return ExtractionOutcome(
                extraction=coerce_meeting_extraction(response),
                method="structured_model",
                errors=[],
            )
        except ValidationError as exc:
            return _fallback_outcome(text, validation_error_messages(exc))
        except Exception as exc:
            return _fallback_outcome(text, [f"{type(exc).__name__}: {exc}"])

    return _fallback_outcome(text, [])


def extract_batch(texts: Iterable[str], model: Any | None = None) -> list[ExtractionOutcome]:
    return [extract_meeting(text, model=model) for text in texts]


def load_example_inputs(path: Path = EXAMPLES_PATH) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def _fallback_outcome(text: str, errors: list[str]) -> ExtractionOutcome:
    try:
        extraction = heuristic_extract_meeting(text)
        return ExtractionOutcome(extraction=extraction, method="heuristic_fallback", errors=errors)
    except ValidationError as exc:
        fallback_errors = [*errors, *validation_error_messages(exc)]
        return ExtractionOutcome(
            extraction=MeetingExtraction(
                summary=_summarize(text),
                action_items=[],
                missing_fields=["action_items"],
            ),
            method="empty_fallback",
            errors=fallback_errors,
        )


def heuristic_extract_meeting(text: str) -> MeetingExtraction:
    cleaned = " ".join(text.strip().split())
    sentences = _split_sentences(cleaned)
    action_items = []
    missing_fields: list[str] = []
    ambiguous_fields: list[str] = []

    for sentence in sentences:
        if not _looks_actionable(sentence):
            continue
        item = _parse_action_sentence(sentence)
        action_items.append(item)

    for index, item in enumerate(action_items):
        prefix = f"action_items.{index}"
        if item.owner is None:
            target = ambiguous_fields if _has_ambiguous_owner(item.evidence.text if item.evidence else "") else missing_fields
            target.append(f"{prefix}.owner")
        if item.due_date is None:
            missing_fields.append(f"{prefix}.due_date")
        if item.priority is None:
            missing_fields.append(f"{prefix}.priority")

    return MeetingExtraction(
        summary=_summarize(cleaned),
        action_items=action_items,
        missing_fields=missing_fields,
        ambiguous_fields=ambiguous_fields,
    )


def _parse_action_sentence(sentence: str) -> ActionItem:
    owner: str | None = None
    task = sentence

    if not _has_ambiguous_owner(sentence):
        for pattern in OWNER_PATTERNS:
            match = pattern.search(sentence)
            if match:
                owner = _clean_owner(match.group("owner"))
                task = match.group("task")
                break

    task = _remove_due_date(_remove_priority_marker(task))
    task = _normalize_task(task)
    due_date = _extract_due_date(sentence)
    priority = _extract_priority(sentence)
    confidence = 0.85 if owner and due_date else 0.6 if owner or due_date else 0.4

    return ActionItem(
        owner=owner,
        task=task,
        due_date=due_date,
        priority=priority,
        evidence=EvidenceSpan(text=sentence),
        confidence=confidence,
    )


def _split_sentences(text: str) -> list[str]:
    candidates = re.split(r"(?:\n+|[.;]|[。！？])", text)
    expanded: list[str] = []
    for candidate in candidates:
        expanded.extend(re.split(r"\s*(?:,?\s+and\s+|그리고|또한)\s*", candidate))
    return [candidate.strip(" -\t") for candidate in expanded if candidate.strip(" -\t")]


def _looks_actionable(sentence: str) -> bool:
    lowered = sentence.lower()
    return any(hint in lowered for hint in ACTION_HINTS) or bool(_extract_due_date(sentence))


def _has_ambiguous_owner(sentence: str) -> bool:
    lowered = sentence.lower()
    return any(term in lowered for term in AMBIGUOUS_OWNER_TERMS)


def _clean_owner(owner: str) -> str | None:
    cleaned = owner.strip(" :-：,")
    if re.fullmatch(r"[가-힣]{3,5}", cleaned) and cleaned[-1] in {"은", "는", "이", "가"}:
        cleaned = cleaned[:-1]
    return cleaned or None


def _normalize_task(task: str) -> str:
    cleaned = re.sub(r"^(will|should|to|은|는|이|가)\s+", "", task.strip(), flags=re.IGNORECASE)
    cleaned = cleaned.strip(" :-：,")
    return cleaned or "Review follow-up action"


def _extract_due_date(sentence: str) -> str | None:
    patterns = [
        r"(?:by|before|due)\s+(?P<date>[A-Z][a-z]+day|tomorrow|today|next\s+week|EOD|end of week|\d{4}-\d{2}-\d{2})",
        r"(?P<date>\d{1,2}/\d{1,2}(?:/\d{2,4})?)",
        r"(?P<date>내일|오늘|이번 주(?:까지)?|다음 주(?:까지)?|\d{1,2}월\s*\d{1,2}일(?:까지)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, sentence, flags=re.IGNORECASE)
        if match:
            return match.group("date").strip().removesuffix("까지").strip()
    return None


def _extract_priority(sentence: str) -> Priority | None:
    lowered = sentence.lower()
    if re.search(r"\b(high|urgent|p0|p1|긴급|높음|최우선)\b", lowered):
        return Priority.HIGH
    if re.search(r"\b(medium|normal|보통|중간)\b", lowered):
        return Priority.MEDIUM
    if re.search(r"\b(low|낮음)\b", lowered):
        return Priority.LOW
    return None


def _remove_due_date(task: str) -> str:
    task = re.sub(
        r"\s*(?:by|before|due)\s+(?:[A-Z][a-z]+day|tomorrow|today|next\s+week|EOD|end of week|\d{4}-\d{2}-\d{2})",
        "",
        task,
        flags=re.IGNORECASE,
    )
    task = re.sub(r"\s*\d{1,2}/\d{1,2}(?:/\d{2,4})?", "", task)
    return re.sub(r"\s*(?:내일|오늘|이번 주(?:까지)?|다음 주(?:까지)?|\d{1,2}월\s*\d{1,2}일(?:까지)?)", "", task)


def _remove_priority_marker(task: str) -> str:
    return re.sub(
        r"\s*\((?:priority:\s*)?(?:high|medium|low|urgent|normal|p0|p1|긴급|높음|보통|중간|낮음)\)",
        "",
        task,
        flags=re.IGNORECASE,
    )


def _summarize(text: str) -> str:
    cleaned = " ".join(text.strip().split())
    if not cleaned:
        return "No meeting content was provided."
    first_sentence = _split_sentences(cleaned)[0] if _split_sentences(cleaned) else cleaned
    return first_sentence[:160]
