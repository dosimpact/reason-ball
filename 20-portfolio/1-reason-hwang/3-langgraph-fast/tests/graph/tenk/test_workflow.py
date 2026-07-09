import asyncio
from dataclasses import dataclass

import pytest

from langgraph_fast.graph.tenk.workflow import run_tenk_graph


@dataclass
class FakeEvidence:
    citation_label: str = "Item 1A"
    node_type: str = "Risk"
    text: str = "Cybersecurity risks may affect operations."
    item_code: str = "1A"
    filing_id: str = "acc:test"
    company_name: str = "Sample Technology Inc."
    score: float = 1.0
    reason: str = "risk retrieval match"


@dataclass
class FakeResult:
    intent: str
    evidence_bundle: list[FakeEvidence]


class FakeRetrievalService:
    def answer(self, query: str, selected_filing=None):
        assert query == "What are the main risks?"
        return "Grounded answer", FakeResult(intent="risk", evidence_bundle=[FakeEvidence()])

    def close(self) -> None:
        return None


def test_tenk_graph_returns_grounded_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("langgraph_fast.graph.tenk.workflow.RetrievalService", FakeRetrievalService)

    result = asyncio.run(run_tenk_graph("What are the main risks?"))

    assert result["intent"] == "risk"
    assert result["answer"] == "Grounded answer"
    assert result["evidence"][0]["citation_label"] == "Item 1A"
