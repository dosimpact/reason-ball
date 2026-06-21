from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import requests


@dataclass
class CollectorFiling:
    accession_no: str
    cik: str
    form_type: str
    filing_date: str | None
    report_date: str | None
    primary_doc: str | None
    filing_url: str
    file_path: str | None
    checksum: str | None
    parser_status: str
    ticker: str | None = None


@dataclass
class DownloadedReport:
    accession_no: str
    cik: str
    ticker: str | None
    form_type: str
    filing_date: str | None
    report_date: str | None
    primary_doc: str | None
    filing_url: str
    file_path: str
    checksum: str | None
    parser_status: str
    updated_at: str | None
    content: str


class CollectorClient:
    def __init__(
        self,
        base_url: str,
        token: str = "",
        timeout_sec: int = 30,
        correlation_id: str | None = None,
    ) -> None:
        normalized = base_url.rstrip("/")
        if not normalized.endswith("/api"):
            normalized = f"{normalized}/api"
        self.base_url = normalized
        self.token = token
        self.timeout_sec = timeout_sec
        self.correlation_id = correlation_id
        self.response_request_ids: list[str] = []
        self.session = requests.Session()

    def list_filings(
        self,
        *,
        limit: int = 50,
        status: str = "downloaded",
        since: str | None = None,
        cik: str | None = None,
        parser_status: str | None = "",
    ) -> List[CollectorFiling]:
        params: Dict[str, Any] = {"limit": limit, "status": status}
        if since is not None:
            params["since"] = since
        if cik is not None:
            params["cik"] = cik
        if parser_status is not None:
            params["parserStatus"] = parser_status

        payload = self._get("/filings", params=params)
        items = payload.get("items") or []
        return [
            CollectorFiling(
                accession_no=str(item["accessionNo"]),
                cik=str(item["cik"]),
                form_type=str(item["formType"]),
                filing_date=item.get("filingDate"),
                report_date=item.get("reportDate"),
                primary_doc=item.get("primaryDoc"),
                filing_url=str(item["filingUrl"]),
                file_path=item.get("filePath"),
                checksum=item.get("checksum"),
                parser_status=str(item.get("parserStatus", "")),
                ticker=item.get("ticker"),
            )
            for item in items
        ]

    def list_downloaded_reports(
        self,
        *,
        page: int = 1,
        page_size: int = 5,
        form_type: str | None = None,
        ticker: str | None = None,
        since: str | None = None,
        cik: str | None = None,
        parser_status: str | None = None,
    ) -> dict[str, Any]:
        params: Dict[str, Any] = {"page": page, "pageSize": page_size}
        if form_type:
            params["formType"] = form_type
        if ticker:
            params["ticker"] = ticker
        if since:
            params["since"] = since
        if cik:
            params["cik"] = cik
        if parser_status is not None:
            params["parserStatus"] = parser_status

        payload = self._get("/filings/downloaded-reports", params=params)
        items = payload.get("items") or []
        return {
            "filters": payload.get("filters") or {},
            "pagination": payload.get("pagination") or {},
            "items": [
                DownloadedReport(
                    accession_no=str(item["accessionNo"]),
                    cik=str(item["cik"]),
                    ticker=item.get("ticker"),
                    form_type=str(item["formType"]),
                    filing_date=item.get("filingDate"),
                    report_date=item.get("reportDate"),
                    primary_doc=item.get("primaryDoc"),
                    filing_url=str(item["filingUrl"]),
                    file_path=str(item["filePath"]),
                    checksum=item.get("checksum"),
                    parser_status=str(item.get("parserStatus", "")),
                    updated_at=str(item.get("updatedAt")) if item.get("updatedAt") is not None else None,
                    content=str(item.get("content") or ""),
                )
                for item in items
            ],
        }

    def update_parser_status(self, *, cik: str, accession_no: str, parser_status: str) -> dict[str, Any]:
        body = {"cik": cik, "accessionNo": accession_no, "parserStatus": parser_status}
        return self._post("/filings/parser-status", json=body)

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if self.correlation_id:
            headers["x-request-id"] = self.correlation_id
        return headers

    def _record_response_request_id(self, response: requests.Response) -> None:
        request_id = response.headers.get("x-request-id")
        if request_id:
            self.response_request_ids.append(request_id)

    def _get(self, path: str, *, params: Dict[str, Any]) -> dict[str, Any]:
        response = self.session.get(
            f"{self.base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=self.timeout_sec,
        )
        self._record_response_request_id(response)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, *, json: Dict[str, Any]) -> dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}{path}",
            json=json,
            headers=self._headers(),
            timeout=self.timeout_sec,
        )
        self._record_response_request_id(response)
        response.raise_for_status()
        return response.json()
