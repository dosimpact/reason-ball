from __future__ import annotations

import pytest
from pydantic import ValidationError

from langchain_lecture.projects_2.project_09_structured_output_extractor.extractor import (
    extract_batch,
    extract_meeting,
    load_example_inputs,
)
from langchain_lecture.projects_2.project_09_structured_output_extractor.graph import (
    graph,
)
from langchain_lecture.projects_2.project_09_structured_output_extractor.schemas import (
    ActionItem,
    MeetingExtraction,
)


def test_schema_accepts_nullable_optional_fields():
    extraction = MeetingExtraction(
        summary="Planning meeting",
        action_items=[ActionItem(owner=None, task="Review launch notes", due_date=None)],
    )

    dumped = extraction.model_dump()

    assert dumped["action_items"][0]["owner"] is None
    assert dumped["action_items"][0]["due_date"] is None


def test_schema_rejects_empty_required_task():
    with pytest.raises(ValidationError):
        ActionItem(task=" ")


def test_fallback_extracts_complete_action_item():
    outcome = extract_meeting(
        "Product sync: Alice will draft the launch checklist by Friday (priority: high)."
    )

    item = outcome.extraction.action_items[0]

    assert outcome.method == "heuristic_fallback"
    assert item.owner == "Alice"
    assert item.task == "draft the launch checklist"
    assert item.due_date == "Friday"
    assert item.priority == "high"


def test_fallback_handles_missing_and_ambiguous_fields():
    outcome = extract_meeting(
        "Retro: Someone should follow up on analytics before next week. "
        "Bob should review the retry plan."
    )

    assert len(outcome.extraction.action_items) == 2
    assert outcome.extraction.action_items[0].owner is None
    assert "action_items.0.owner" in outcome.extraction.ambiguous_fields
    assert outcome.extraction.action_items[1].owner == "Bob"
    assert "action_items.1.due_date" in outcome.extraction.missing_fields


def test_fallback_cleans_korean_owner_particles_and_due_suffix():
    outcome = extract_meeting("민수는 고객 인터뷰 질문지를 다음 주까지 준비하기로 했다.")

    item = outcome.extraction.action_items[0]

    assert item.owner == "민수"
    assert item.due_date == "다음 주"


def test_validation_failure_from_model_uses_fallback():
    class InvalidStructuredModel:
        def invoke(self, _payload):
            return {"summary": "", "action_items": [{"task": ""}]}

    class InvalidModel:
        def with_structured_output(self, _schema):
            return InvalidStructuredModel()

    outcome = extract_meeting("Alice will prepare release notes by tomorrow.", model=InvalidModel())

    assert outcome.method == "heuristic_fallback"
    assert outcome.errors
    assert outcome.extraction.action_items[0].owner == "Alice"


def test_batch_and_example_inputs_are_offline_runnable():
    examples = load_example_inputs()
    outcomes = extract_batch(example["text"] for example in examples)

    assert len(examples) >= 5
    assert len(outcomes) == len(examples)
    assert any(outcome.extraction.action_items for outcome in outcomes)


def test_graph_returns_serializable_extraction():
    state = graph.invoke({"text": "Nora should send the report by 2026-08-01."})

    assert state["error"] == ""
    assert state["method"] == "heuristic_fallback"
    assert state["extraction"]["action_items"][0]["owner"] == "Nora"
