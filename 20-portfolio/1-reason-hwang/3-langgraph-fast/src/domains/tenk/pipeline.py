from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Protocol, cast

from domains.tenk.extractor import LLMExtractor
from domains.tenk.graph_mapper import GraphMapper
from domains.tenk.normalizer import read_document_text
from domains.tenk.segmenter import FilingSegmenter
from infrastructure.neo4j.writer import Neo4jWriter
from settings import AppSettings, get_settings


class GraphWriter(Protocol):
    def write_graph(self, graph_payload: Any, metadata: Mapping[str, Any] | None = None) -> dict[str, int]:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError


def _to_jsonable(value: Any) -> Any:
    obj = cast(Any, value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(item) for item in value]
    if is_dataclass(obj) and not isinstance(obj, type):
        return _to_jsonable(asdict(obj))
    model_dump = getattr(obj, "model_dump", None)
    if callable(model_dump):
        return _to_jsonable(model_dump(exclude_none=True))
    legacy_dict = getattr(obj, "dict", None)
    if callable(legacy_dict):
        return _to_jsonable(legacy_dict(exclude_none=True))
    if hasattr(obj, "__dict__"):
        return _to_jsonable(vars(obj))
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def _to_dict(value: Any) -> dict[str, Any]:
    converted = _to_jsonable(value)
    if isinstance(converted, Mapping):
        return dict(converted)
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def _as_segment_list(segments: Any) -> list[Any]:
    if segments is None:
        return []
    if isinstance(segments, list):
        return segments
    if isinstance(segments, tuple):
        return list(segments)
    if isinstance(segments, Mapping) and "segments" in segments:
        raw = segments["segments"]
        if isinstance(raw, list):
            return raw
        if isinstance(raw, tuple):
            return list(raw)
        return [raw]
    return [segments]


class ParserPipeline:
    def __init__(
        self,
        settings: AppSettings | None = None,
        segmenter: Any | None = None,
        extractor: Any | None = None,
        mapper: Any | None = None,
        writer: GraphWriter | None = None,
        write_to_neo4j: bool = True,
    ) -> None:
        self.settings = settings or get_settings()
        self.segmenter = segmenter or FilingSegmenter(settings=self.settings)
        self.extractor = extractor or LLMExtractor(settings=self.settings)
        self.mapper = mapper or GraphMapper(settings=self.settings)
        self.write_to_neo4j = write_to_neo4j
        self.writer = writer if writer is not None else (Neo4jWriter(settings=self.settings) if write_to_neo4j else None)

    def close(self) -> None:
        if self.writer is not None:
            self.writer.close()

    def parse_file(
        self,
        filing_path: str | Path,
        metadata: Mapping[str, Any] | None = None,
        include_debug: bool = False,
    ) -> dict[str, Any]:
        path = Path(filing_path)
        meta = dict(metadata or {})
        meta.setdefault("report_local_path", str(path))
        meta.setdefault("report_filename", path.name)
        text = read_document_text(path)
        return self.parse_text(text, metadata=meta, file_path=str(path), include_debug=include_debug)

    def parse_text(
        self,
        text: str,
        metadata: Mapping[str, Any] | None = None,
        file_path: str | None = None,
        include_debug: bool = False,
    ) -> dict[str, Any]:
        meta = dict(metadata or {})
        segments = self.segmenter.run(text, metadata=meta)
        extracted = self.extractor.extract(segments, metadata=meta)
        graph_payload = self.mapper.map(extracted, metadata=meta)

        write_result = {"nodes": 0, "relationships": 0}
        if self.write_to_neo4j and self.writer is not None:
            write_result = self.writer.write_graph(graph_payload, metadata=meta)

        graph_dict = _to_dict(graph_payload)
        segment_list = _as_segment_list(segments)
        result = {
            "file_path": file_path,
            "segments": len(segment_list),
            "graph_nodes": len(graph_dict.get("nodes") or []),
            "graph_relationships": len(graph_dict.get("relationships") or graph_dict.get("edges") or []),
            "written_nodes": write_result["nodes"],
            "written_relationships": write_result["relationships"],
        }
        if include_debug:
            result["debug"] = {
                "segments": [_to_dict(segment) for segment in segment_list],
                "extracted": _to_dict(extracted),
                "graph": graph_dict,
            }
        return result

    def parse_manifest_records(
        self,
        records: Iterable[Mapping[str, Any]],
        limit: int | None = None,
        include_debug: bool = False,
    ) -> dict[str, Any]:
        selected = list(records)
        if limit is not None:
            selected = selected[:limit]
        results: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        for idx, record in enumerate(selected):
            try:
                path = _record_path(record)
                metadata = {key: value for key, value in record.items() if key not in {"local_path", "file_path", "path"}}
                parsed = self.parse_file(path, metadata=metadata, include_debug=include_debug)
                parsed["manifest_index"] = idx
                results.append(parsed)
            except Exception as exc:
                errors.append({"manifest_index": idx, "error": str(exc)})
        return {
            "total": len(selected),
            "success": len(results),
            "failed": len(errors),
            "results": results,
            "errors": errors,
        }


def read_manifest(path: str | Path) -> list[dict[str, Any]]:
    manifest_path = Path(path)
    if manifest_path.suffix.lower() == ".jsonl":
        records: list[dict[str, Any]] = []
        for line in manifest_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                records.append(json.loads(line))
        return records
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("records", "filings", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    raise ValueError("Unsupported manifest format. Use JSON list, JSONL, or {records:[...]} format.")


def _record_path(record: Mapping[str, Any]) -> str:
    for key in ("local_path", "file_path", "path", "report_local_path"):
        value = record.get(key)
        if value:
            return str(value)
    raise ValueError("Manifest entry missing file path (local_path/file_path/path/report_local_path)")
