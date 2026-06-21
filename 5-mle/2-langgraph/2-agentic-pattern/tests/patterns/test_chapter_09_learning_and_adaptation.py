from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_09_learning_and_adaptation import nodes
from agentic_design_patterns.patterns.chapter_09_learning_and_adaptation.graph import graph


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        return AIMessage(content=self.responses.pop(0))


def test_relevant_prior_case_drives_strategy_and_applies_adaptation(monkeypatch):
    fake_model = FakeChatModel(
        [
            (
                "First, forget the Wi-Fi network and reconnect. Then restart the "
                "router and device, check for network updates, and contact support "
                "if the issue still persists."
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My laptop will not connect to Wi-Fi after the latest update.",
            "user_id": "user-1",
            "feedback": {"score": 0.95, "notes": ["worked for similar cases"]},
            "experience_archive": [
                {
                    "user_namespace": "user-1",
                    "input_summary": "Laptop Wi-Fi failed after update.",
                    "task_category": "connectivity",
                    "strategy": "diagnostic_steps",
                    "score": 0.88,
                    "outcome": "success",
                    "lesson": (
                        "Start with forgetting the network, router restart, and "
                        "network settings checks."
                    ),
                }
            ],
        }
    )

    assert result["final_output"]["status"] == "ok"
    assert result["task_category"] == "connectivity"
    assert result["selected_strategy"] == "diagnostic_steps"
    assert result["experience_matches"][0]["lesson"].startswith("Start with")
    assert result["feedback_summary"]["source"] == "explicit"
    assert result["evaluation"]["passed"] is True
    assert result["evaluation"]["performance"]["safety"] == 1.0
    assert result["adaptation_proposal"]["action"] == "reinforce_strategy"
    assert result["applied_adaptation"]["applied"] is True
    assert result["archive_update"]["outcome"] == "success"
    assert result["archive_update"]["persistence_status"] == "in_state"
    assert len(fake_model.calls) == 1


def test_cold_start_without_feedback_uses_fallback_and_records_archive(monkeypatch):
    fake_model = FakeChatModel(
        [
            (
                "First, restart the app and check for updates. Then note the exact "
                "error message, reinstall only if the issue persists, and contact "
                "support with the app version."
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "The app crashes every time I open settings."})

    assert result["final_output"]["status"] == "ok"
    assert result["experience_matches"] == []
    assert result["selected_strategy"] == "diagnostic_steps"
    assert result["feedback_summary"]["insufficient"] is True
    assert result["evaluation"]["insufficient_feedback"] is True
    assert result["archive_update"]["task_category"] == "software"
    assert result["experience_archive"][-1]["outcome"] == "success"
    assert len(fake_model.calls) == 1


def test_low_scoring_draft_revises_once_then_finalizes(monkeypatch):
    fake_model = FakeChatModel(
        [
            "Restart it.",
            (
                "First, restart the app, then check for updates and record the "
                "exact error message. If the issue still persists, contact support "
                "with the app version and recent changes."
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "The app crashes during setup."})

    assert result["final_output"]["status"] == "ok"
    assert result["retry_count"] == 1
    assert result["evaluation"]["passed"] is True
    assert "first draft scored low" in result["strategy_reason"].lower()
    assert len(fake_model.calls) == 2


def test_repeated_low_score_routes_to_review_and_rolls_back_adaptation(monkeypatch):
    fake_model = FakeChatModel(["Try again later.", "Still try again later."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My monitor flashes an error and the laptop screen is blank.",
            "max_retries": 1,
        }
    )

    assert result["final_output"]["status"] == "needs_review"
    assert result["retry_count"] == 1
    assert result["needs_human_review"] is True
    assert result["adaptation_record"]["outcome"] == "needs_review"
    assert result["applied_adaptation"]["applied"] is False
    assert result["rollback_record"]["rolled_back"] is True
    assert result["archive_update"]["outcome"] == "needs_review"
    assert len(fake_model.calls) == 2


def test_unsupported_high_impact_answer_routes_to_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            (
                "Guaranteed fix: factory reset the router and replace the "
                "motherboard. Step 1, do it now. If the issue still persists, "
                "contact support."
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "My router will not connect to the internet."})

    assert result["final_output"]["status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert "factory reset" in result["evaluation"]["unsupported_claims"]
    assert result["applied_adaptation"]["applied"] is False
    assert result["rollback_record"]["rolled_back"] is True
    assert "human support reviewer" in result["final_output"]["answer"]


def test_persistence_failure_preserves_archive_update_and_error(monkeypatch):
    fake_model = FakeChatModel(
        [
            (
                "First, restart the router and reconnect to Wi-Fi. Then check for "
                "network updates and contact support if the issue still persists."
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def failing_persister(record, state):
        raise RuntimeError("archive offline")

    result = graph.invoke(
        {
            "input": "Wi-Fi drops every few minutes.",
            "memory_persister": failing_persister,
        }
    )

    assert result["final_output"]["status"] == "ok"
    assert result["archive_update"]["persistence_status"] == "failed"
    assert any("persist_adaptation failed" in error for error in result["errors"])
    assert result["final_output"]["archive_update"]["outcome"] == "success"


def test_blank_input_stops_before_retrieval_or_model(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def failing_retriever(state):
        raise AssertionError("retriever should not be called")

    result = graph.invoke({"input": "   ", "memory_retriever": failing_retriever})

    assert result["final_output"]["status"] == "failed"
    assert result["errors"] == ["Input is empty."]
    assert result["selected_strategy"] == "clarify_first"
    assert result["evaluation"]["score"] == 0.0
    assert result["applied_adaptation"]["applied"] is False
    assert fake_model.calls == []
