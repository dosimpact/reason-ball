from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring import nodes
from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring.graph import (
    graph,
)


GOOD_ADD_CODE = """def add_numbers(a: int, b: int) -> int:
    \"\"\"Return the sum of two integers.

    Example:
        add_numbers(2, 3) == 5
    \"\"\"
    return a + b
"""

BAD_SYNTAX_CODE = """def add_numbers(a: int, b: int) -> int
    return a + b
"""

UNSAFE_CODE = """import os


def clean_path(path: str) -> None:
    os.remove(path)
"""


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


def monitor_response(
    *,
    status: str = "met",
    score: float = 0.92,
    verdicts: list[dict[str, Any]] | None = None,
    feedback: str = "All required goals are satisfied.",
    safety_flags: list[str] | None = None,
    actionable: bool = True,
) -> str:
    return json.dumps(
        {
            "overall_status": status,
            "score": score,
            "feedback": feedback,
            "goal_verdicts": verdicts
            or [
                {
                    "goal_id": "correctness",
                    "status": "met",
                    "evidence": "The function satisfies the requested behavior.",
                    "recoverable": True,
                },
                {
                    "goal_id": "simplicity",
                    "status": "met",
                    "evidence": "The implementation is short and readable.",
                    "recoverable": True,
                },
                {
                    "goal_id": "edge_cases",
                    "status": "met",
                    "evidence": "The function handles integer inputs directly.",
                    "recoverable": True,
                },
                {
                    "goal_id": "examples",
                    "status": "met",
                    "evidence": "The docstring includes an example.",
                    "recoverable": True,
                },
            ],
            "safety_flags": safety_flags or [],
            "uncertain": False,
            "actionable": actionable,
        }
    )


def history_nodes(result: dict[str, Any]) -> list[str]:
    return [event["node"] for event in result["progress_history"]]


def test_goal_monitoring_happy_path_decomposes_goals_and_finalizes(monkeypatch):
    fake_model = FakeChatModel([GOOD_ADD_CODE, monitor_response()])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function that adds two integers. "
                "Goals: functionally correct, simple to understand, "
                "handles edge cases, includes examples"
            )
        }
    )

    assert result["status"] == "ok"
    assert result["goal_status"] == "met"
    assert result["iteration_count"] == 1
    assert result["final_output"]["status"] == "ok"
    assert result["final_output"]["artifact"] == GOOD_ADD_CODE.strip()
    assert [goal["id"] for goal in result["goal_contract"]] == [
        "correctness",
        "simplicity",
        "edge_cases",
        "examples",
    ]
    assert result["check_results"]["passed"] is True
    assert result["monitoring_report"]["objective_checks_passed"] is True
    assert result["final_output"]["unresolved_goals"] == []
    assert result["errors"] == []
    assert history_nodes(result) == [
        "prepare_input",
        "define_goal_contract",
        "validate_goal_contract",
        "generate_candidate",
        "run_objective_checks",
        "monitor_candidate",
        "finalize",
    ]
    assert len(fake_model.calls) == 2


