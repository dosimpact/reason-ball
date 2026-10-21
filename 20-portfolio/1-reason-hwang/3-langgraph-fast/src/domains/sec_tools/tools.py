"""Six BFF endpoints as typed tools; full responses stay in ToolMessage artifacts."""
from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, model_validator

from domains.tenk.normalizer import html_to_text, normalize_text
from domains.tenk.sec_client import SecReadError


class CompaniesInput(BaseModel):
    q: str = Field(default="", max_length=150)
    ticker: str | None = None
    cik: str | None = Field(default=None, pattern=r"^\d{10}$")
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=10, ge=1, le=100000)


class FilingsInput(BaseModel):
    cik: str | None = Field(default=None, pattern=r"^\d{10}$")
    ticker: str | None = None
    formType: str | None = None
    since: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: Literal["pending", "downloaded", "failed"] | None = None
    parserStatus: str | None = None
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=10, ge=1, le=500)
    includeContent: bool = False
    includeAmendments: bool = True
    includeFormerRegistrants: bool = False

    @model_validator(mode="after")
    def former_requires_cik(self):
        if self.includeFormerRegistrants and not self.cik:
            raise ValueError("includeFormerRegistrants requires cik")
        return self


class ContentInput(BaseModel):
    cik: str = Field(pattern=r"^\d{10}$")
    accessionNo: str = Field(pattern=r"^\d{10}-\d{2}-\d{6}$")
    offset: int = Field(default=0, ge=0, description="Absolute character offset in normalized text; use nextOffset to continue.")
    limit: int = Field(default=20000, ge=100, le=60000)
    query: str = Field(default="", max_length=200, description="Optional literal text to locate when offset is zero. Subsequent nextOffset values are absolute.")


class SyncInput(BaseModel):
    years: int = Field(default=20, ge=1, le=30)
    downloadDocuments: bool = True
    refreshArchive: bool = False


class SelectedSyncInput(SyncInput):
    ciks: list[str] = Field(default_factory=list)
    tickers: list[str] = Field(default_factory=list)
    since: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def require_targets(self):
        import re
        if not (self.ciks or self.tickers) or any(not re.fullmatch(r"\d{10}", cik) for cik in self.ciks):
            raise ValueError("Provide valid ciks or tickers")
        return self


class EmptyInput(BaseModel):
    pass


