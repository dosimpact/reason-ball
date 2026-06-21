from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_13_human_in_the_loop import nodes
from agentic_design_patterns.patterns.chapter_13_human_in_the_loop.graph import graph


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


def test_routine_low_risk_issue_finalizes_without_human_review(monkeypatch):
    fake_model = FakeChatModel(
        ["Restart the app, check for updates, and capture the exact error if it returns."]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "The desktop app crashes after the latest update."})

    assert result["final_output"]["status"] == "resolved"
    assert result["needs_human_review"] is False
    assert result["review_status"] == "not_required"
    assert result.get("ticket") is None
    assert result["final_output"]["human_review"]["required"] is False
    assert len(fake_model.calls) == 1


def test_routine_follow_up_creates_ticket_without_human_review(monkeypatch):
    fake_model = FakeChatModel(["This looks like a routine warranty follow-up."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My keyboard key is broken and I need a warranty replacement.",
            "customer_id": "cust-123",
        }
    )

    assert result["final_output"]["status"] == "ticket_created"
    assert result["needs_human_review"] is False
    assert result["ticket"]["ticket_id"].startswith("HITL-")
    assert result["ticket"]["priority"] == "normal"
    assert result["final_output"]["human_review"]["required"] is False


def test_safety_issue_is_redacted_and_escalated_by_human(monkeypatch):
    fake_model = FakeChatModel(["This should be reviewed before final safety guidance."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "My laptop battery is swelling and smells like burning plastic. "
                "Contact me at alex@example.com."
            ),
            "customer_id": "cust-999",
            "customer_info": {
                "name": "Alex Rivera",
                "email": "alex@example.com",
                "serial_number": "SN-ABC-123",
                "purchase_id": "PO-456",
                "tier": "pro",
            },
            "support_history": [
                {
                    "ticket_id": "OLD-1",
                    "summary": "Prior battery replacement for SN-ABC-123.",
                }
            ],
            "human_response": {
                "decision": "escalate",
                "notes": "Possible battery swelling requires specialist handling.",
            },
        }
    )

    assert result["final_output"]["status"] == "escalated"
    assert result["review_status"] == "escalated"
    assert result["needs_human_review"] is True
    assert result["ticket"]["priority"] == "critical"
    assert result["redacted_review_request"]["customer_id"] == "[REDACTED]"
    assert result["redacted_review_request"]["customer_info"]["name"] == "[REDACTED]"
    redacted_text = str(result["redacted_review_request"])
    assert "alex@example.com" not in redacted_text
    assert "SN-ABC-123" not in redacted_text
    assert "PO-456" not in redacted_text
    assert result["final_output"]["redaction_applied"] is True


def test_human_approval_returns_agent_recommendation(monkeypatch):
    fake_model = FakeChatModel(["I will route this account access issue to a safe reset path."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "I am locked out of my account after two-factor authentication failed.",
            "human_response": {"decision": "approve", "notes": "Approved as written."},
        }
    )

    assert result["final_output"]["status"] == "resolved"
    assert result["review_status"] == "approved"
    assert result["final_output"]["answer"] == (
        "I will route this account access issue to a safe reset path."
    )
    assert result["human_feedback"]["decision"] == "approve"


def test_human_edit_is_reflected_in_final_answer_and_feedback(monkeypatch):
    fake_model = FakeChatModel(["Draft answer that needs a human edit."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "I was charged twice and need a refund.",
            "human_response": {
                "decision": "edit",
                "edited_answer": "A billing specialist will review the duplicate charge today.",
                "notes": "Removed unsupported refund promise.",
            },
        }
    )

    assert result["review_status"] == "edited"
    assert result["final_output"]["answer"] == (
        "A billing specialist will review the duplicate charge today."
    )
    assert result["human_feedback"]["edited_answer"] == (
        "A billing specialist will review the duplicate charge today."
    )


