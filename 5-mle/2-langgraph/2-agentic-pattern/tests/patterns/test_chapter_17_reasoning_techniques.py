from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_17_reasoning_techniques import nodes
from agentic_design_patterns.patterns.chapter_17_reasoning_techniques.graph import (
    graph,
    route_after_action_selection,
    route_after_classification,
    route_after_prepare,
    route_after_reflection,
)


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        return AIMessage(content=self.responses.pop(0))


def install_fake_model(monkeypatch, responses: list[str] | None = None) -> FakeChatModel:
    fake_model = FakeChatModel(
        responses
        or [
            (
                "Classical computers use bits, while quantum computers use qubits "
                "that can use superposition. Molecular simulation for drug discovery "
                "is one useful application."
            ),
            (
                "Classical computers use bits, while quantum computers use qubits "
                "that can use superposition. Molecular simulation for drug discovery "
                "is one useful application."
            ),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    return fake_model


def test_graph_constructs_and_route_helpers_select_expected_edges():
    assert graph is not None
    assert route_after_prepare({"status": "invalid_input"}) == "finalize_response"
    assert route_after_prepare({"status": "ok"}) == "classify_reasoning_need"
    assert route_after_classification({"classification": {"simple": True}}) == "synthesize_answer"
    assert route_after_classification({"classification": {"simple": False}}) == "decompose_question"
    assert route_after_action_selection({"next_action": {"type": "retrieve"}}) == "retrieve_evidence"
    assert route_after_action_selection({"next_action": {"type": "compute"}}) == "execute_computation"
    assert route_after_action_selection({"next_action": {"type": "synthesize"}}) == "synthesize_answer"
    assert route_after_reflection({"answer_ready": True}) == "synthesize_answer"
    assert route_after_reflection({"budget_exhausted": True}) == "finalize_response"
    assert route_after_reflection({}) == "select_next_action"


def test_success_path_returns_grounded_answer_with_reasoning_metadata(monkeypatch):
    fake_model = install_fake_model(monkeypatch)

    result = graph.invoke(
        {
            "input": "Compare classical and quantum computers and name one useful application.",
            "reasoning_depth": "standard",
        }
    )

    assert result["status"] == "ok"
    assert result["final_output"]["status"] == "ok"
    assert result["answer_ready"] is True
    assert result["knowledge_gaps"] == []
    assert result["contradictions"] == []
    assert result["selected_branch_id"] == "branch_decomposition_first"
    assert result["budget_used"]["branches"] == 2
    assert result["budget_used"]["retrieval_calls"] >= 1
    assert result["budget_used"]["reflection_rounds"] >= 1
    assert result["budget_used"]["model_calls"] == 2
    assert {item["id"] for item in result["supporting_evidence"]} >= {
        "kb_quantum_bits",
        "kb_quantum_applications",
    }
    assert "decomposed the task" in result["final_output"]["reasoning_summary"]
    assert len(fake_model.calls) == 2


def test_branch_generation_is_capped_by_reasoning_budget(monkeypatch):
    install_fake_model(monkeypatch)

    result = graph.invoke(
        {
            "input": "Compare classical and quantum computers and name one useful application.",
            "reasoning_depth": "deep",
            "reasoning_budget": {"branches": 1},
        }
    )

    assert len(result["candidate_branches"]) == 1
    assert result["budget_used"]["branches"] == 1


def test_missing_evidence_reflects_then_returns_partial_without_fabrication(monkeypatch):
    fake_model = install_fake_model(monkeypatch)

    def comparison_only_retriever(**kwargs):
        if kwargs["subquestion_id"] == "application":
            return []
        return [
            {
                "id": "comparison_only",
                "topics": ["representation", "processing"],
                "claim": "Classical computers use bits, while quantum computers use qubits.",
                "confidence": 0.9,
            }
        ]

    result = graph.invoke(
        {
            "input": "Compare classical and quantum computers and name one useful application.",
            "retriever": comparison_only_retriever,
            "reasoning_budget": {"retrieval_calls": 2, "reflection_rounds": 2},
        }
    )

    assert result["final_output"]["status"] == "partial"
    assert result["budget_exhausted"] is True
    assert result["budget_used"]["retrieval_calls"] == 2
    assert result["budget_used"]["reflection_rounds"] == 2
    assert any("application" in gap.lower() for gap in result["knowledge_gaps"])
    assert "partial" in result["final_output"]["answer"].lower()
    assert len(fake_model.calls) == 0


def test_numeric_question_routes_through_local_computation(monkeypatch):
    fake_model = install_fake_model(
        monkeypatch,
        responses=[
            "The computed result is 14.",
            "The computed result is 14.",
        ],
    )

    result = graph.invoke(
        {
            "input": "Compute 2 + 3 * 4 and explain the result.",
            "allow_computation": True,
        }
    )

    assert result["final_output"]["status"] == "ok"
    assert result["computation_results"] == [
        {"subquestion_id": "computation", "expression": "2+3*4", "result": 14}
    ]
    assert result["budget_used"]["computation_calls"] == 1
    assert len(fake_model.calls) == 2


def test_computation_disabled_returns_controlled_partial_without_result(monkeypatch):
    fake_model = install_fake_model(monkeypatch)

    result = graph.invoke(
        {
            "input": "Compute 2 + 3 * 4 and explain the result.",
            "allow_computation": False,
            "reasoning_budget": {"computation_calls": 1, "reflection_rounds": 1},
        }
    )

    assert result["final_output"]["status"] == "insufficient_evidence"
    assert result["computation_results"] == []
    assert "Computation is disabled" in result["errors"][0]
    assert len(fake_model.calls) == 0


def test_contradictory_evidence_is_recorded_and_prevents_ok(monkeypatch):
    fake_model = install_fake_model(monkeypatch)
    knowledge_base = [
        {
            "id": "app_a",
            "topics": ["application"],
            "claim": "Molecular simulation is a supported quantum computing application.",
            "confidence": 0.9,
            "contradicts": "app_b",
        },
        {
            "id": "app_b",
            "topics": ["application"],
            "claim": "No useful quantum computing applications are supported.",
            "confidence": 0.7,
            "contradicts": "app_a",
        },
        {
            "id": "compare",
            "topics": ["representation", "processing"],
            "claim": "Classical computers use bits, while quantum computers use qubits.",
            "confidence": 0.9,
        },
    ]

    result = graph.invoke(
        {
            "input": "Compare classical and quantum computers and name one useful application.",
            "knowledge_base": knowledge_base,
        }
    )

    assert result["final_output"]["status"] == "partial"
    assert result["contradictions"]
    assert result["contradictions"][0]["resolved"] is False
    assert "partial" in result["final_output"]["answer"].lower()
    assert len(fake_model.calls) == 2


def test_retrieval_failure_is_captured_without_crashing(monkeypatch):
    fake_model = install_fake_model(monkeypatch)

    def failing_retriever(**kwargs):
        raise RuntimeError("fixture store unavailable")

    result = graph.invoke(
        {
            "input": "Compare classical and quantum computers.",
            "retriever": failing_retriever,
            "reasoning_budget": {"retrieval_calls": 1, "reflection_rounds": 1},
        }
    )

    assert result["final_output"]["status"] == "insufficient_evidence"
    assert any("fixture store unavailable" in error for error in result["errors"])
    assert result["budget_used"]["retrieval_calls"] == 1
    assert result["supporting_evidence"] == []
    assert len(fake_model.calls) == 0


def test_blank_input_finalizes_invalid_without_tool_or_model_calls(monkeypatch):
    fake_model = install_fake_model(monkeypatch)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "invalid_input"
    assert result["final_output"]["status"] == "invalid_input"
    assert result["final_output"]["supporting_evidence"] == []
    assert result["budget_used"]["retrieval_calls"] == 0
    assert result["budget_used"]["computation_calls"] == 0
    assert fake_model.calls == []

