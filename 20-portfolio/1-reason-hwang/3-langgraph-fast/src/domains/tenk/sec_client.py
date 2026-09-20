"""Read-only SEC BFF client. No document collection or database writes."""
from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any

import httpx


class SecReadError(ValueError):
    """A readable domain error; never exposes upstream credentials or bodies."""


def validate_filing_identity(cik: str, accession: str) -> None:
    if not re.fullmatch(r"\d{10}", cik) or not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession):
        raise SecReadError("공시 식별자 형식이 잘못되었습니다.")


class SecClient:
    def __init__(self, base_url: str | None = None, *, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = (base_url or os.getenv("A2UI_SEC_BFF_URL", "http://127.0.0.1:2801")).rstrip("/")
        self.transport = transport

    async def _read(self, path: str, *, params: dict | None = None, max_bytes: int = 2 * 1024 * 1024) -> str:
        try:
            async with (
                httpx.AsyncClient(base_url=self.base_url, transport=self.transport, timeout=60, follow_redirects=False) as client,
                client.stream("GET", path, params=params) as response,
            ):
                if response.status_code == 409:
                    raise SecReadError("선택 공시의 원문이 아직 저장되지 않았습니다.")
                if response.status_code == 404:
                    raise SecReadError("선택한 회사 또는 공시를 찾을 수 없습니다.")
                if response.status_code != 200:
                    raise SecReadError(f"SEC 조회 서비스 오류 ({response.status_code}). 다시 시도해 주세요.")
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(data) + len(chunk) > max_bytes:
                        raise SecReadError("SEC 응답이 분석 크기 제한을 초과했습니다.")
                    data.extend(chunk)
                return data.decode("utf-8", errors="strict")
        except (httpx.HTTPError, UnicodeDecodeError) as error:
            raise SecReadError("SEC 조회 서비스에 연결할 수 없거나 응답을 읽을 수 없습니다.") from error

    async def _page(self, path: str, params: dict) -> dict[str, Any]:
        raw = await self._read(path, params=params)
        try:
            result = json.loads(raw)
        except json.JSONDecodeError as error:
            raise SecReadError("SEC 조회 응답이 올바른 JSON이 아닙니다.") from error
        if not isinstance(result, dict) or not isinstance(result.get("items"), list) or not isinstance(result.get("pagination"), dict):
            raise SecReadError("SEC 조회 응답 형식이 잘못되었습니다.")
        if len(result["items"]) > 10 or any(not isinstance(row, dict) for row in result["items"]):
            raise SecReadError("SEC 조회 결과가 요청한 페이지 범위를 벗어났습니다.")
        return result

    async def companies(self, query: str, page: int = 1) -> dict[str, Any]:
        if not isinstance(query, str) or len(query) > 120 or type(page) is not int or not 1 <= page <= 100000:
            raise SecReadError("검색어 또는 페이지가 잘못되었습니다.")
        return await self._page("/api/sec/companies", {"q": query.strip(), "page": page, "pageSize": 10})

    async def filings(self, cik: str, page: int = 1, *, status: str = "", form: str = "", since: str = "") -> dict[str, Any]:
        if not re.fullmatch(r"\d{10}", cik) or type(page) is not int or not 1 <= page <= 100000:
            raise SecReadError("회사 식별자 또는 페이지가 잘못되었습니다.")
        if status not in {"", "downloaded", "pending", "failed"} or form not in {"", "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"}:
            raise SecReadError("공시 조회 필터가 잘못되었습니다.")
        if since:
            try:
                date.fromisoformat(since)
            except ValueError as error:
                raise SecReadError("제출 시작일은 YYYY-MM-DD 형식으로 입력해 주세요.") from error
        params = {"cik": cik, "page": page, "pageSize": 10, "includeContent": "false", "includeAmendments": "true"}
        params.update({key: value for key, value in {"status": status, "formType": form, "since": since}.items() if value})
        result = await self._page("/api/sec/filings", params)
        if any(row.get("cik") != cik for row in result["items"]):
            raise SecReadError("선택 회사와 공시 조회 결과가 일치하지 않습니다.")
        return result

    async def content(self, cik: str, accession: str) -> str:
        validate_filing_identity(cik, accession)
        return await self._read(f"/api/sec/filings/{cik}/{accession}/content", max_bytes=32 * 1024 * 1024)
