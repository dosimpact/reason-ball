from langgraph_fast.domains.tenk.retrieval import RetrievalService


class FakeResult:
    def __init__(self, row):
        self.row = row

    def single(self):
        return self.row


class FakeSession:
    def __init__(self, row=None):
        self.row = row
        self.calls = []

    def run(self, query, **params):
        self.calls.append({"query": query, "params": params})
        return FakeResult(self.row)


def test_resolve_selected_filing_prefers_accession_over_company_fallback() -> None:
    session = FakeSession(
        {
            "filing_id": "acc:0000320193-25-000079",
            "accession_no": "0000320193-25-000079",
            "company_name": "Apple Inc.",
            "ticker": "AAPL",
            "cik": "0000320193",
            "form_type": "10-K",
            "filing_date": "2025-10-31",
        }
    )
    service = RetrievalService.__new__(RetrievalService)

    resolved = service._resolve_selected_filing(
        session,
        selected_filing={"accessionNo": "0000320193-25-000079", "ticker": "AAPL", "cik": "0000320193"},
        company_query=None,
        ticker=None,
        cik=None,
        accession_no=None,
        filing_id=None,
    )

    assert resolved is not None
    assert resolved["accession_no"] == "0000320193-25-000079"
    assert session.calls[0]["params"] == {
        "filing_id": None,
        "accession_no": "0000320193-25-000079",
    }


def test_resolve_selected_filing_does_not_fallback_when_exact_filing_is_missing() -> None:
    session = FakeSession()
    service = RetrievalService.__new__(RetrievalService)

    resolved = service._resolve_selected_filing(
        session,
        selected_filing={"accessionNo": "missing", "ticker": "AAPL", "cik": "0000320193"},
        company_query=None,
        ticker=None,
        cik=None,
        accession_no=None,
        filing_id=None,
    )

    assert resolved is not None
    assert resolved["accession_no"] == "missing"
    assert len(session.calls) == 1
