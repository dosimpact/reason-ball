from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from parser.api.models import GraphRagQueryRequest
from parser.retrieval.service import Evidence, RetrievalService

router = APIRouter(prefix="/api/graph-rag", tags=["graph-rag"])


def _serialize_evidence(evidence: Evidence) -> dict[str, Any]:
    return {
        "citationLabel": evidence.citation_label,
        "nodeType": evidence.node_type,
        "text": evidence.text,
        "itemCode": evidence.item_code,
        "filingId": evidence.filing_id,
        "companyName": evidence.company_name,
        "score": evidence.score,
        "reason": evidence.reason,
    }


def _serialize_selected_filing(selected_filing: dict[str, Any] | None) -> dict[str, Any] | None:
    if not selected_filing:
        return None

    return {
        "filingId": selected_filing.get("filing_id"),
        "accessionNo": selected_filing.get("accession_no"),
        "companyName": selected_filing.get("company_name"),
        "ticker": selected_filing.get("ticker"),
        "cik": selected_filing.get("cik"),
        "formType": selected_filing.get("form_type"),
        "filingDate": selected_filing.get("filing_date"),
    }


@router.post("/query")
def query_graph_rag(req: GraphRagQueryRequest) -> dict[str, Any]:
    retrieval = RetrievalService()

    try:
        answer_text, result = retrieval.answer(
            query=req.query,
            selected_filing=req.selected_filing,
            company_query=req.company_query,
            ticker=req.ticker,
            cik=req.cik,
            accession_no=req.accession_no,
            filing_id=req.filing_id,
            evidence_limit=req.evidence_limit,
        )
    finally:
        retrieval.close()

    return {
        "intent": result.intent,
        "selectedFiling": _serialize_selected_filing(result.selected_filing),
        "answer": answer_text,
        "evidenceBundle": [_serialize_evidence(evidence) for evidence in result.evidence_bundle],
    }
