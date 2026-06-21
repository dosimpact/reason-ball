from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from parser.retrieval.service import RetrievalService


@dataclass
class FakeResult:
    rows: list[dict[str, Any]]

    def single(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def data(self) -> list[dict[str, Any]]:
        return self.rows


class FakeSession:
    def __init__(self) -> None:
        self.retrieval_filing_ids: list[str | None] = []
        self.resolve_calls = 0

    def __enter__(self) -> FakeSession:
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:  # noqa: ANN001
        return None

    def run(self, query: str, **params: Any) -> FakeResult:
        if "MATCH (c:Company)-[:FILED]->(f:Filing)" in query:
            self.resolve_calls += 1
            accession_no = params.get("accession_no")
            if accession_no == "000TARGET-26-000001":
                return FakeResult(
                    [
                        {
                            "filing_id": "acc:000TARGET-26-000001",
                            "accession_no": "000TARGET-26-000001",
                            "company_name": "Target Corp.",
                            "ticker": "TGT",
                            "cik": "0000000001",
                            "form_type": "10-K",
                            "filing_date": "2026-02-01",
                        }
                    ]
                )
            return FakeResult([])

        if "MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_RISK]->(r:Risk)" in query:
            filing_id = params.get("filing_id")
            self.retrieval_filing_ids.append(filing_id)
            if filing_id != "acc:000TARGET-26-000001":
                return FakeResult(
                    [
                        {
                            "company_name": "Distractor Inc.",
                            "filing_id": "acc:000DISTRACTOR-26-000001",
                            "item_code": "1A",
                            "text": "Distractor risk should not leak into scoped retrieval.",
                            "node_type": "Risk",
                            "term_matches": 1,
                        }
                    ]
                )

            return FakeResult(
                [
                    {
                        "company_name": "Target Corp.",
                        "filing_id": "acc:000TARGET-26-000001",
                        "item_code": "1A",
                        "text": "Target-specific risk evidence for the selected filing.",
                        "node_type": "Risk",
                        "term_matches": 1,
                    }
                ]
            )

        if "MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)" in query:
            filing_id = params.get("filing_id")
            self.retrieval_filing_ids.append(filing_id)
            if filing_id == "acc:000TARGET-26-000001":
                return FakeResult(
                    [
                        {
                            "company_name": "Target Corp.",
                            "filing_id": "acc:000TARGET-26-000001",
                            "item_code": "1A",
                            "text": "Target filing section text mentioning risk controls.",
                            "node_type": "SectionText",
                            "term_matches": 1,
                        }
                    ]
                )
            return FakeResult([])

        return FakeResult([])


class FakeDriver:
    def __init__(self, session: FakeSession) -> None:
        self.fake_session = session

    def session(self, *, database: str) -> FakeSession:  # noqa: ARG002
        return self.fake_session

    def close(self) -> None:
        return None


def create_service(session: FakeSession) -> RetrievalService:
    service = object.__new__(RetrievalService)
    service.driver = FakeDriver(session)
    service.database = "neo4j"
    return service


def selected_filing_scope_smoke() -> None:
    session = FakeSession()
    service = create_service(session)

    result = service.retrieve(
        query="What are the selected filing risk factors?",
        selected_filing={
            "accessionNo": "000TARGET-26-000001",
            "companyName": "Target Corp.",
            "ticker": "TGT",
            "cik": "0000000001",
            "formType": "10-K",
            "filingDate": "2026-02-01",
        },
        evidence_limit=4,
    )

    assert result.selected_filing is not None
    assert result.selected_filing["filing_id"] == "acc:000TARGET-26-000001"
    assert result.selected_filing["accession_no"] == "000TARGET-26-000001"
    assert result.evidence_bundle, "selected filing should return scoped evidence"
    assert all(
        evidence.filing_id == "acc:000TARGET-26-000001"
        for evidence in result.evidence_bundle
    ), result.evidence_bundle
    assert all(
        "Distractor" not in evidence.text for evidence in result.evidence_bundle
    ), result.evidence_bundle
    assert session.retrieval_filing_ids
    assert set(session.retrieval_filing_ids) == {"acc:000TARGET-26-000001"}

    print("retrieval_selected_filing_scope_smoke=pass")


def unresolved_selected_filing_smoke() -> None:
    session = FakeSession()
    service = create_service(session)

    result = service.retrieve(
        query="risk factors",
        selected_filing={
            "accessionNo": "000MISSING-26-000001",
            "companyName": "Missing Corp.",
        },
        evidence_limit=4,
    )

    assert result.selected_filing is not None
    assert result.selected_filing["unresolved"] is True
    assert result.evidence_bundle == []
    assert session.retrieval_filing_ids == []

    print("retrieval_unresolved_selected_filing_smoke=pass")


def main() -> None:
    selected_filing_scope_smoke()
    unresolved_selected_filing_smoke()


if __name__ == "__main__":
    main()