def test_blank_input_fails_before_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["goal_status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["iteration_count"] == 0
    assert result["errors"] == ["Input is empty."]
    assert fake_model.calls == []


def test_missing_goals_route_to_review_without_generation(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Write a Python function that adds two integers."})

    assert result["status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert result["goal_contract"] == []
    assert "At least one measurable goal is required." in result["errors"]
    assert "generate_candidate" not in history_nodes(result)
    assert fake_model.calls == []


def test_vague_goal_routes_to_review_without_generation(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {"input": "Use case: Write a Python function. Goals: make it good"}
    )

    assert result["status"] == "needs_review"
    assert result["final_output"]["status"] == "needs_review"
    assert any("too vague" in error for error in result["errors"])
    assert fake_model.calls == []


def test_contradictory_goals_route_to_review(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function. Goals: shortest possible, "
                "comprehensive explanation"
            )
        }
    )

    assert result["status"] == "needs_review"
    assert any("Contradictory goals" in error for error in result["errors"])
    assert fake_model.calls == []


def test_syntax_failure_revises_and_preserves_previous_artifact(monkeypatch):
    fake_model = FakeChatModel(
        [
            BAD_SYNTAX_CODE,
            monitor_response(
                status="needs_revision",
                score=0.25,
                feedback="Fix Python syntax before judging behavior.",
                verdicts=[
                    {
                        "goal_id": "correctness",
                        "status": "unmet",
                        "evidence": "Syntax did not parse.",
                        "recoverable": True,
                    },
                    {
                        "goal_id": "edge_cases",
                        "status": "unmet",
                        "evidence": "Cannot verify edge cases until syntax is fixed.",
                        "recoverable": True,
                    },
                ],
            ),
            GOOD_ADD_CODE,
            monitor_response(
                verdicts=[
                    {
                        "goal_id": "correctness",
                        "status": "met",
                        "evidence": "Syntax and behavior are acceptable.",
                        "recoverable": True,
                    },
                    {
                        "goal_id": "edge_cases",
                        "status": "met",
                        "evidence": "Integer boundaries are handled by normal addition.",
                        "recoverable": True,
                    },
                ]
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function that adds two integers. "
                "Goals: functionally correct, handles edge cases"
            ),
            "max_iterations": 2,
        }
    )

    assert result["status"] == "ok"
    assert result["iteration_count"] == 2
    assert result["previous_artifacts"] == [BAD_SYNTAX_CODE.strip()]
    assert result["candidate_artifact"] == GOOD_ADD_CODE.strip()
    assert "revise_candidate" in history_nodes(result)
    assert len(fake_model.calls) == 4


def test_unmet_goals_after_max_iterations_route_to_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            GOOD_ADD_CODE,
            monitor_response(
                status="needs_revision",
                score=0.4,
                feedback="Edge-case goal is still unresolved.",
                verdicts=[
                    {
                        "goal_id": "correctness",
                        "status": "met",
                        "evidence": "The basic behavior is correct.",
                        "recoverable": True,
                    },
                    {
                        "goal_id": "edge_cases",
                        "status": "unmet",
                        "evidence": "No edge-case handling was shown.",
                        "recoverable": True,
                    },
                ],
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function that adds two integers. "
                "Goals: functionally correct, handles edge cases"
            ),
            "max_iterations": 1,
        }
    )

    assert result["status"] == "needs_review"
    assert result["iteration_count"] == 1
    assert result["final_output"]["unresolved_goals"] == ["edge_cases"]
    assert "Maximum goal-monitoring attempts reached." in result["errors"]
    assert "revise_candidate" not in history_nodes(result)
    assert len(fake_model.calls) == 2


def test_unsafe_generated_code_routes_to_review_even_with_high_score(monkeypatch):
    fake_model = FakeChatModel(
        [
            UNSAFE_CODE,
            monitor_response(
                score=0.99,
                verdicts=[
                    {
                        "goal_id": "correctness",
                        "status": "met",
                        "evidence": "The reviewer claimed it solves the task.",
                        "recoverable": True,
                    },
                    {
                        "goal_id": "safety",
                        "status": "met",
                        "evidence": "The reviewer missed the file deletion.",
                        "recoverable": True,
                    },
                ],
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python helper for validating path strings. "
                "Goals: functionally correct, safe with no file writes"
            )
        }
    )

    assert result["status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert "import:os" in result["check_results"]["unsafe_operations"]
    assert "call:os.remove" in result["check_results"]["unsafe_operations"]
    assert result["monitoring_report"]["safety_flags"]
    assert "safety" in result["final_output"]["unresolved_goals"]
    assert len(fake_model.calls) == 2


def test_malformed_monitor_output_routes_to_review(monkeypatch):
    fake_model = FakeChatModel([GOOD_ADD_CODE, "The code looks good to me."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function that adds two integers. "
                "Goals: functionally correct"
            )
        }
    )

    assert result["status"] == "needs_review"
    assert result["monitoring_report"]["overall_status"] == "needs_review"
    assert result["monitoring_report"]["critical_uncertainty"] is True
    assert "Monitoring report could not be normalized." in result["errors"]
    assert len(fake_model.calls) == 2


def test_injected_components_can_drive_deterministic_success(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def generator(state):
        assert state["iteration_count"] == 0
        return GOOD_ADD_CODE

    def checker(state):
        assert "add_numbers" in state["candidate_artifact"]
        return {"passed": True, "examples_passed": True, "status": "passed"}

    def monitor(state):
        assert state["check_results"]["examples_passed"] is True
        return json.loads(monitor_response())

    result = graph.invoke(
        {
            "input": (
                "Use case: Write a Python function that adds two integers. "
                "Goals: functionally correct, simple to understand, "
                "handles edge cases, includes examples"
            ),
            "candidate_generator": generator,
            "objective_checker": checker,
            "candidate_monitor": monitor,
        }
    )

    assert result["status"] == "ok"
    assert result["final_output"]["status"] == "ok"
    assert result["check_results"]["examples_passed"] is True
    assert fake_model.calls == []
