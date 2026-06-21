"""CLI entrypoint for the parser project.

High-level flow:
1) Load inputs (file/manifest/adapter documents)
2) Run ParserPipeline (segment -> extract -> map -> write)
3) Return JSON summary for automation-friendly execution
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from dataclasses import replace
from pathlib import Path
from typing import Any

from .collector.adapters import HttpCollectorAdapter, MockCollectorAdapter
from .core.config import get_settings
from .core.pipeline import ParserPipeline
from .llm.codex_runner import run_codex_chat


def _load_json(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"metadata file not found: {file_path}")
    return json.loads(file_path.read_text(encoding="utf-8"))


def _build_metadata(args: argparse.Namespace) -> dict[str, Any]:
    metadata = _load_json(args.metadata_json)
    fields = {
        "company_name": args.company_name,
        "ticker": args.ticker,
        "report_type": args.report_type,
        "source_url": args.source_url,
        "filing_date": args.filing_date,
        "accession_no": args.accession_no,
        "cik": args.cik,
        "report_id": args.report_id,
    }
    for key, value in fields.items():
        if value is not None:
            metadata[key] = value
    return metadata


def _output(payload: Any, pretty: bool) -> None:
    if pretty:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(payload, ensure_ascii=False))


def _read_manifest(manifest_path: str) -> list[dict[str, Any]]:
    path = Path(manifest_path)
    if not path.exists():
        raise FileNotFoundError(f"manifest not found: {path}")

    if path.suffix.lower() == ".jsonl":
        records: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
        return records

    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("records", "filings", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    raise ValueError("Unsupported manifest format. Use JSON list, JSONL, or {filings:[...]} format.")


def _record_path(record: dict[str, Any]) -> str:
    for key in ("local_path", "file_path", "path", "report_local_path"):
        value = record.get(key)
        if value:
            return str(value)
    raise ValueError("Manifest entry missing file path (local_path/file_path/path/report_local_path)")


def _handle_parse_file(args: argparse.Namespace) -> int:
    # Single-file mode: best for debugging one filing with explicit metadata.
    pipeline = ParserPipeline(write_to_neo4j=not args.dry_run)
    try:
        metadata = _build_metadata(args)
        result = pipeline.parse_file(args.path, metadata=metadata, include_debug=args.include_debug)
    finally:
        pipeline.close()
    _output(result, args.pretty)
    return 0


def _handle_parse_manifest(args: argparse.Namespace) -> int:
    # Batch mode from manifest; keeps going and reports per-record failures.
    records = _read_manifest(args.manifest)
    if args.limit is not None:
        records = records[: args.limit]

    pipeline = ParserPipeline(write_to_neo4j=not args.dry_run)
    results: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    try:
        for idx, record in enumerate(records):
            try:
                path = _record_path(record)
                metadata = {k: v for k, v in record.items() if k not in {"local_path", "file_path", "path"}}
                result = pipeline.parse_file(path, metadata=metadata)
                result["manifest_index"] = idx
                results.append(result)
            except Exception as exc:  # pragma: no cover
                errors.append({"manifest_index": idx, "error": str(exc)})
    finally:
        pipeline.close()

    payload = {
        "total": len(records),
        "success": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }
    _output(payload, args.pretty)
    return 1 if errors else 0


def _init_neo4j_constraints(database: str | None = None) -> None:
    from .core.config import get_settings
    from .neo4j_writer import Neo4jWriter

    constraint_queries = [
        "CREATE CONSTRAINT report_id_unique IF NOT EXISTS FOR (n:Report) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT section_text_id_unique IF NOT EXISTS FOR (n:SectionText) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT company_id_unique IF NOT EXISTS FOR (n:Company) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT filing_id_unique IF NOT EXISTS FOR (n:Filing) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT item_id_unique IF NOT EXISTS FOR (n:Item) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT statement_id_unique IF NOT EXISTS FOR (n:Statement) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT fact_id_unique IF NOT EXISTS FOR (n:Fact) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT metric_id_unique IF NOT EXISTS FOR (n:Metric) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT risk_id_unique IF NOT EXISTS FOR (n:Risk) REQUIRE n.id IS UNIQUE",
    ]

    with Neo4jWriter(settings=get_settings(), database=database) as writer:
        with writer.driver.session(database=writer.database) as session:
            for query in constraint_queries:
                session.run(query)


def _handle_init_neo4j(args: argparse.Namespace) -> int:
    try:
        _init_neo4j_constraints(database=args.database)
    except Exception as exc:
        _output({"status": "error", "action": "init-neo4j", "error": str(exc)}, args.pretty)
        return 1
    _output({"status": "ok", "action": "init-neo4j"}, args.pretty)
    return 0


def _as_metadata(document: Any) -> dict[str, Any]:
    return {
        "report_id": getattr(document, "document_id", None),
        "company_name": getattr(document, "company_name", None),
        "ticker": getattr(document, "ticker", None),
        "report_type": getattr(document, "form_type", None),
        "source_url": getattr(document, "source_url", None),
        "filing_date": getattr(document, "filing_date", None),
        "accession_no": getattr(document, "accession_no", None),
        "cik": getattr(document, "cik", None),
        "report_period_start": getattr(document, "report_period_start", None),
        "report_period_end": getattr(document, "report_period_end", None),
        "fiscal_year": getattr(document, "fiscal_year", None),
        "fiscal_quarter": getattr(document, "fiscal_quarter", None),
    }


def _build_adapter(adapter_name: str, timeout: int) -> Any:
    if adapter_name == "mock":
        mock_path = Path(os.getenv("MOCK_DOCUMENTS_PATH", "./examples/mock_documents.json"))
        return MockCollectorAdapter(documents_path=mock_path)
    if adapter_name == "http":
        base_url = os.getenv("COLLECTOR_API_BASE_URL", "http://localhost:8080")
        token = os.getenv("COLLECTOR_API_TOKEN", "")
        return HttpCollectorAdapter(base_url=base_url, token=token, timeout_sec=timeout)
    raise ValueError(f"Unsupported adapter: {adapter_name}")


def _handle_run(args: argparse.Namespace) -> int:
    # Adapter mode:
    # - fetch documents from mock/http source
    # - parse one by one
    # - report parse status back to adapter
    adapter = _build_adapter(args.adapter, timeout=args.timeout_sec)
    documents = adapter.list_documents(status=args.status, limit=args.limit)
    pipeline = ParserPipeline(write_to_neo4j=not args.dry_run)

    successes: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    temp_files: list[Path] = []
    try:
        for document in documents:
            path: str | None = getattr(document, "local_path", None)
            if not path:
                content = getattr(document, "content", None)
                if not content:
                    msg = "document has neither local_path nor content"
                    adapter.mark_parse_result(document.document_id, "failed", msg)
                    failures.append({"document_id": document.document_id, "error": msg})
                    continue
                temp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", encoding="utf-8", delete=False)
                temp.write(content)
                temp.flush()
                temp.close()
                path = temp.name
                temp_files.append(Path(path))

            adapter.mark_parse_result(document.document_id, "parsing")
            metadata = _as_metadata(document)
            try:
                result = pipeline.parse_file(path, metadata=metadata)
                result["document_id"] = document.document_id
                successes.append(result)
                adapter.mark_parse_result(document.document_id, "parsed")
            except Exception as exc:  # pragma: no cover
                adapter.mark_parse_result(document.document_id, "failed", str(exc))
                failures.append({"document_id": document.document_id, "error": str(exc)})
    finally:
        pipeline.close()
        for temp_file in temp_files:
            try:
                temp_file.unlink(missing_ok=True)
            except Exception:
                pass

    payload = {
        "adapter": args.adapter,
        "status": args.status,
        "total": len(documents),
        "success": len(successes),
        "failed": len(failures),
        "results": successes,
        "errors": failures,
    }
    _output(payload, args.pretty)
    return 1 if failures else 0


def _handle_chat(args: argparse.Namespace) -> int:
    settings = get_settings()
    overrides: dict[str, Any] = {}
    if args.model:
        overrides["llm_model"] = args.model
    if args.profile is not None:
        overrides["codex_profile"] = args.profile
    if args.sandbox is not None:
        overrides["codex_sandbox"] = args.sandbox
    if overrides:
        settings = replace(settings, **overrides)

    cwd = Path(args.cd).resolve() if args.cd else Path(__file__).resolve().parents[2]
    initial_prompt = " ".join(args.prompt).strip() if args.prompt else None
    return run_codex_chat(settings, initial_prompt=initial_prompt, cwd=cwd)


def build_parser() -> argparse.ArgumentParser:
    # One CLI binary with subcommands for setup, single/batch parse, and adapter-driven runs.
    parser = argparse.ArgumentParser(
        prog="10k-parser",
        description="Parse SEC filings into 10-K specialized lexical graph and write to Neo4j.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    parse_file = sub.add_parser("parse-file", help="Parse a single filing file.")
    parse_file.add_argument("--path", required=True, help="Local path of filing text/html file")
    parse_file.add_argument("--company-name")
    parse_file.add_argument("--ticker")
    parse_file.add_argument("--report-type")
    parse_file.add_argument("--source-url")
    parse_file.add_argument("--filing-date")
    parse_file.add_argument("--accession-no")
    parse_file.add_argument("--cik")
    parse_file.add_argument("--report-id")
    parse_file.add_argument("--metadata-json", help="Additional metadata JSON file path")
    parse_file.add_argument("--dry-run", action="store_true", help="Skip Neo4j writes")
    parse_file.add_argument(
        "--include-debug",
        action="store_true",
        help="Include segments, extraction output, and graph payload in JSON response",
    )
    parse_file.add_argument("--pretty", action="store_true", help="Pretty JSON output")
    parse_file.set_defaults(func=_handle_parse_file)

    parse_manifest = sub.add_parser("parse-manifest", help="Parse multiple filings from manifest JSON/JSONL.")
    parse_manifest.add_argument("--manifest", required=True, help="Manifest JSON/JSONL path")
    parse_manifest.add_argument("--limit", type=int, default=None, help="Optional max filings to parse")
    parse_manifest.add_argument("--dry-run", action="store_true", help="Skip Neo4j writes")
    parse_manifest.add_argument("--pretty", action="store_true", help="Pretty JSON output")
    parse_manifest.set_defaults(func=_handle_parse_manifest)

    init_neo4j = sub.add_parser("init-neo4j", help="Create Neo4j constraints used by parser graph writes.")
    init_neo4j.add_argument("--database", help="Neo4j database name override", default=None)
    init_neo4j.add_argument("--pretty", action="store_true", help="Pretty JSON output")
    init_neo4j.set_defaults(func=_handle_init_neo4j)

    run = sub.add_parser("run", help="Run parser pipeline with collector adapter (mock/http).")
    run.add_argument("--adapter", choices=["mock", "http"], default="mock")
    run.add_argument("--status", default="ready_for_parse", help="Collector document status filter")
    run.add_argument("--limit", type=int, default=10, help="Max number of documents to parse")
    run.add_argument("--timeout-sec", type=int, default=30, help="HTTP adapter timeout in seconds")
    run.add_argument("--dry-run", action="store_true", help="Skip Neo4j writes")
    run.add_argument("--pretty", action="store_true", help="Pretty JSON output")
    run.set_defaults(func=_handle_run)

    chat = sub.add_parser("chat", help="Launch a simple local Codex CLI chatbot.")
    chat.add_argument("prompt", nargs="*", help="Optional initial prompt passed to Codex")
    chat.add_argument("--model", help="Override Codex model")
    chat.add_argument("--profile", help="Override Codex profile", default=None)
    chat.add_argument("--sandbox", choices=["read-only", "workspace-write", "danger-full-access"], default=None)
    chat.add_argument("--cd", help="Working directory for the Codex session", default=None)
    chat.set_defaults(func=_handle_chat)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
