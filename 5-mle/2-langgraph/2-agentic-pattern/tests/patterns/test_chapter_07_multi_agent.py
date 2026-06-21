from __future__ import annotations

import json
import threading
import time
from typing import Any

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_07_multi_agent import nodes
from agentic_design_patterns.patterns.chapter_07_multi_agent.graph import graph


class DispatchingFakeChatModel:
    def __init__(
        self,
        responses: dict[str, str | list[str] | Exception] | None = None,
        delay_seconds: float = 0,
    ) -> None:
        self.responses: dict[str, str | list[str] | Exception] = {
            "supervisor": _supervisor_response(),
            "research": json.dumps(
                {
                    "findings": [
                        {
                            "claim": "AI triage can reduce intake delays.",
                            "evidence": "Source material says triage automation shortens intake.",
                        }
                    ]
                }
            ),
            "analysis": json.dumps(
                {
                    "findings": [
                        {
                            "point": "Adoption depends on oversight.",
                            "rationale": "Human checks keep recommendations aligned with policy.",
                            "risk": "Bias and workflow mismatch can reduce trust.",
                        }
                    ],
                    "conflicts": [],
                    "open_questions": ["How will outputs be audited?"],
                }
            ),
            "writer": json.dumps(
                {
                    "draft_report": (
                        "Findings: AI triage can reduce intake delays. "
                        "Implications: oversight is needed. Risks: bias must be audited. "
                        "Open questions: auditing approach."
                    )
                }
            ),
            "reviewer": json.dumps(
                {
                    "approved": True,
                    "issues": [],
                    "unsupported_claims": [],
                    "missing_sections": [],
                    "revision_notes": [],
                    "requires_human_review": False,
                }
            ),
            "revise": json.dumps(
                {
                    "draft_report": (
                        "Findings: AI triage can reduce intake delays. "
                        "Implications: oversight is needed. Risks: bias must be audited. "
                        "Open questions: auditing approach. Revision notes were addressed."
                    )
                }
            ),
        }
        if responses:
            self.responses.update(responses)
        self.delay_seconds = delay_seconds
        self.calls: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def invoke(self, messages):
        branch = self._branch_for(messages)
        call: dict[str, Any] = {
            "branch": branch,
            "start": time.perf_counter(),
            "end": None,
        }
        with self._lock:
            self.calls.append(call)

        try:
            if self.delay_seconds and branch in {"research", "analysis"}:
                time.sleep(self.delay_seconds)
            response = self._next_response(branch)
            if isinstance(response, Exception):
                raise response
            return AIMessage(content=response)
        finally:
            with self._lock:
                call["end"] = time.perf_counter()

    def _next_response(self, branch: str) -> str | Exception:
        with self._lock:
            response = self.responses[branch]
            if isinstance(response, list):
                if not response:
                    raise AssertionError(f"Unexpected {branch} model invocation.")
                return response.pop(0)
            return response

    def _branch_for(self, messages) -> str:
        system_text = str(messages[0].content).lower()
        if "supervisor" in system_text:
            return "supervisor"
        if "research specialist" in system_text:
            return "research"
        if "analysis specialist" in system_text:
            return "analysis"
        if "writer agent" in system_text:
            return "writer"
        if "reviewer agent" in system_text:
            return "reviewer"
        if "revise" in system_text:
            return "revise"
        raise AssertionError(f"Unexpected prompt: {system_text}")


def test_multi_agent_happy_path_records_team_handoffs(monkeypatch):
    fake_model = DispatchingFakeChatModel()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Research AI triage adoption for customer support.",
            "source_material": (
                "Source material says triage automation shortens intake when "
                "supervisors audit recommendations."
            ),
        }
    )

    assert result["status"] == "ok"
    assert result["errors"] == []
    assert result["final_output"]["status"] == "ok"
    assert "AI triage can reduce intake delays" in result["final_output"]["brief"]
    assert result["final_output"]["agents"]["supervisor_plan"] == "completed"
    assert result["final_output"]["agents"]["research_agent"] == "completed"
    assert result["final_output"]["agents"]["analysis_agent"] == "completed"
    assert result["final_output"]["agents"]["writer_agent"] == "completed"
    assert result["final_output"]["agents"]["reviewer_agent"] == "approved"
    assert "research_agent -> writer_agent" in result["context_bundle"]["handoffs"]
    assert [call["branch"] for call in fake_model.calls].count("reviewer") == 1


