from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_14_knowledge_retrieval_rag import nodes
from agentic_design_patterns.patterns.chapter_14_knowledge_retrieval_rag.graph import graph


REMOTE_CHUNK_ID = "hr-handbook-2025::remote-work::1"
STALE_REMOTE_CHUNK_ID = "hr-remote-blog-2020::remote-work-pilot::1"
VPN_CHUNK_ID = "it-security-2025::vpn-access::1"


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


def answer_payload(answer: str, citations: list[str]) -> str:
    return json.dumps({"answer": answer, "citations": citations})


def test_happy_path_returns_grounded_answer_with_citations(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Employees may work remotely up to three days per week with manager approval.",
                [REMOTE_CHUNK_ID],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the current remote work policy?"})

    assert result["final_output"]["status"] == "answered"
    assert result["grounding_status"] == "grounded"
    assert result["context_quality"] == "sufficient"
    assert result["retrieval_attempts"] == 1
    assert result["final_output"]["citations"][0]["chunk_id"] == REMOTE_CHUNK_ID
    assert result["errors"] == []
    assert len(fake_model.calls) == 1


def test_low_score_triggers_one_query_rewrite_then_answers(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Employees may work remotely up to three days per week with manager approval.",
                [REMOTE_CHUNK_ID],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the WFH limit?"})

    assert result["final_output"]["status"] == "answered"
    assert result["retrieval_attempts"] == 2
    assert result["query_rewrites"] == [
        "What is the WFH limit? remote work policy days manager approval"
    ]
    assert result["final_output"]["grounding_status"] == "grounded"
    assert len(fake_model.calls) == 1


def test_unknown_question_returns_insufficient_context_without_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the contractor equity vesting schedule?"})

    assert result["final_output"]["status"] == "insufficient_context"
    assert result["grounding_status"] == "unsupported"
    assert result["retrieval_attempts"] == 2
    assert result["final_output"]["citations"] == []
    assert "confidence threshold" in result["knowledge_gap"]
    assert fake_model.calls == []


def test_authoritative_current_source_wins_over_stale_source(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Employees may work remotely up to three days per week with manager approval.",
                [REMOTE_CHUNK_ID],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "How many remote work days are allowed?"})

    ranked_ids = [chunk["chunk_id"] for chunk in result["ranked_chunks"]]
    assert REMOTE_CHUNK_ID in ranked_ids
    assert STALE_REMOTE_CHUNK_ID not in ranked_ids
    assert result["contradictions"][0]["resolved"] is True
    assert "Preferred" in result["contradictions"][0]["resolution"]
    assert result["final_output"]["status"] == "answered"


def test_unresolved_contradiction_returns_insufficient_context(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    documents = [
        {
            "source_id": "policy-a-2025",
            "title": "Remote Policy A",
            "metadata": {
                "authority": 0.9,
                "authoritative": True,
                "freshness_year": 2025,
            },
            "sections": [
                {
                    "id": "remote-work",
                    "section": "Remote Work",
                    "text": "Employees may work remotely two days per week.",
                    "metadata": {
                        "topic": "remote_work",
                        "facts": {"remote_days": "two"},
                    },
                }
            ],
        },
        {
            "source_id": "policy-b-2025",
            "title": "Remote Policy B",
            "metadata": {
                "authority": 0.88,
                "authoritative": True,
                "freshness_year": 2025,
            },
            "sections": [
                {
                    "id": "remote-work",
                    "section": "Remote Work",
                    "text": "Employees may work remotely four days per week.",
                    "metadata": {
                        "topic": "remote_work",
                        "facts": {"remote_days": "four"},
                    },
                }
            ],
        },
    ]

    result = graph.invoke({"input": "How many remote work days are allowed?", "documents": documents})

    assert result["context_quality"] == "contradictory"
    assert result["final_output"]["status"] == "insufficient_context"
    assert result["contradictions"][0]["resolved"] is False
    assert "conflict" in result["final_output"]["knowledge_gap"]
    assert fake_model.calls == []


def test_fabricated_citation_fails_grounding(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Employees may work remotely up to three days per week with manager approval.",
                ["missing::citation::1"],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "What is the current remote work policy?",
            "retrieval_config": {"max_retrieval_attempts": 1},
        }
    )

    assert result["final_output"]["status"] == "insufficient_context"
    assert result["grounding_status"] == "unsupported"
    assert any("Citations do not map" in error for error in result["errors"])
    assert len(fake_model.calls) == 1


def test_unsupported_answer_is_not_finalized(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Employees may work remotely up to four days per week with manager approval.",
                [REMOTE_CHUNK_ID],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "What is the current remote work policy?",
            "retrieval_config": {"max_retrieval_attempts": 1},
        }
    )

    assert result["final_output"]["status"] == "insufficient_context"
    assert result["grounding_status"] == "unsupported"
    assert any("unsupported quantities" in error for error in result["errors"])
    assert "four" not in result["context"].lower()


def test_retriever_failure_returns_controlled_failure_without_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def failing_retriever(**kwargs):
        raise RuntimeError("vector store unavailable")

    result = graph.invoke(
        {
            "input": "What is the current remote work policy?",
            "retriever": failing_retriever,
        }
    )

    assert result["final_output"]["status"] == "failed"
    assert result["retrieval_attempts"] == 1
    assert any("vector store unavailable" in error for error in result["errors"])
    assert fake_model.calls == []


def test_related_context_expansion_adds_linked_chunks(monkeypatch):
    fake_model = FakeChatModel(
        [
            answer_payload(
                "Remote employees access payroll through SecureTunnel VPN with multi-factor authentication.",
                [REMOTE_CHUNK_ID, VPN_CHUNK_ID],
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def remote_only_retriever(**kwargs):
        chunks = {chunk["chunk_id"]: chunk for chunk in kwargs["chunks"]}
        chunk = dict(chunks[REMOTE_CHUNK_ID])
        chunk["score"] = 0.86
        return [chunk]

    result = graph.invoke(
        {
            "input": "How do remote employees access payroll?",
            "retriever": remote_only_retriever,
        }
    )

    assert result["final_output"]["status"] == "answered"
    assert [chunk["chunk_id"] for chunk in result["related_chunks"]] == [VPN_CHUNK_ID]
    assert {citation["chunk_id"] for citation in result["final_output"]["citations"]} == {
        REMOTE_CHUNK_ID,
        VPN_CHUNK_ID,
    }