def test_human_rejection_does_not_return_agent_recommendation(monkeypatch):
    fake_model = FakeChatModel(["Unsupported confident billing answer."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "I received a charge I do not recognize.",
            "human_response": {
                "decision": "reject",
                "reason": "Needs fraud-team review first.",
            },
        }
    )

    assert result["final_output"]["status"] == "rejected"
    assert result["review_status"] == "rejected"
    assert "Unsupported confident billing answer" not in result["final_output"]["answer"]
    assert "Needs fraud-team review first." in result["final_output"]["answer"]


def test_missing_human_response_returns_awaiting_interrupt_state(monkeypatch):
    fake_model = FakeChatModel(["Review is required before final action."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "My laptop battery is swollen and hot."})

    assert result["final_output"]["status"] == "awaiting_human"
    assert result["status"] == "awaiting_human"
    assert result["review_status"] == "requested"
    assert result["review_interrupt"]["resume_with"] == "human_response"
    assert result["review_interrupt"]["payload"] == result["redacted_review_request"]
    assert result["final_output"]["human_review"]["interrupt"]["status"] == (
        "awaiting_human"
    )


def test_timeout_policy_can_auto_escalate_without_reviewer(monkeypatch):
    fake_model = FakeChatModel(["Review is required before final action."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My laptop battery is swollen and hot.",
            "escalation_policy": {"review_timeout_action": "auto_escalate"},
        }
    )

    assert result["final_output"]["status"] == "escalated"
    assert result["review_status"] == "escalated"
    assert result["human_response"]["source"] == "timeout_policy"
    assert result["ticket"]["priority"] == "critical"


def test_troubleshooting_failure_routes_to_human_review(monkeypatch):
    fake_model = FakeChatModel(["Troubleshooting failed, so a reviewer should inspect this."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "The app crashes whenever I open settings.",
            "metadata": {"force_troubleshooting_error": "diagnostic service offline"},
            "human_response": {
                "decision": "request_more_info",
                "message": "Please send the app version and the full error code.",
            },
        }
    )

    assert result["needs_human_review"] is True
    assert result["final_output"]["status"] == "needs_more_info"
    assert result["review_status"] == "more_info_requested"
    assert any("diagnostic service offline" in error for error in result["errors"])


def test_ticket_failure_falls_back_to_human_review(monkeypatch):
    fake_model = FakeChatModel(["Create a support ticket for the warranty replacement."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My monitor is still broken and needs warranty repair.",
            "metadata": {"force_ticket_error": "ticket system offline"},
            "human_response": {
                "decision": "escalate",
                "notes": "Manual ticket required.",
            },
        }
    )

    assert result["final_output"]["status"] == "escalated"
    assert result["review_status"] == "escalated"
    assert any("ticket system offline" in error for error in result["errors"])
    assert result["ticket"]["ticket_id"].startswith("HITL-")


def test_redaction_failure_blocks_human_review(monkeypatch):
    fake_model = FakeChatModel(["This needs human review."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My laptop battery is swollen and hot.",
            "metadata": {"force_redaction_error": "redaction service offline"},
            "human_response": {"decision": "approve"},
        }
    )

    assert result["final_output"]["status"] == "review_unavailable"
    assert result["review_status"] == "review_unavailable"
    assert result["redacted_review_request"] is None
    assert any("redaction service offline" in error for error in result["errors"])


def test_stricter_policy_overrides_conflicting_human_instruction(monkeypatch):
    fake_model = FakeChatModel(["Safety case draft."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "My laptop battery is swelling and there are sparks.",
            "human_response": {
                "decision": "edit",
                "edited_answer": "It is safe to use. Continue using the laptop.",
                "notes": "Unsafe instruction for test.",
            },
        }
    )

    assert result["final_output"]["status"] == "escalated"
    assert result["review_status"] == "escalated"
    assert result["human_response"]["policy_override"] is True
    assert any("stricter safety policy" in error for error in result["errors"])


def test_blank_input_fails_before_model_or_human_review(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   ", "human_response": {"decision": "approve"}})

    assert result["final_output"]["status"] == "failed"
    assert result["errors"] == ["Input is empty."]
    assert result["review_status"] == "not_required"
    assert fake_model.calls == []
