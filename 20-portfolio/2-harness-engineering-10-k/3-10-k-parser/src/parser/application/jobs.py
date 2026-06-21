from __future__ import annotations

import tempfile
import json
from pathlib import Path
from typing import Any

from ..api.models import CollectorParseRequest
from ..collector.client import CollectorClient, DownloadedReport
from ..core.config import get_settings
from ..core.job_store import InMemoryJobStore, utc_now
from ..core.pipeline import ParserPipeline


def collector_client(timeout_sec: int = 30, correlation_id: str | None = None) -> CollectorClient:
    settings = get_settings()
    return CollectorClient(
        base_url=settings.collector_api_base_url,
        token=settings.collector_api_token,
        timeout_sec=timeout_sec,
        correlation_id=correlation_id,
    )


def format_collector_parse_job_log(
    *,
    correlation_id: str,
    event_status: str,
    job_id: str,
    **extra: Any,
) -> str:
    return json.dumps(
        {
            "event": "parser_collector_parse_job",
            "jobId": job_id,
            "correlationId": correlation_id,
            "status": event_status,
            **extra,
        },
        separators=(",", ":"),
    )


def log_collector_parse_job(
    *,
    correlation_id: str,
    event_status: str,
    job_id: str,
    **extra: Any,
) -> None:
    print(
        format_collector_parse_job_log(
            correlation_id=correlation_id,
            event_status=event_status,
            job_id=job_id,
            **extra,
        ),
        flush=True,
    )


def collector_request_trace(client: CollectorClient, correlation_id: str) -> dict[str, Any]:
    request_ids = list(client.response_request_ids)
    return {
        "collectorRequestIds": request_ids,
        "collectorRequestIdMatched": bool(request_ids)
        and all(request_id == correlation_id for request_id in request_ids),
    }


def report_temp_suffix(report: DownloadedReport) -> str:
    source = report.primary_doc or report.file_path or ""
    suffix = Path(source).suffix.lower()
    return suffix if suffix else ".txt"


def parse_downloaded_report(
    report: DownloadedReport,
    *,
    dry_run: bool,
    include_debug: bool,
) -> dict[str, Any]:
    pipeline = ParserPipeline(write_to_neo4j=not dry_run)
    temp_path: Path | None = None
    try:
        temp = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=report_temp_suffix(report),
            encoding="utf-8",
            delete=False,
        )
        temp.write(report.content)
        temp.flush()
        temp.close()
        temp_path = Path(temp.name)

        metadata = {
            "report_id": f"{report.cik}:{report.accession_no}",
            "company_name": report.ticker or report.cik,
            "ticker": report.ticker,
            "report_type": report.form_type,
            "source_url": report.filing_url,
            "filing_date": report.filing_date,
            "accession_no": report.accession_no,
            "cik": report.cik,
            "report_local_path": report.file_path,
        }
        result = pipeline.parse_file(temp_path, metadata=metadata, include_debug=include_debug)
        result["collector"] = {
            "accessionNo": report.accession_no,
            "cik": report.cik,
            "ticker": report.ticker,
            "formType": report.form_type,
            "filePath": report.file_path,
        }
        return result
    finally:
        pipeline.close()
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass


def run_collector_parse_job(
    job_store: InMemoryJobStore,
    job_id: str,
    request: CollectorParseRequest,
    correlation_id: str,
) -> None:
    job_store.set(job_id, status="running", startedAt=utc_now(), correlationId=correlation_id)
    log_collector_parse_job(
        correlation_id=correlation_id,
        event_status="running",
        job_id=job_id,
    )
    client = collector_client(correlation_id=correlation_id)

    page = request.page
    page_size = request.page_size
    parser_status = request.parser_status
    preflight_limit = min(max(page_size, 1), 50)

    try:
        preflight_candidates = client.list_filings(
            limit=preflight_limit,
            status="downloaded",
            since=request.since,
            cik=request.cik,
            parser_status=parser_status,
        )
        report_page = client.list_downloaded_reports(
            page=page,
            page_size=page_size,
            form_type=request.form_type,
            ticker=request.ticker,
            since=request.since,
            cik=request.cik,
            parser_status=parser_status,
        )
        reports: list[DownloadedReport] = report_page["items"]

        job_store.set(
            job_id,
            **collector_request_trace(client, correlation_id),
            collectorFilters={
                "page": page,
                "pageSize": page_size,
                "formType": request.form_type,
                "ticker": request.ticker,
                "since": request.since,
                "cik": request.cik,
                "parserStatus": parser_status,
            },
            collectorPreflightSampleCount=len(preflight_candidates),
            collectorPagination=report_page["pagination"],
            queued=len(reports),
        )
        log_collector_parse_job(
            correlation_id=correlation_id,
            event_status="queued_reports",
            job_id=job_id,
            queued=len(reports),
        )

        results: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        for report in reports:
            try:
                parsed = parse_downloaded_report(
                    report,
                    dry_run=request.dry_run,
                    include_debug=request.include_debug,
                )
                if not request.dry_run:
                    client.update_parser_status(
                        cik=report.cik,
                        accession_no=report.accession_no,
                        parser_status=request.parser_status_on_success,
                    )
                results.append(parsed)
            except Exception as exc:
                if not request.dry_run:
                    try:
                        client.update_parser_status(
                            cik=report.cik,
                            accession_no=report.accession_no,
                            parser_status=request.parser_status_on_failure,
                        )
                    except Exception:
                        pass
                errors.append(
                    {
                        "accessionNo": report.accession_no,
                        "cik": report.cik,
                        "ticker": report.ticker,
                        "error": str(exc),
                    }
                )

        job_store.set(
            job_id,
            status="completed" if not errors else "completed_with_errors",
            completedAt=utc_now(),
            correlationId=correlation_id,
            **collector_request_trace(client, correlation_id),
            success=len(results),
            failed=len(errors),
            results=results,
            errors=errors,
        )
        log_collector_parse_job(
            correlation_id=correlation_id,
            event_status="completed" if not errors else "completed_with_errors",
            job_id=job_id,
            success=len(results),
            failed=len(errors),
        )
    except Exception as exc:
        job_store.set(
            job_id,
            status="failed",
            completedAt=utc_now(),
            correlationId=correlation_id,
            **collector_request_trace(client, correlation_id),
            error=str(exc),
        )
        log_collector_parse_job(
            correlation_id=correlation_id,
            event_status="failed",
            job_id=job_id,
            hasError=True,
        )
