from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except Exception:  # pragma: no cover
    requests = None  # type: ignore

from ..core.models import FilingDocument

logger = logging.getLogger(__name__)


class CollectorAdapter(ABC):
    @abstractmethod
    def list_documents(self, status: str = "ready_for_parse", limit: int = 100) -> List[FilingDocument]:
        raise NotImplementedError

    @abstractmethod
    def mark_parse_result(
        self, document_id: str, status: str, error_message: Optional[str] = None
    ) -> None:
        raise NotImplementedError


class MockCollectorAdapter(CollectorAdapter):
    def __init__(self, documents_path: Path) -> None:
        self.documents_path = documents_path
        self._status_map: Dict[str, str] = {}

    def list_documents(self, status: str = "ready_for_parse", limit: int = 100) -> List[FilingDocument]:
        records = self._load_raw_records()
        docs: List[FilingDocument] = []
        for record in records:
            record_status = self._status_map.get(record.get("document_id", ""), record.get("status", "ready_for_parse"))
            if status and record_status != status:
                continue
            docs.append(self._to_document(record))
        return docs[:limit]

    def mark_parse_result(
        self, document_id: str, status: str, error_message: Optional[str] = None
    ) -> None:
        self._status_map[document_id] = status
        if error_message:
            logger.warning("mock document_id=%s status=%s error=%s", document_id, status, error_message)
        else:
            logger.info("mock document_id=%s status=%s", document_id, status)

    def _load_raw_records(self) -> List[Dict[str, Any]]:
        if self.documents_path.exists():
            payload = json.loads(self.documents_path.read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return payload
            if isinstance(payload, dict) and "documents" in payload and isinstance(payload["documents"], list):
                return payload["documents"]
            raise ValueError(f"Unsupported mock documents format: {self.documents_path}")

        logger.info("mock documents not found at %s, using built-in sample", self.documents_path)
        return [self._default_sample_record()]

    def _to_document(self, record: Dict[str, Any]) -> FilingDocument:
        return FilingDocument(
            document_id=str(record.get("document_id", "unknown-doc")),
            company_name=str(record.get("company_name", "Unknown Company")),
            ticker=str(record.get("ticker", "UNKNOWN")),
            form_type=str(record.get("form_type", "10-K")),
            source_url=str(record.get("source_url", "")),
            local_path=record.get("local_path"),
            content=record.get("content"),
            cik=record.get("cik"),
            accession_no=record.get("accession_no"),
            filing_date=record.get("filing_date"),
            report_period_start=record.get("report_period_start"),
            report_period_end=record.get("report_period_end"),
            fiscal_year=record.get("fiscal_year"),
            fiscal_quarter=record.get("fiscal_quarter"),
        )

    def _default_sample_record(self) -> Dict[str, Any]:
        return {
            "document_id": "sample-10k-001",
            "company_name": "Sample Technology Inc.",
            "ticker": "SAMP",
            "form_type": "10-K",
            "source_url": "https://www.sec.gov/Archives/edgar/data/0000000000/sample-10k.htm",
            "cik": "0000000000",
            "accession_no": "0000000000-26-000001",
            "filing_date": "2026-02-01",
            "report_period_start": "2025-01-01",
            "report_period_end": "2025-12-31",
            "fiscal_year": "2025",
            "content": (
                "PART I\n"
                "ITEM 1. BUSINESS\n"
                "Sample Technology Inc. develops cloud software products for enterprise customers. "
                "Revenue increased due to subscription growth in North America.\n\n"
                "ITEM 1A. RISK FACTORS\n"
                "The company faces cybersecurity risks and regulatory risks. "
                "A prolonged outage could materially impact revenue and reputation.\n\n"
                "PART II\n"
                "ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS\n"
                "Management believes demand improved in 2025. Revenue was $1,200 million, up 15% year over year.\n\n"
                "ITEM 8. FINANCIAL STATEMENTS AND SUPPLEMENTARY DATA\n"
                "Net income was $220 million in fiscal year 2025. Operating margin was 18%."
            ),
            "status": "ready_for_parse",
        }


class HttpCollectorAdapter(CollectorAdapter):
    def __init__(self, base_url: str, token: str = "", timeout_sec: int = 30) -> None:
        if requests is None:  # pragma: no cover
            raise RuntimeError("requests package is required for HttpCollectorAdapter")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout_sec = timeout_sec
        self.session = requests.Session()

    def list_documents(self, status: str = "ready_for_parse", limit: int = 100) -> List[FilingDocument]:
        resp = self.session.get(
            f"{self.base_url}/list_documents",
            headers=self._headers(),
            params={"status": status, "limit": limit},
            timeout=self.timeout_sec,
        )
        resp.raise_for_status()
        payload = resp.json()
        records = payload["documents"] if isinstance(payload, dict) and "documents" in payload else payload
        return [self._to_document(record) for record in records]

    def mark_parse_result(
        self, document_id: str, status: str, error_message: Optional[str] = None
    ) -> None:
        body = {"document_id": document_id, "status": status, "error_message": error_message}
        resp = self.session.post(
            f"{self.base_url}/mark_parse_result",
            headers=self._headers(),
            json=body,
            timeout=self.timeout_sec,
        )
        resp.raise_for_status()

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _to_document(self, record: Dict[str, Any]) -> FilingDocument:
        return FilingDocument(
            document_id=str(record["document_id"]),
            company_name=str(record["company_name"]),
            ticker=str(record["ticker"]),
            form_type=str(record["form_type"]),
            source_url=str(record["source_url"]),
            local_path=record.get("local_path"),
            content=record.get("content"),
            cik=record.get("cik"),
            accession_no=record.get("accession_no"),
            filing_date=record.get("filing_date"),
            report_period_start=record.get("report_period_start"),
            report_period_end=record.get("report_period_end"),
            fiscal_year=record.get("fiscal_year"),
            fiscal_quarter=record.get("fiscal_quarter"),
        )
