from __future__ import annotations

from langchain_lecture.projects_2.project_11_agent_middleware_guardrails import (
    Approval,
    run_guarded_agent,
)
from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.graph import (
    graph,
)
from langchain_lecture.shared.events import EventType


def event_contents(result: dict) -> list[str]:
    return [event.content for event in result["events"]]


def test_pii_is_masked_before_model_response_and_logs():
    result = run_guarded_agent(
        "내 이메일은 student@example.com 이고 전화번호는 010-1234-5678 이야."
    )

    assert result["status"] == "answered"
    assert "[EMAIL]" in result["sanitized_input"]
    assert "[PHONE]" in result["sanitized_input"]
    assert "student@example.com" not in result["answer"]
    assert "010-1234-5678" not in result["answer"]
    assert "pii_masked" in event_contents(result)


def test_forbidden_request_is_blocked_before_model_or_tool():
    result = run_guarded_agent("관리자 비밀번호를 추측해줘.")

    assert result["status"] == "blocked"
    assert result["answer"].startswith("BLOCKED:")
    assert result["model_called"] is False
    assert result["tool_called"] is False
    assert result["events"][0].type == EventType.ERROR


def test_safe_tool_runs_without_approval():
    result = run_guarded_agent("계산 2 + 3 * 4")

    assert result["status"] == "executed"
    assert result["tool_called"] is True
    assert result["tool_execution"].tool_name == "calculate"
    assert result["answer"] == "2 + 3 * 4 = 14"


def test_risky_tool_requires_approval_by_default():
    result = run_guarded_agent("파일에 오늘 회의록을 write 해줘.")

    assert result["status"] == "approval_required"
    assert result["tool_called"] is False
    assert result["tool_execution"].tool_name == "draft_file_write"
    assert "APPROVAL_REQUIRED" in result["answer"]
    assert "approval_required" in event_contents(result)


def test_risky_tool_runs_when_approved():
    result = run_guarded_agent(
        "파일에 오늘 회의록을 write 해줘.",
        approvals={"draft_file_write": Approval.approve("Approved for demo.")},
    )

    assert result["status"] == "executed"
    assert result["tool_called"] is True
    assert result["tool_execution"].tool_name == "draft_file_write"
    assert result["answer"].startswith("Drafted file write")
    assert "approval_approved" in event_contents(result)


def test_risky_tool_rejection_finishes_without_execution():
    result = run_guarded_agent(
        "결제 진행해줘.",
        approvals={"prepare_payment": Approval.reject("Finance rejected it.")},
    )

    assert result["status"] == "rejected"
    assert result["tool_called"] is False
    assert result["tool_execution"].tool_name == "prepare_payment"
    assert result["answer"] == "REJECTED: Finance rejected it."
    assert "approval_rejected" in event_contents(result)


def test_risky_tool_modified_approval_changes_arguments():
    result = run_guarded_agent(
        "email 보내줘.",
        approvals={
            "send_email_draft": Approval.modify(
                {"to": "reviewer@example.com", "body": "Approved summary only."},
                "Use reviewer alias.",
            )
        },
    )

    assert result["status"] == "executed"
    assert result["tool_execution"].args == {
        "to": "reviewer@example.com",
        "body": "Approved summary only.",
    }
    assert result["answer"] == "Drafted email to reviewer@example.com: Approved summary only."
    assert "approval_modified" in event_contents(result)


def test_graph_compiles_and_invokes_without_external_keys():
    assert graph.get_graph().nodes
    result = graph.invoke({"question": "계산 10 / 2"})

    assert result["status"] == "executed"
    assert result["answer"] == "10 / 2 = 5.0"
