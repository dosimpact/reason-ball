"""Compatibility facade for the published SEC analysis contract.

The LangGraph subgraph and CLI retain their response shape, but no longer query
legacy Risk, Metric, or SectionText nodes or invent ranking scores.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from domains.sec_modeling.contracts import SearchRequest
from domains.sec_modeling.search import search
from domains.sec_modeling.store import GraphStore


@dataclass
class Evidence:
    citation_label: str
    node_type: str
    text: str
    item_code: str | None
    filing_id: str | None
    company_name: str | None
    score: float
    reason: str


@dataclass
class RetrievalResult:
    intent: str
    selected_filing: dict[str, Any] | None
    evidence_bundle: list[Evidence]


class RetrievalService:
    def __init__(self, settings=None, *, store=None) -> None:
        self.store = store or GraphStore()

    def close(self) -> None:
        self.store.close()

    def retrieve(self, query, selected_filing=None, *, company_query=None,
                 ticker=None, cik=None, accession_no=None, filing_id=None,
                 evidence_limit=8) -> RetrievalResult:
        selected = dict(selected_filing or {})
        cik = cik or selected.get("cik")
        accession_no = accession_no or selected.get("accessionNo") or selected.get("accession_no")
        identity = filing_id or selected.get("filingId") or selected.get("filing_id")
        if not identity and cik and accession_no:
            identity = f"filing:{str(cik).zfill(10)}:{accession_no}"
        if not identity or not re.fullmatch(r"filing:\d{10}:\d{10}-\d{2}-\d{6}", identity):
            raise ValueError("Select an exact modeled filing using CIK and accessionNo before searching")
        selected["filing_id"] = identity
        result = search(SearchRequest(query=query, filingIds=[identity], topK=evidence_limit), self.store)
        evidence = [Evidence(
            citation_label=row.get("evidenceId", row["id"]),
            node_type=row["type"], text=row["text"], item_code=row.get("itemCode"),
            filing_id=row["filingId"], company_name=selected.get("companyName") or selected.get("company_name"),
            score=row["score"], reason="Published SEC semantic evidence",
        ) for row in result["items"]]
        return RetrievalResult("evidence", selected, evidence)

    def answer(self, query, selected_filing=None, **filters):
        result = self.retrieve(query, selected_filing, **filters)
        if not result.evidence_bundle:
            return "No published evidence found. Complete modeling 1 and 2 for the selected filing.", result
        return "\n".join(f"- [{item.citation_label}] {item.text[:900]}" for item in result.evidence_bundle), result
