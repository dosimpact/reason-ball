from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ParseFileRequest(BaseModel):
    path: str = Field(..., description="문서 파일 경로")
    company_name: Optional[str] = None
    ticker: Optional[str] = None
    report_type: Optional[str] = None
    source_url: Optional[str] = None
    filing_date: Optional[str] = None
    accession_no: Optional[str] = None
    cik: Optional[str] = None
    report_id: Optional[str] = None
    metadata_json: Optional[str] = None
    dry_run: bool = False
    include_debug: bool = False
    pretty: bool = False


class ParseManifestRequest(BaseModel):
    manifest: str = Field(..., description="manifest JSON/JSONL 경로")
    limit: Optional[int] = None
    dry_run: bool = False
    pretty: bool = False


class RunRequest(BaseModel):
    adapter: str = Field(default="mock", pattern=r"^(mock|http)$")
    status: str = "ready_for_parse"
    limit: int = 10
    timeout_sec: int = 30
    dry_run: bool = False
    pretty: bool = False


class InitNeo4jRequest(BaseModel):
    database: Optional[str] = None
    pretty: bool = False


class CollectorParseRequest(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, alias="pageSize", ge=1, le=100)
    form_type: Optional[str] = Field(default=None, alias="formType")
    ticker: Optional[str] = None
    since: Optional[str] = None
    cik: Optional[str] = None
    parser_status: Optional[str] = Field(default="", alias="parserStatus")
    dry_run: bool = False
    include_debug: bool = False
    parser_status_on_success: str = Field(default="parsed", alias="parserStatusOnSuccess")
    parser_status_on_failure: str = Field(default="parse_failed", alias="parserStatusOnFailure")

    model_config = {"populate_by_name": True}


class GraphRagQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Graph RAG grounded question")
    company_query: Optional[str] = Field(default=None, alias="companyQuery")
    selected_filing: Optional[dict[str, Any]] = Field(default=None, alias="selectedFiling")
    ticker: Optional[str] = None
    cik: Optional[str] = None
    accession_no: Optional[str] = Field(default=None, alias="accessionNo")
    filing_id: Optional[str] = Field(default=None, alias="filingId")
    evidence_limit: int = Field(default=8, alias="evidenceLimit", ge=1, le=20)

    model_config = {"populate_by_name": True}
