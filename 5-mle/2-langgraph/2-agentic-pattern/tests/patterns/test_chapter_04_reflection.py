from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_04_reflection import nodes
from agentic_design_patterns.patterns.chapter_04_reflection.graph import graph


GOOD_FACTORIAL_CODE = '''def calculate_factorial(n):
    """Return n! for a non-negative integer."""
    if n < 0:
        raise ValueError("n must be non-negative")
    if n == 0:
        return 1
    result = 1
    for value in range(2, n + 1):
        result *= value
    return result
'''

MISSING_NEGATIVE_CODE = '''def calculate_factorial(n):
    """Return n! for a non-negative integer."""
    if n == 0:
        return 1
    result = 1
    for value in range(1, n + 1):
        result *= value
    return result
'''


class FakeChatModel:
    def __init__(self, responses: list[str | Exception]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return AIMessage(content=response)


def test_reflection_accepts_first_draft(monkeypatch):
    fake_model = FakeChatModel(
        [
            GOOD_FACTORIAL_CODE,
            '{"status": "accepted", "critique": "Accepted: all requirements are satisfied."}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({})

    assert result["status"] == "ok"
    assert result["final_output"]["accepted"] is True
    assert result["final_output"]["iterations"] == 1
    assert result["current_draft"] == GOOD_FACTORIAL_CODE.strip()
    assert result["critique_status"] == "accepted"
    assert result["errors"] == []
    assert len(fake_model.calls) == 2
    assert [entry["step"] for entry in result["revision_history"]] == [
        "generate_initial_draft",
        "critique_draft",
    ]
    assert result["static_check_results"]["has_docstring"] is True
    assert result["static_check_results"]["handles_zero"] is True
    assert result["static_check_results"]["raises_value_error_for_negative"] is True


def test_reflection_loop_revises_then_accepts(monkeypatch):
    fake_model = FakeChatModel(
        [
            MISSING_NEGATIVE_CODE,
            (
                '{"status": "needs_revision", '
                '"critique": "Add ValueError handling for negative input."}'
            ),
            GOOD_FACTORIAL_CODE,
            "CODE_IS_PERFECT",
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Write calculate_factorial(n)."})

    assert result["status"] == "ok"
    assert result["iteration"] == 2
    assert result["final_output"]["iterations"] == 2
    assert result["final_output"]["accepted"] is True
    assert "ValueError" in result["final_output"]["final_code"]
    assert result["critique"] == "Accepted: all requirements are satisfied."
    assert len(fake_model.calls) == 4
    assert [entry["step"] for entry in result["revision_history"]] == [
        "generate_initial_draft",
        "critique_draft",
        "refine_draft",
        "critique_draft",
    ]
    assert result["revision_history"][1]["critique_status"] == "needs_revision"
    assert result["revision_history"][3]["critique_status"] == "accepted"


def test_max_iterations_returns_needs_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            MISSING_NEGATIVE_CODE,
            (
                '{"status": "needs_revision", '
                '"critique": "Still missing negative input handling."}'
            ),
            MISSING_NEGATIVE_CODE,
            (
                '{"status": "needs_revision", '
                '"critique": "Still missing negative input handling."}'
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Write calculate_factorial(n).",
            "max_iterations": 2,
        }
    )

    assert result["status"] == "needs_review"
    assert result["iteration"] == 2
    assert result["final_output"]["accepted"] is False
    assert result["final_output"]["iterations"] == 2
    assert result["critique_status"] == "needs_revision"
    assert result["errors"] == ["max_iterations reached before acceptance"]
    assert len(fake_model.calls) == 4


def test_blank_input_fails_before_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["accepted"] is False
    assert result["iteration"] == 0
    assert result["errors"] == ["Input is empty."]
    assert fake_model.calls == []


def test_malformed_critic_output_routes_to_needs_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            GOOD_FACTORIAL_CODE,
            "The code looks fine to me.",
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Write calculate_factorial(n)."})

    assert result["status"] == "needs_review"
    assert result["critique_status"] == "invalid"
    assert result["raw_critic_output"] == "The code looks fine to me."
    assert result["final_output"]["accepted"] is False
    assert result["final_output"]["final_code"] == GOOD_FACTORIAL_CODE.strip()
    assert result["errors"] == ["Critic output could not be normalized."]
    assert len(fake_model.calls) == 2


def test_unusable_producer_output_falls_back_without_critic(monkeypatch):
    fake_model = FakeChatModel(["Here is how factorial works in plain English."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Write calculate_factorial(n)."})

    assert result["status"] == "needs_review"
    assert result["critique_status"] == "invalid"
    assert result["iteration"] == 1
    assert result["current_draft"] == "Here is how factorial works in plain English."
    assert result["final_output"]["accepted"] is False
    assert result["final_output"]["final_code"] == result["current_draft"]
    assert result["errors"] == [
        "generate_initial_draft returned an unusable draft without a function definition."
    ]
    assert len(fake_model.calls) == 1
