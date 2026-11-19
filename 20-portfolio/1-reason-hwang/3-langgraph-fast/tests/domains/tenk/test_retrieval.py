import pytest

from domains.tenk.retrieval import RetrievalService


def test_retrieval_requires_exact_filing_scope():
    service = RetrievalService(store=object())
    with pytest.raises(ValueError, match="exact modeled filing"):
        service.retrieve("risks", ticker="AAPL")


def test_retrieval_uses_published_analysis_contract(monkeypatch):
    seen = []
    def fake_search(request, store):
        seen.append(request)
        return {"items": [{"id": "evidence-1", "evidenceId": "evidence-1", "type": "Chunk", "text": "Risk statement", "filingId": request.filingIds[0], "score": 0.016}]}
    monkeypatch.setattr("domains.tenk.retrieval.search", fake_search)
    answer, result = RetrievalService(store=object()).answer("risks", {"cik": "320193", "accessionNo": "0000320193-26-000001"})
    assert seen[0].filingIds == ["filing:0000320193:0000320193-26-000001"]
    assert result.evidence_bundle[0].score == 0.016
    assert "[evidence-1]" in answer
