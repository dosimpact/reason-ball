from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from langgraph_fast.domains.tenk.pipeline import ParserPipeline, read_manifest
from langgraph_fast.domains.tenk.retrieval import Evidence, RetrievalService
from langgraph_fast.graph.tenk.workflow import run_tenk_graph
from langgraph_fast.infrastructure.neo4j.constraints import init_neo4j_constraints

router = APIRouter(prefix="/api/tenk", tags=["tenk"])
graph_router = APIRouter(prefix="/graph/tenk", tags=["tenk-graph"])


class ParseFileRequest(BaseModel):
    path: str = Field(..., description="Filing file path")
    company_name: str | None = None
    ticker: str | None = None
    report_type: str | None = None
    source_url: str | None = None
    filing_date: str | None = None
    accession_no: str | None = None
    cik: str | None = None
    report_id: str | None = None
    metadata_json: str | None = None
    dry_run: bool = False
    include_debug: bool = False


class ParseManifestRequest(BaseModel):
    manifest: str
    limit: int | None = None
    dry_run: bool = False
    include_debug: bool = False


class InitNeo4jRequest(BaseModel):
    database: str | None = None


class TenkQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    selected_filing: dict[str, Any] | None = Field(default=None, alias="selectedFiling")
    company_query: str | None = Field(default=None, alias="companyQuery")
    ticker: str | None = None
    cik: str | None = None
    accession_no: str | None = Field(default=None, alias="accessionNo")
    filing_id: str | None = Field(default=None, alias="filingId")
    evidence_limit: int = Field(default=8, alias="evidenceLimit", ge=1, le=20)

    model_config = {"populate_by_name": True}


class TenkGraphRunRequest(BaseModel):
    query: str = Field(..., min_length=1)
    selected_filing: dict[str, Any] | None = Field(default=None, alias="selectedFiling")

    model_config = {"populate_by_name": True}


def _build_metadata(req: ParseFileRequest) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    if req.metadata_json:
        path = Path(req.metadata_json)
        if not path.exists():
            raise HTTPException(status_code=400, detail=f"metadata_json not found: {path}")
        metadata.update(json.loads(path.read_text(encoding="utf-8")))
    for key in (
        "company_name",
        "ticker",
        "report_type",
        "source_url",
        "filing_date",
        "accession_no",
        "cik",
        "report_id",
    ):
        value = getattr(req, key)
        if value is not None:
            metadata[key] = value
    return metadata


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


@router.post("/init-neo4j")
def init_neo4j(req: InitNeo4jRequest) -> dict[str, Any]:
    return init_neo4j_constraints(database=req.database)


@router.post("/parse-file")
def parse_file(req: ParseFileRequest) -> dict[str, Any]:
    pipeline = ParserPipeline(write_to_neo4j=not req.dry_run)
    try:
        return pipeline.parse_file(req.path, metadata=_build_metadata(req), include_debug=req.include_debug)
    finally:
        pipeline.close()


@router.post("/parse-manifest")
def parse_manifest(req: ParseManifestRequest) -> dict[str, Any]:
    pipeline = ParserPipeline(write_to_neo4j=not req.dry_run)
    try:
        return pipeline.parse_manifest_records(
            read_manifest(req.manifest),
            limit=req.limit,
            include_debug=req.include_debug,
        )
    finally:
        pipeline.close()


@router.post("/query")
def query(req: TenkQueryRequest) -> dict[str, Any]:
    service = RetrievalService()
    try:
        answer, result = service.answer(
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
        service.close()
    return {
        "intent": result.intent,
        "selectedFiling": result.selected_filing,
        "answer": answer,
        "evidenceBundle": [_serialize_evidence(evidence) for evidence in result.evidence_bundle],
    }


@graph_router.post("/run")
async def graph_run(req: TenkGraphRunRequest) -> dict[str, Any]:
    result = await run_tenk_graph(query=req.query, selected_filing=req.selected_filing)
    return {
        "query": result["query"],
        "intent": result["intent"],
        "answer": result["answer"],
        "evidence": result["evidence"],
        "selectedFiling": result["selected_filing"],
    }
