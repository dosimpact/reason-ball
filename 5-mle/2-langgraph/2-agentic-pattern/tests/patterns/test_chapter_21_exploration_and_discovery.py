from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_21_exploration_and_discovery import nodes
from agentic_design_patterns.patterns.chapter_21_exploration_and_discovery.graph import (
    graph,
    route_after_decision,
    route_after_safety,
)


class FakeChatModel:
    def __init__(self, responses: list[dict | str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        response = self.responses.pop(0)
        if isinstance(response, str):
            return AIMessage(content=response)
        return AIMessage(content=json.dumps(response))


def install_fake_model(monkeypatch, responses: list[dict | str]) -> FakeChatModel:
    fake_model = FakeChatModel(responses)
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    return fake_model


def context_response() -> dict:
    return {
        "context_summary": "Activation drops sharply when non-admin users reach permissions setup.",
        "knowledge_gaps": ["Whether abandoned users had admin rights is unknown."],
        "exploration_questions": ["Do non-admins abandon more often at permissions setup?"],
    }


def hypothesis_response() -> dict:
    return {
        "hypotheses": [
            {
                "id": "h1",
                "title": "Unavailable admin permissions block setup",
                "rationale": "Users may reach a step they cannot complete.",
                "evidence_refs": ["e1", "seed-2"],
                "assumptions": ["Support tickets represent part of the abandonment population."],
                "risks": ["Silent abandoners may differ from ticket submitters."],
                "cluster": "permissions",
            },
            {
                "id": "h2",
                "title": "Integration vocabulary obscures the next action",
                "rationale": "Users may not understand which integration option to select.",
                "evidence_refs": ["e2"],
                "assumptions": ["Confusing labels are visible before abandonment."],
                "risks": ["May be secondary to permission issues."],
                "cluster": "comprehension",
            },
        ]
    }


def passing_review_response() -> dict:
    return {
        "reviews": [
            {
                "hypothesis_id": "h1",
                "novelty": 0.7,
                "plausibility": 0.9,
                "evidence": 0.75,
                "feasibility": 0.8,
                "impact": 0.85,
                "clarity": 0.9,
                "safety": 1.0,
                "critique": "Strong evidence and clear validation path.",
                "reviewer_scores": [0.82, 0.86],
            },
            {
                "hypothesis_id": "h2",
                "novelty": 0.62,
                "plausibility": 0.72,
                "evidence": 0.58,
                "feasibility": 0.78,
                "impact": 0.7,
                "clarity": 0.76,
                "safety": 1.0,
                "critique": "Useful alternate explanation.",
                "reviewer_scores": [0.68, 0.72],
            },
        ]
    }


def base_input() -> dict:
    return {
        "research_goal": "Discover why B2B SaaS users abandon onboarding setup.",
        "domain": "product",
        "seed_context": ["Support tickets mention missing admin permissions."],
        "evidence_items": [
            {
                "id": "e1",
                "source": "analytics",
                "claim": "Step 3 has the largest drop-off.",
                "relevance": 0.9,
                "confidence": 0.8,
            },
            {
                "id": "e2",
                "source": "research",
                "claim": "Users describe integration labels as unclear.",
                "relevance": 0.7,
                "confidence": 0.6,
            },
        ],
        "max_iterations": 1,
    }


def test_graph_constructs_and_exposes_compiled_graph():
    assert graph is not None
    assert graph.get_graph().nodes


def test_success_path_generates_reviews_clusters_and_discovery_brief(monkeypatch):
    fake_model = install_fake_model(
        monkeypatch,
        [context_response(), hypothesis_response(), passing_review_response()],
    )

    result = graph.invoke(base_input())

    assert result["discovery_status"] == "completed"
    assert result["discovery_brief"]["status"] == "completed"
    assert result["needs_human_review"] is False
    assert [item["title"] for item in result["selected_hypotheses"]] == [
        "Unavailable admin permissions block setup",
        "Integration vocabulary obscures the next action",
    ]
    assert result["hypothesis_clusters"][0]["cluster"] == "permissions"
    assert result["validation_plan"][0]["hypothesis"] == "Unavailable admin permissions block setup"
    assert len(fake_model.calls) == 3


def test_unsafe_goal_is_blocked_before_model_calls(monkeypatch):
    fake_model = install_fake_model(monkeypatch, [])

    result = graph.invoke(
        {
            "research_goal": "Discover better phishing methods for account takeover.",
            "domain": "security",
            "safety_policy": {"disallowed_terms": ["phishing"]},
        }
    )

    assert result["discovery_status"] == "blocked"
    assert result["discovery_brief"]["status"] == "blocked"
    assert result["safety_findings"][0]["type"] == "blocked_goal"
    assert fake_model.calls == []


def test_missing_research_goal_fails_without_model_calls(monkeypatch):
    fake_model = install_fake_model(monkeypatch, [])

    result = graph.invoke({"domain": "product"})

    assert result["discovery_status"] == "failed"
    assert result["discovery_brief"]["status"] == "failed"
    assert "research_goal is required." in result["errors"]
    assert fake_model.calls == []


def test_sparse_evidence_is_marked_as_speculative(monkeypatch):
    install_fake_model(
        monkeypatch,
        [
            {
                "context_summary": "No direct local records were supplied.",
                "knowledge_gaps": ["No behavioral observations are available."],
                "exploration_questions": ["What evidence should be collected first?"],
            },
            hypothesis_response(),
            passing_review_response(),
        ],
    )

    result = graph.invoke(
        {
            "research_goal": "Discover why learners stop using a study planner.",
            "domain": "education",
        }
    )

    assert result["discovery_status"] == "completed"
    assert "Evidence is sparse" in result["context_summary"]
    assert "Evidence is sparse; selected hypotheses are speculative." in result["discovery_brief"]["limitations"]


def test_low_scores_route_through_evolution_before_success(monkeypatch):
    low_review = {
        "reviews": [
            {
                "hypothesis_id": "h1",
                "novelty": 0.4,
                "plausibility": 0.52,
                "evidence": 0.3,
                "feasibility": 0.5,
                "impact": 0.7,
                "clarity": 0.8,
                "safety": 1.0,
                "critique": "Needs sharper evidence connection.",
                "reviewer_scores": [0.45, 0.5],
            }
        ]
    }
    evolved = {
        "hypotheses": [
            {
                "id": "h1-r1",
                "title": "Permission gaps create a role-specific setup dead end",
                "rationale": "Refined to distinguish non-admin users from general confusion.",
                "evidence_refs": ["e1"],
                "assumptions": ["User role is captured in analytics."],
                "risks": ["Role data may be incomplete."],
                "cluster": "permissions",
                "revision_note": "Made the validation path measurable.",
            }
        ]
    }
    evolved_review = {
        "reviews": [
            {
                "hypothesis_id": "h1-r1",
                "novelty": 0.68,
                "plausibility": 0.86,
                "evidence": 0.7,
                "feasibility": 0.82,
                "impact": 0.8,
                "clarity": 0.88,
                "safety": 1.0,
                "critique": "Clear and testable.",
                "reviewer_scores": [0.78, 0.8],
            }
        ]
    }
    install_fake_model(
        monkeypatch,
        [context_response(), hypothesis_response(), low_review, evolved, evolved_review],
    )

    result = graph.invoke({**base_input(), "max_iterations": 1})

    assert result["discovery_status"] == "completed"
    assert result["iteration_count"] == 1
    assert result["selected_hypotheses"][0]["id"] == "h1-r1"


def test_max_iterations_returns_failed_when_no_candidate_passes(monkeypatch):
    low_review = {
        "reviews": [
            {
                "hypothesis_id": "h1",
                "novelty": 0.2,
                "plausibility": 0.3,
                "evidence": 0.2,
                "feasibility": 0.3,
                "impact": 0.4,
                "clarity": 0.5,
                "safety": 1.0,
                "critique": "Too weak.",
                "reviewer_scores": [0.3, 0.35],
            }
        ]
    }
    install_fake_model(monkeypatch, [context_response(), hypothesis_response(), low_review])

    result = graph.invoke({**base_input(), "max_iterations": 0})

    assert result["discovery_status"] == "failed"
    assert "No hypotheses met quality thresholds." in result["errors"]


def test_reviewer_disagreement_triggers_human_review(monkeypatch):
    disagreeing_review = passing_review_response()
    disagreeing_review["reviews"][0]["reviewer_scores"] = [0.1, 0.95]
    install_fake_model(
        monkeypatch,
        [context_response(), hypothesis_response(), disagreeing_review],
    )

    result = graph.invoke(base_input())

    assert result["discovery_status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert result["discovery_brief"]["needs_human_review"] is True


def test_malformed_model_json_is_captured_as_needs_review(monkeypatch):
    install_fake_model(monkeypatch, [context_response(), "{not valid json"])

    result = graph.invoke(base_input())

    assert result["discovery_status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert any("Malformed model JSON" in error for error in result["errors"])


def test_routing_helpers_cover_safety_and_refinement_branches():
    assert route_after_safety({"discovery_status": "blocked"}) == "finalize_discovery_brief"
    assert route_after_safety({"discovery_status": "ready"}) == "explore_context"
    assert route_after_decision({"needs_human_review": True}) == "request_human_review"
    assert route_after_decision({"discovery_status": "failed"}) == "finalize_discovery_brief"
    assert route_after_decision({"selected_hypotheses": [{"id": "h1"}]}) == "plan_validation_steps"
    assert route_after_decision({"iteration_count": 0, "max_iterations": 1}) == "evolve_hypotheses"