def test_blank_input_fails_before_any_agent_model_call(monkeypatch):
    fake_model = DispatchingFakeChatModel()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["errors"] == [
        {"agent": "prepare_objective", "message": "Input is empty."}
    ]
    assert fake_model.calls == []


def test_unknown_supervisor_agent_routes_to_failure(monkeypatch):
    fake_model = DispatchingFakeChatModel(
        responses={
            "supervisor": _supervisor_response(
                agents=[
                    "research_agent",
                    "analysis_agent",
                    "writer_agent",
                    "critic_agent",
                ]
            )
        }
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Research AI triage adoption."})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert any(
        "Unsupported agent names: critic_agent" in error["message"]
        for error in result["errors"]
    )
    assert [call["branch"] for call in fake_model.calls] == ["supervisor"]


def test_specialists_fan_out_and_write_distinct_outputs(monkeypatch):
    fake_model = DispatchingFakeChatModel(delay_seconds=0.05)
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Research AI triage adoption."})

    assert result["research_findings"] == [
        {
            "claim": "AI triage can reduce intake delays.",
            "evidence": "Source material says triage automation shortens intake.",
        }
    ]
    assert result["analysis_findings"] == [
        {
            "point": "Adoption depends on oversight.",
            "rationale": "Human checks keep recommendations aligned with policy.",
            "risk": "Bias and workflow mismatch can reduce trust.",
        }
    ]
    assert result["agent_outputs"]["research_agent"]["status"] == "completed"
    assert result["agent_outputs"]["analysis_agent"]["status"] == "completed"

    specialist_calls = [
        call
        for call in fake_model.calls
        if call["branch"] in {"research", "analysis"}
    ]
    starts = [float(call["start"]) for call in specialist_calls]
    ends = [float(call["end"]) for call in specialist_calls]
    assert len(specialist_calls) == 2
    assert max(starts) < min(ends)


def test_missing_required_specialist_output_routes_to_human_review(monkeypatch):
    fake_model = DispatchingFakeChatModel(responses={"research": "not json"})
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Research AI triage adoption."})

    assert result["status"] == "needs_human_review"
    assert result["final_output"]["status"] == "needs_human_review"
    assert result["agent_outputs"]["research_agent"]["status"] == "failed"
    assert result["context_bundle"]["missing_outputs"] == ["research_agent"]
    assert any(error["agent"] == "research_agent" for error in result["errors"])
    assert "writer" not in [call["branch"] for call in fake_model.calls]


