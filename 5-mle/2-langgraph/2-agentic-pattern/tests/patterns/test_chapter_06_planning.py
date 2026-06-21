from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_06_planning import nodes
from agentic_design_patterns.patterns.chapter_06_planning.graph import graph


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


SOURCE_NOTES = [
    {
        "source_id": "note_1",
        "title": "Market demand",
        "text": (
            "Market demand for home battery storage is rising as households "
            "seek backup power and lower peak electricity costs."
        ),
        "summary": "Demand is rising because homes want backup power and lower costs.",
    },
    {
        "source_id": "note_2",
        "title": "Adoption barriers",
        "text": (
            "Adoption barriers include upfront price, permitting delays, and "
            "unclear installer availability."
        ),
        "summary": "Price, permits, and installer availability slow adoption.",
    },
]


def plan_response(steps: list[dict]) -> str:
    return json.dumps({"plan": steps})


def source_step(
    step_id: str,
    description: str,
    *,
    depends_on: list[str] | None = None,
) -> dict:
    return {
        "id": step_id,
        "description": description,
        "depends_on": depends_on or [],
        "tool": "source_notes",
        "acceptance_criteria": ["Find relevant source evidence."],
        "status": "pending",
    }


def analysis_step(
    step_id: str,
    description: str,
    *,
    depends_on: list[str] | None = None,
) -> dict:
    return {
        "id": step_id,
        "description": description,
        "depends_on": depends_on or [],
        "tool": "analysis",
        "acceptance_criteria": ["Synthesize completed evidence."],
        "status": "pending",
    }


def history_nodes(result: dict) -> list[str]:
    return [event["node"] for event in result["execution_history"]]


def executed_step_ids(result: dict) -> list[str]:
    return [
        event["details"]["step_id"]
        for event in result["execution_history"]
        if event["node"] == "execute_step" and "step_id" in event["details"]
    ]


def test_planning_happy_path_generates_plan_executes_steps_and_synthesizes(
    monkeypatch,
):
    fake_model = FakeChatModel(
        [
            plan_response(
                [
                    source_step("step_1", "Gather market demand evidence."),
                    source_step(
                        "step_2",
                        "Gather adoption barrier evidence.",
                        depends_on=["step_1"],
                    ),
                    analysis_step(
                        "step_3",
                        "Compare demand and adoption barriers.",
                        depends_on=["step_1", "step_2"],
                    ),
                ]
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
        }
    )

    assert result["status"] == "ok"
    assert result["final_output"]["status"] == "ok"
    assert all(step["status"] == "complete" for step in result["plan"])
    assert list(result["step_results"]) == ["step_1", "step_2", "step_3"]
    assert result["final_output"]["evidence"] == [
        {
            "source_id": "note_1",
            "title": "Market demand",
            "summary": "Demand is rising because homes want backup power and lower costs.",
        },
        {
            "source_id": "note_2",
            "title": "Adoption barriers",
            "summary": "Price, permits, and installer availability slow adoption.",
        },
    ]
    assert "Research Goal: Create a brief" in result["final_report"]
    assert "Unresolved Gaps:\nNone" in result["final_report"]
    assert history_nodes(result) == [
        "prepare_input",
        "create_plan",
        "validate_plan",
        "review_plan",
        "select_next_step",
        "execute_step",
        "assess_progress",
        "select_next_step",
        "execute_step",
        "assess_progress",
        "select_next_step",
        "execute_step",
        "assess_progress",
        "synthesize_report",
    ]
    assert len(fake_model.calls) == 1


def test_invalid_plan_schema_routes_through_repair(monkeypatch):
    invalid_plan = plan_response(
        [
            {
                "id": "step_1",
                "description": "Gather market demand evidence.",
                "depends_on": [],
                "acceptance_criteria": ["Find evidence."],
            }
        ]
    )
    repaired_plan = plan_response(
        [source_step("step_1", "Gather market demand evidence.")]
    )
    fake_model = FakeChatModel([invalid_plan, repaired_plan])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
        }
    )

    assert result["status"] == "ok"
    assert result["repair_count"] == 1
    assert result["plan_errors"] == []
    assert "repair_plan" in history_nodes(result)
    assert len(fake_model.calls) == 2


