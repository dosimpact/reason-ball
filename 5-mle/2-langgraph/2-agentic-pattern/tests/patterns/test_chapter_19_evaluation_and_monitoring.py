from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring import nodes
from agentic_design_patterns.patterns.chapter_19_evaluation_and_monitoring.graph import (
    graph,
)


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected judge invocation.")
        return AIMessage(content=self.responses.pop(0))


def base_state() -> dict:
    return {
        "input": "device control eval",
        "agent_run": {
            "user_input": "Turn off device_2 in the Bedroom",
            "final_output": "I have set device_2 to off.",
            "tool_calls": [
                {
                    "tool": "set_device_info",
                    "args": {
                        "location": "Bedroom",
                        "device_id": "device_2",
                        "status": "OFF",
                    },
                }
            ],
            "metadata": {
                "latency_ms": 820,
                "total_tokens": 143,
                "model": "fake-model",
                "agent_version": "v1",
            },
        },
        "reference_output": "I have set the device_2 status to off.",
        "expected_trajectory": [{"tool": "set_device_info"}],
        "trajectory_match_mode": "in_order",
        "thresholds": {
            "required_keywords": ["device_2", "off"],
            "max_latency_ms": 1500,
            "max_total_tokens": 300,
        },
    }


def test_graph_construction_exposes_compiled_graph():
    assert graph is not None
    assert "prepare_evaluation" in graph.get_graph().nodes
    assert "finalize_report" in graph.get_graph().nodes


def test_success_path_scores_run_without_judge(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(base_state())

    assert result["evaluation_status"] == "passed"
    assert result["evaluation_report"]["status"] == "passed"
    assert result["response_metrics"]["passed"] is True
    assert result["operational_metrics"]["passed"] is True
    assert result["trajectory_metrics"]["passed"] is True
    assert result["drift_signals"]["status"] == "not_applicable"
    assert result["errors"] == []
    assert fake_model.calls == []


def test_missing_agent_run_routes_directly_to_invalid_report(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "bad eval"})

    assert result["evaluation_status"] == "invalid"
    assert result["evaluation_report"]["status"] == "invalid"
    assert "agent_run is required" in result["errors"][0]
    assert "response_metrics" not in result or result["response_metrics"] == {}
    assert fake_model.calls == []


def test_missing_required_tool_fails_trajectory_even_when_output_passes(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["agent_run"]["tool_calls"] = [{"tool": "log_message"}]

    result = graph.invoke(state)

    assert result["evaluation_status"] == "failed"
    assert result["trajectory_metrics"]["passed"] is False
    assert result["trajectory_metrics"]["missing_actions"] == ["set_device_info"]
    assert any(alert["metric"] == "trajectory" for alert in result["alerts"])
    assert fake_model.calls == []


def test_latency_threshold_breach_creates_warning_status(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["agent_run"]["metadata"]["latency_ms"] = 1840

    result = graph.invoke(state)

    assert result["evaluation_status"] == "failed"
    assert result["operational_metrics"]["passed"] is False
    assert any(alert["metric"] == "latency_ms" for alert in result["alerts"])


def test_any_order_and_single_tool_modes_pass_small_fixtures(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["agent_run"]["tool_calls"] = [{"tool": "notify"}, {"tool": "set_device_info"}]
    state["expected_trajectory"] = [{"tool": "set_device_info"}, {"tool": "notify"}]
    state["trajectory_match_mode"] = "any_order"

    any_order = graph.invoke(state)

    assert any_order["trajectory_metrics"]["passed"] is True

    state["expected_trajectory"] = [{"tool": "set_device_info"}]
    state["trajectory_match_mode"] = "single_tool"
    single_tool = graph.invoke(state)

    assert single_tool["trajectory_metrics"]["passed"] is True


def test_rubric_judge_is_called_and_validated(monkeypatch):
    fake_model = FakeChatModel(
        [
            json.dumps(
                {
                    "score": 0.91,
                    "rationale": "Clear and complete.",
                    "concerns": [],
                    "recommended_action": "ship",
                    "passed": True,
                }
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["rubric"] = {"criteria": ["helpfulness", "clarity"]}

    result = graph.invoke(state)

    assert result["evaluation_status"] == "passed"
    assert result["judge_result"]["score"] == 0.91
    assert result["judge_result"]["passed"] is True
    assert len(fake_model.calls) == 1


def test_malformed_judge_output_needs_review(monkeypatch):
    fake_model = FakeChatModel(["not json"])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["rubric"] = {"criteria": ["neutrality"]}

    result = graph.invoke(state)

    assert result["evaluation_status"] == "needs_review"
    assert any("Judge result must include score" in error for error in result["errors"])
    assert result["judge_result"]["passed"] is False


def test_baseline_regression_creates_drift_alert(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["baseline_metrics"] = {"response_similarity": 0.99, "latency_ms": 300}
    state["thresholds"]["max_similarity_drop"] = 0.02
    state["thresholds"]["max_latency_regression_factor"] = 2.0

    result = graph.invoke(state)

    assert result["evaluation_status"] == "warning"
    assert result["drift_signals"]["status"] == "scored"
    assert result["drift_signals"]["latency_regression"] is True
    assert any(alert["metric"] == "latency_ms" for alert in result["alerts"])


def test_safety_audit_failure_overrides_passing_judge(monkeypatch):
    fake_model = FakeChatModel(
        [
            json.dumps(
                {
                    "score": 1.0,
                    "rationale": "Looks good.",
                    "concerns": [],
                    "recommended_action": "ship",
                    "passed": True,
                }
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    state = base_state()
    state["agent_run"]["final_output"] = "I have set device_2 to off. SECRET_TOKEN"
    state["thresholds"]["forbidden_phrases"] = ["SECRET_TOKEN"]
    state["rubric"] = {"criteria": ["helpfulness"]}

    result = graph.invoke(state)

    assert result["evaluation_status"] == "failed"
    assert result["judge_result"]["passed"] is True
    assert any(alert["metric"] == "safety" for alert in result["alerts"])
