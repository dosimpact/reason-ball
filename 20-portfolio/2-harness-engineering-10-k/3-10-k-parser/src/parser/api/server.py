from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

from ..application.jobs import run_collector_parse_job
from ..core.job_store import InMemoryJobStore, utc_now
from .graph_rag_router import router as graph_rag_router
from .langgraph_router import router as langgraph_router
from .langgraph_router import runtime_store
from .models import (
    CollectorParseRequest,
    InitNeo4jRequest,
    ParseFileRequest,
    ParseManifestRequest,
    RunRequest,
)

app = FastAPI(title="10-K Parser API", version="2.0.0")
app.include_router(langgraph_router)
app.include_router(graph_rag_router)
REQUEST_ID_HEADER = "x-request-id"


def _read_positive_int_env(key: str, fallback: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return fallback
    try:
        parsed = int(raw)
    except ValueError:
        return fallback
    return parsed if parsed > 0 else fallback


job_store = InMemoryJobStore(
    max_jobs=_read_positive_int_env("PARSER_JOB_STORE_MAX_JOBS", 1000),
    ttl_seconds=_read_positive_int_env("PARSER_JOB_STORE_TTL_SECONDS", 86400),
)


def format_http_request_log(
    *,
    duration_ms: int,
    method: str,
    path: str,
    request_id: str,
    status: int,
) -> str:
    return json.dumps(
        {
            "event": "parser_http_request",
            "service": "10k-parser",
            "requestId": request_id,
            "method": method,
            "path": path,
            "status": status,
            "durationMs": duration_ms,
        },
        separators=(",", ":"),
    )


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        print(
            format_http_request_log(
                duration_ms=int((time.perf_counter() - started_at) * 1000),
                method=request.method,
                path=request.url.path,
                request_id=request_id,
                status=500,
            ),
            flush=True,
        )
        raise
    response.headers[REQUEST_ID_HEADER] = request_id
    print(
        format_http_request_log(
            duration_ms=int((time.perf_counter() - started_at) * 1000),
            method=request.method,
            path=request.url.path,
            request_id=request_id,
            status=response.status_code,
        ),
        flush=True,
    )
    return response


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _run_cli(args: list[str]) -> tuple[int, str, str]:
    cmd = [sys.executable, "-m", "parser.cli", *args]
    env = os.environ.copy()
    env.setdefault("PYTHONWARNINGS", "ignore")
    cwd = _project_root()
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode, result.stdout, result.stderr


def _build_manifest_with_paths(manifest_path: Path) -> tuple[Path, list[Path]]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    records = payload
    if isinstance(payload, dict):
        for key in ("records", "filings", "items"):
            if isinstance(payload.get(key), list):
                records = payload[key]
                break
    if not isinstance(records, list):
        raise ValueError("Unsupported manifest format. Use JSON list, JSONL, or {records:[...]} format.")

    temp_files: list[Path] = []
    needs_rewrite = False
    normalized: list[dict[str, Any]] = []
    for record in records:
        if not isinstance(record, dict):
            normalized.append(record)
            continue
        item = dict(record)
        if any(item.get(k) for k in ("local_path", "file_path", "path", "report_local_path")):
            normalized.append(item)
            continue
        content = item.get("content")
        if not content:
            normalized.append(item)
            continue
        needs_rewrite = True
        tf = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", encoding="utf-8", delete=False)
        tf.write(str(content))
        tf.flush()
        tf.close()
        path = Path(tf.name)
        temp_files.append(path)
        item["local_path"] = str(path)
        normalized.append(item)

    if not needs_rewrite:
        return manifest_path, temp_files

    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8", delete=False)
    tmp.write(json.dumps(normalized, ensure_ascii=False, indent=2))
    tmp.flush()
    tmp.close()
    manifest_tmp = Path(tmp.name)
    temp_files.append(manifest_tmp)
    return manifest_tmp, temp_files


def _invoke_json_cli(args: list[str]) -> dict[str, Any]:
    code, out, err = _run_cli(args)
    text = (out or "").strip()
    if text:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    if code != 0:
        detail = err.strip() or text or "parser CLI command failed"
        raise HTTPException(status_code=500, detail=detail)
    if not text:
        raise HTTPException(status_code=500, detail="parser CLI did not return JSON output")
    raise HTTPException(status_code=500, detail=f"Invalid JSON output: {text[:500]}")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "10-k-parser",
        "jobStore": job_store.stats(),
        "runtimeStore": runtime_store.stats(),
    }