def test_invalid_circular_plan_ends_in_review_when_repair_is_exhausted(monkeypatch):
    fake_model = FakeChatModel(
        [
            plan_response(
                [
                    source_step("step_1", "Gather market demand.", depends_on=["step_2"]),
                    source_step("step_2", "Gather barriers.", depends_on=["step_1"]),
                ]
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
            "max_repairs": 0,
        }
    )

    assert result["status"] == "needs_review"
    assert result["final_output"]["status"] == "needs_review"
    assert any("circular dependencies" in error for error in result["plan_errors"])
    assert "execute_step" not in history_nodes(result)
    assert len(fake_model.calls) == 1


def test_dependencies_are_executed_only_when_ready(monkeypatch):
    fake_model = FakeChatModel(
        [
            plan_response(
                [
                    source_step(
                        "step_2",
                        "Gather adoption barrier evidence.",
                        depends_on=["step_1"],
                    ),
                    source_step("step_1", "Gather market demand evidence."),
                ]
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
        }
    )

    assert result["status"] == "ok"
    assert executed_step_ids(result) == ["step_1", "step_2"]


def test_missing_evidence_triggers_replan_and_preserves_completed_work(monkeypatch):
    initial_plan = plan_response(
        [
            source_step("step_1", "Gather market demand evidence."),
            source_step(
                "step_2",
                "Gather competitor pricing evidence.",
                depends_on=["step_1"],
            ),
        ]
    )
    replacement_plan = plan_response(
        [
            source_step("step_1", "Gather market demand evidence."),
            analysis_step(
                "step_3",
                "Summarize known demand evidence and disclose pricing gap.",
                depends_on=["step_1"],
            ),
        ]
    )
    fake_model = FakeChatModel([initial_plan, replacement_plan])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES[:1],
            "max_replans": 1,
        }
    )

    assert result["status"] == "ok"
    assert result["replan_count"] == 1
    assert result["step_results"]["step_1"]["status"] == "complete"
    assert result["step_results"]["step_3"]["status"] == "complete"
    assert "step_2" in result["step_results"]
    assert result["step_results"]["step_2"]["status"] == "blocked"
    assert any("No source evidence found for step_2" in gap for gap in result["knowledge_gaps"])
    assert result["final_output"]["knowledge_gaps"] == result["knowledge_gaps"]
    assert executed_step_ids(result) == ["step_1", "step_2", "step_3"]
    assert len(fake_model.calls) == 2


def test_max_replan_limit_routes_blocked_step_to_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            plan_response(
                [source_step("step_1", "Gather competitor pricing evidence.")]
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES[:1],
            "max_replans": 0,
        }
    )

    assert result["status"] == "needs_review"
    assert result["replan_count"] == 0
    assert "Replanning limit reached" in result["blocked_reason"]
    assert any("No source evidence found for step_1" in gap for gap in result["knowledge_gaps"])


def test_max_steps_limit_blocks_oversized_plan(monkeypatch):
    fake_model = FakeChatModel(
        [
            plan_response(
                [
                    source_step("step_1", "Gather market demand evidence."),
                    source_step("step_2", "Gather adoption barrier evidence."),
                ]
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
            "max_steps": 1,
            "max_repairs": 0,
        }
    )

    assert result["status"] == "needs_review"
    assert any("maximum is 1" in error for error in result["plan_errors"])
    assert "execute_step" not in history_nodes(result)


def test_denied_plan_approval_routes_to_review_without_execution(monkeypatch):
    fake_model = FakeChatModel(
        [plan_response([source_step("step_1", "Gather market demand evidence.")])]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Create a brief on the home battery storage market.",
            "source_notes": SOURCE_NOTES,
            "approved_plan": False,
        }
    )

    assert result["status"] == "needs_review"
    assert result["blocked_reason"] == "Plan approval was denied."
    assert "execute_step" not in history_nodes(result)


def test_empty_input_fails_before_planner_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["blocked_reason"] == "Input is empty."
    assert result["plan_errors"] == ["Input is empty."]
    assert fake_model.calls == []


def test_planner_model_error_is_captured(monkeypatch):
    fake_model = FakeChatModel([RuntimeError("planner unavailable")])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Create a brief on remote work."})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert any("create_plan model invocation failed" in error for error in result["plan_errors"])
    assert "planner unavailable" in result["blocked_reason"]
    assert len(fake_model.calls) == 1
