from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_20_prioritization import nodes
from agentic_design_patterns.patterns.chapter_20_prioritization.graph import (
    graph,
    route_after_assignment,
    route_after_dependencies,
    route_after_normalize,
    route_after_prepare,
    route_after_reprioritization,
)


class FakeChatModel:
    def __init__(self) -> None:
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content="[]")


def test_graph_constructs_and_empty_input_finalizes_without_model_call(monkeypatch):
    fake_model = FakeChatModel()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({})

    assert route_after_prepare({"status": "empty"}) == "finalize_priority_plan"
    assert result["status"] == "empty"
    assert result["priority_plan"]["ranked_tasks"] == []
    assert "No input or existing backlog" in result["warnings"][0]
    assert fake_model.calls == []


def test_urgent_login_request_is_p0_and_assigned_to_worker_b(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "input": "Create a task to implement a login system. It is urgent and should go to Worker B.",
        }
    )

    top = result["priority_plan"]["ranked_tasks"][0]
    assert top["priority"] == "P0"
    assert top["assigned_to"] == "Worker B"
    assert "urgent request" in top["rationale"]
    assert result["selected_next_actions"][0]["task_id"] == top["id"]
    assert result["needs_review"] is False


def test_missing_priority_and_assignee_default_to_p1_and_worker_a(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke({"input": "Create a task to review marketing website content."})

    task = result["priority_plan"]["ranked_tasks"][0]
    assert task["priority"] == "P1"
    assert task["assigned_to"] == "Worker A"
    assert any("default priority P1" in warning for warning in result["warnings"])
    assert any("default assignee Worker A" in warning for warning in result["warnings"])


def test_existing_backlog_and_new_urgent_task_are_ranked_together(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "input": "Create a task to fix the critical payment outage ASAP.",
            "existing_tasks": [
                {
                    "id": "TASK-001",
                    "description": "Review marketing website content",
                    "priority": "P1",
                    "assigned_to": "Worker A",
                }
            ],
        }
    )

    ranked = result["priority_plan"]["ranked_tasks"]
    assert [task["id"] for task in ranked] == ["TASK-002", "TASK-001"]
    assert ranked[0]["priority"] == "P0"
    assert len(ranked) == 2


def test_dependency_blocks_task_but_keeps_it_ranked(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "existing_tasks": [
                {
                    "id": "TASK-001",
                    "description": "Ship release",
                    "priority": "P0",
                    "dependencies": ["TASK-002"],
                },
                {
                    "id": "TASK-002",
                    "description": "Finish QA",
                    "priority": "P1",
                    "status": "open",
                },
            ]
        }
    )

    blocked = {task["id"]: task for task in result["priority_plan"]["ranked_tasks"]}
    assert blocked["TASK-001"]["blocked_reason"] == "Waiting for dependency TASK-002."
    assert result["priority_plan"]["blocked_tasks"][0]["id"] == "TASK-001"
    assert result["needs_review"] is False


def test_dependency_cycle_routes_to_human_review(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "existing_tasks": [
                {"id": "TASK-001", "description": "A", "priority": "P1", "dependencies": ["TASK-002"]},
                {"id": "TASK-002", "description": "B", "priority": "P1", "dependencies": ["TASK-001"]},
            ]
        }
    )

    assert route_after_dependencies({"status": "needs_review", "errors": ["cycle"]}) == "request_human_review"
    assert result["needs_review"] is True
    assert any("Dependency cycle detected" in error for error in result["errors"])
    assert "Human review required before execution." in result["warnings"]


def test_invalid_priority_with_defaults_disabled_routes_to_review(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "existing_tasks": [{"id": "TASK-001", "description": "Ambiguous task", "priority": "P9"}],
            "priority_policy": {"allow_default_priority": False},
        }
    )

    assert route_after_normalize({"status": "needs_review", "errors": ["bad"]}) == "request_human_review"
    assert result["needs_review"] is True
    assert any("missing or invalid priority" in error for error in result["errors"])


def test_not_urgent_text_does_not_become_p0(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke({"input": "Create a task to update docs. This is not urgent."})

    task = result["priority_plan"]["ranked_tasks"][0]
    assert task["priority"] == "P1"
    assert "negated urgency" in task["rationale"]


def test_dynamic_critical_event_triggers_one_reprioritization_pass(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "input": "Create a task to review the roadmap.",
            "environment_context": {
                "critical_event": "Production outage in checkout",
                "preferred_worker": "Worker B",
            },
        }
    )

    assert route_after_reprioritization(
        {"reprioritization_reason": "critical_event", "reprioritization_passes": 1}
    ) == "evaluate_task_criteria"
    assert result["reprioritization_passes"] == 1
    assert result["priority_plan"]["ranked_tasks"][0]["id"] == "TASK-CRITICAL"
    assert result["priority_plan"]["ranked_tasks"][0]["priority"] == "P0"


def test_assignment_review_when_default_assignment_is_forbidden(monkeypatch):
    monkeypatch.setattr(nodes, "get_chat_model", lambda: FakeChatModel())

    result = graph.invoke(
        {
            "input": "Create a task to review the incident notes.",
            "priority_policy": {"allow_default_assignment": False},
        }
    )

    assert route_after_assignment({"needs_review": True}) == "request_human_review"
    assert result["needs_review"] is True
    assert result["priority_plan"]["ranked_tasks"][0]["blocked_reason"].startswith("No valid assignee")