@app.post("/api/parser/init-neo4j")
def init_neo4j(req: InitNeo4jRequest) -> dict[str, Any]:
    args: list[str] = ["init-neo4j"]
    if req.database:
        args += ["--database", req.database]
    if req.pretty:
        args.append("--pretty")
    return _invoke_json_cli(args)


@app.post("/api/parser/parse-file")
def parse_file(req: ParseFileRequest) -> dict[str, Any]:
    args = ["parse-file", "--path", req.path]
    if req.company_name:
        args += ["--company-name", req.company_name]
    if req.ticker:
        args += ["--ticker", req.ticker]
    if req.report_type:
        args += ["--report-type", req.report_type]
    if req.source_url:
        args += ["--source-url", req.source_url]
    if req.filing_date:
        args += ["--filing-date", req.filing_date]
    if req.accession_no:
        args += ["--accession-no", req.accession_no]
    if req.cik:
        args += ["--cik", req.cik]
    if req.report_id:
        args += ["--report-id", req.report_id]
    if req.metadata_json:
        args += ["--metadata-json", req.metadata_json]
    if req.dry_run:
        args.append("--dry-run")
    if req.include_debug:
        args.append("--include-debug")
    if req.pretty:
        args.append("--pretty")
    return _invoke_json_cli(args)


@app.post("/api/parser/parse-manifest")
def parse_manifest(req: ParseManifestRequest) -> dict[str, Any]:
    temp_files: list[Path] = []
    manifest_path = Path(req.manifest)
    if not manifest_path.is_absolute():
        manifest_path = _project_root() / req.manifest
    try:
        manifest_path_for_cli, temp_files = _build_manifest_with_paths(manifest_path)
        args = ["parse-manifest", "--manifest", str(manifest_path_for_cli)]
        if req.limit is not None:
            args += ["--limit", str(req.limit)]
        if req.dry_run:
            args.append("--dry-run")
        if req.pretty:
            args.append("--pretty")
        return _invoke_json_cli(args)
    finally:
        for tmp_file in temp_files:
            try:
                tmp_file.unlink(missing_ok=True)
            except Exception:
                pass


@app.post("/api/parser/run")
def run_parser(req: RunRequest) -> dict[str, Any]:
    args = [
        "run",
        "--adapter",
        req.adapter,
        "--status",
        req.status,
        "--limit",
        str(req.limit),
        "--timeout-sec",
        str(req.timeout_sec),
    ]
    if req.pretty:
        args.append("--pretty")
    if req.dry_run:
        args.append("--dry-run")
    return _invoke_json_cli(args)


@app.post("/api/parser/collector/parse-jobs")
def create_collector_parse_job(
    req: CollectorParseRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    correlation_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
    job_store.set(
        job_id,
        status="queued",
        createdAt=utc_now(),
        correlationId=correlation_id,
        request=req.model_dump(by_alias=True, exclude_none=True),
    )
    background_tasks.add_task(run_collector_parse_job, job_store, job_id, req, correlation_id)
    return {
        "jobId": job_id,
        "correlationId": correlation_id,
        "status": "queued",
        "requestedAt": utc_now(),
        "request": req.model_dump(by_alias=True, exclude_none=True),
    }


@app.get("/api/parser/collector/parse-jobs/{job_id}")
def get_collector_parse_job(job_id: str) -> dict[str, Any]:
    record = job_store.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"job not found: {job_id}")
    return record


def main() -> None:
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Run parser as API server")
    parser.add_argument("--host", default=os.getenv("APP_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("APP_PORT", "3406")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run("parser.api.server:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