class SecBffClient:
    def __init__(self, base_url=None, transport=None):
        self.base_url = base_url or os.getenv("SEC_CHAT_BFF_URL", "http://127.0.0.1:2801")
        self.transport = transport

    async def request(self, method, path, *, params=None, body=None, stream=False, raw=False):
        params = {k: str(v).lower() if isinstance(v, bool) else v for k, v in (params or {}).items() if v is not None}
        try:
            async with httpx.AsyncClient(base_url=self.base_url, transport=self.transport, timeout=httpx.Timeout(900, connect=10), follow_redirects=False) as client:  # noqa: SIM117
                async with client.stream(method, '/api/sec/' + path, params=params, json=body) as response:
                    if response.status_code not in (200, 201):
                        raise SecReadError(f"SEC BFF request failed ({response.status_code})")
                    if stream:
                        event, completed = "", None
                        async for line in response.aiter_lines():
                            if line.startswith('event:'):
                                event = line[6:].strip()
                            elif line.startswith('data:'):
                                payload = json.loads(line[5:])
                                if event == 'error':
                                    raise SecReadError("SEC collection failed; rerun to resume")
                                if event == 'completed':
                                    completed = payload
                        if not isinstance(completed, dict) or completed.get('failed', 0):
                            raise SecReadError("SEC collection incomplete or documents failed")
                        return {**completed, "checkedAt": datetime.now(UTC).isoformat()}
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 64 * 1024 * 1024:
                            raise SecReadError("SEC response exceeds 64 MiB")
                    text = data.decode('utf-8')
                    return text if raw else json.loads(text)
        except (httpx.HTTPError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SecReadError("SEC BFF connection or response failed") from error


def compact(value):
    """Bound model context, preserving explicit truncation and original artifacts."""
    if isinstance(value, str) and len(value) > 20000:
        return {"excerpt": value[:20000], "truncated": True, "totalCharacters": len(value)}
    if isinstance(value, list):
        return [compact(item) for item in value]
    if isinstance(value, dict):
        return {key: compact(item) for key, item in value.items()}
    return value


def build_sec_tools(client=None, activity=None, *, allowed_ciks=None, allow_sync=True):
    client = client or SecBffClient()

    def make(name, description, schema, method, path, *, stream=False, raw=False):
        async def execute(**kwargs):
            identity = uuid4().hex
            def emit(status):
                if activity:
                    activity({"id": identity, "label": f"SEC 도구 · {name}", "status": status, "kind": "node"})
            emit("running")
            try:
                args = schema(**kwargs).model_dump(exclude_none=True)
                if allowed_ciks is not None:
                    requested = args.get('ciks', [args.get('cik')])
                    if args.get('ticker') or args.get('tickers') or any(cik not in allowed_ciks for cik in requested):
                        raise SecReadError("Tool request outside the selected company scope")
                if method == 'POST' and not allow_sync:
                    raise SecReadError("Synchronization is disabled for this request")
                actual_path = path
                if raw:
                    actual_path = f"filings/{args['cik']}/{args['accessionNo']}/content"
                result = await client.request(method, actual_path, params=args if method == 'GET' and not raw else None,
                                              body=args if method == 'POST' else None, stream=stream, raw=raw)
                artifact = {"tool": name, "args": args, "result": result}
                if raw:
                    if not isinstance(result, str):
                        raise SecReadError("SEC content must be text")
                    text = normalize_text(html_to_text(result))
                    match = text.lower().find(args['query'].lower()) if args['query'] else 0
                    start = args['offset'] or max(0, match)
                    end = min(start + args['limit'], len(text))
                    visible = {"cik": args['cik'], "accessionNo": args['accessionNo'], "text": text[start:end],
                               "offset": start, "nextOffset": end if end < len(text) else None,
                               "totalCharacters": len(text), "queryFound": match >= 0,
                               "note": "Only this excerpt was shown; request further offsets or queries for more evidence."}
                else:
                    visible = compact(result)
                emit("completed")
                return json.dumps(visible, ensure_ascii=False), artifact
            except asyncio.CancelledError:
                emit("cancelled")
                raise
            except Exception:
                emit("failed")
                raise
        return StructuredTool.from_function(coroutine=execute, name=name, description=description,
                                            args_schema=schema, response_format="content_and_artifact")

    return [
        make('search_sec_companies', 'Search stored SEC companies by exact ticker, CIK or partial q. Use ticker first, then q if no match. Returns authoritative CIKs and pagination.', CompaniesInput, 'GET', 'companies'),
        make('list_sec_filings', 'List stored filings newest first; filter formType, company, since, status. Amendments link to originals but are never merged. includeContent optionally includes bodies. Empty results do not establish absence at SEC.', FilingsInput, 'GET', 'filings'),
        make('get_sec_filing_content', 'Read a stored filing body as normalized text excerpts. Requires actual CIK/accessionNo from list_sec_filings. Use query or offset to inspect more; do not claim unread text was reviewed.', ContentInput, 'GET', '', raw=True),
        make('sync_sec_companies', 'Synchronize the SEC company directory. Writes stored company metadata; use when requested or directory lookup is unavailable.', EmptyInput, 'POST', 'company-sync-jobs'),
        make('sync_sec_company_filings', 'Collect selected companies filing metadata and optionally documents. Use for latest recheck or missing data. Awaits SSE completion; failed documents cause failure. years defaults to 20; select the needed range.', SelectedSyncInput, 'POST', 'company-filing-sync-jobs', stream=True),
        make('sync_all_sec_company_filings', 'Collect ALL ticker-bearing companies, potentially a large long-running job. Use only when the user explicitly requests whole-universe collection; not for an individual company report.', SyncInput, 'POST', 'all-company-filing-sync-jobs', stream=True),
    ]