def test_conflicting_specialist_outputs_escalate_before_writing(monkeypatch):
    fake_model = DispatchingFakeChatModel(
        responses={
            "analysis": json.dumps(
                {
                    "findings": [
                        {
                            "point": "Evidence is inconsistent.",
                            "rationale": "Sources report different outcomes.",
                            "risk": "A brief would overstate confidence.",
                        }
                    ],
                    "conflicts": [
                        "Research says pilots improved throughput, but source B says no measurable gain."
                    ],
                    "open_questions": [],
                }
            )
        }
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Research AI triage adoption."})

    assert result["status"] == "needs_human_review"
    assert result["requires_human_review"] is True
    assert result["context_bundle"]["conflicts"] == [
        "Research says pilots improved throughput, but source B says no measurable gain."
    ]
    assert "writer" not in [call["branch"] for call in fake_model.calls]


def test_reviewer_rejection_revises_once_then_finalizes(monkeypatch):
    fake_model = DispatchingFakeChatModel(
        responses={
            "reviewer": [
                json.dumps(
                    {
                        "approved": False,
                        "issues": ["Open questions section is too thin."],
                        "unsupported_claims": [],
                        "missing_sections": ["open questions"],
                        "revision_notes": ["Expand the open questions section."],
                        "requires_human_review": False,
                    }
                ),
                json.dumps(
                    {
                        "approved": True,
                        "issues": [],
                        "unsupported_claims": [],
                        "missing_sections": [],
                        "revision_notes": [],
                        "requires_human_review": False,
                    }
                ),
            ],
            "revise": json.dumps(
                {
                    "draft_report": (
                        "Findings: AI triage can reduce intake delays. "
                        "Implications: oversight is needed. Risks: bias must be audited. "
                        "Open questions: auditing approach, review cadence, and owner."
                    )
                }
            ),
        }
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Research AI triage adoption.",
            "max_retries": 1,
        }
    )

    assert result["status"] == "ok"
    assert result["retry_count"] == 1
    assert "review cadence" in result["final_output"]["brief"]
    assert result["final_output"]["agents"]["writer_agent"] == "revised"
    assert result["final_output"]["agents"]["reviewer_agent"] == "approved"
    assert [call["branch"] for call in fake_model.calls].count("reviewer") == 2
    assert [call["branch"] for call in fake_model.calls].count("revise") == 1


def test_reviewer_rejection_after_retry_limit_routes_to_human_review(monkeypatch):
    fake_model = DispatchingFakeChatModel(
        responses={
            "reviewer": json.dumps(
                {
                    "approved": False,
                    "issues": ["Draft includes an unsupported claim."],
                    "unsupported_claims": ["Guaranteed 50 percent cost savings."],
                    "missing_sections": [],
                    "revision_notes": ["Remove the unsupported savings claim."],
                    "requires_human_review": False,
                }
            )
        }
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Research AI triage adoption.",
            "max_retries": 0,
        }
    )

    assert result["status"] == "needs_human_review"
    assert result["retry_count"] == 0
    assert result["final_output"]["status"] == "needs_human_review"
    assert "Guaranteed 50 percent cost savings." in result["review_result"][
        "unsupported_claims"
    ]
    assert "revise" not in [call["branch"] for call in fake_model.calls]


def test_high_risk_topic_requires_human_review_even_if_reviewer_approves(monkeypatch):
    fake_model = DispatchingFakeChatModel()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Research medical diagnosis triage automation."})

    assert result["status"] == "needs_human_review"
    assert result["requires_human_review"] is True
    assert any(
        "High-risk topic requires human review" in issue
        for issue in result["review_result"]["issues"]
    )
    assert result["final_output"]["agents"]["reviewer_agent"] == "needs_human_review"


def _supervisor_response(
    agents: list[str] | None = None,
    dependencies: dict[str, list[str]] | None = None,
) -> str:
    selected_agents = agents or [
        "research_agent",
        "analysis_agent",
        "writer_agent",
        "reviewer_agent",
    ]
    dependency_map = dependencies or {
        "research_agent": [],
        "analysis_agent": [],
        "writer_agent": ["research_agent", "analysis_agent"],
        "reviewer_agent": ["writer_agent"],
    }
    role_map = {
        "research_agent": "research specialist",
        "analysis_agent": "analysis specialist",
        "writer_agent": "brief writer",
        "reviewer_agent": "critic reviewer",
        "critic_agent": "unsupported critic",
    }
    return json.dumps(
        {
            "team_plan": [
                {
                    "agent": agent,
                    "role": role_map.get(agent, agent),
                    "task": f"Complete the {agent} assignment.",
                    "expected_output": "Structured JSON output.",
                    "dependencies": dependency_map.get(agent, []),
                }
                for agent in selected_agents
            ],
            "communication_contract": {
                "required_fields": ["claim", "evidence"],
                "handoff_rules": [
                    "agents use structured JSON",
                    "writer uses only specialist outputs",
                ],
            },
        }
    )
