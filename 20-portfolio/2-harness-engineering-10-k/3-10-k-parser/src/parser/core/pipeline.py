"""Pipeline orchestration for the parser."""

from __future__ import annotations

import importlib
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..storage.neo4j_writer import Neo4jWriter
from .normalizer import html_to_text, normalize_text


def _to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(item) for item in value]
    if is_dataclass(value):
        return _to_jsonable(asdict(value))
    if hasattr(value, "model_dump"):
        return _to_jsonable(value.model_dump(exclude_none=True))
    if hasattr(value, "dict"):
        return _to_jsonable(value.dict(exclude_none=True))
    if hasattr(value, "__dict__"):
        return _to_jsonable(vars(value))
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def _to_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    converted = _to_jsonable(value)
    if isinstance(converted, Mapping):
        return dict(converted)
    raise TypeError(f"Unsupported value type: {type(value)!r}")


def _load_settings() -> Any | None:
    try:
        module = importlib.import_module("parser.core.config")
    except Exception:
        return None

    for name in ("get_settings", "load_settings"):
        fn = getattr(module, name, None)
        if callable(fn):
            try:
                return fn()
            except TypeError:
                return fn

    settings_cls = getattr(module, "Settings", None)
    if settings_cls is not None:
        try:
            return settings_cls()
        except Exception:
            return None
    return None


def _resolve_component(module_name: str, candidates: list[str], settings: Any | None) -> Any | None:
    try:
        module = importlib.import_module(module_name)
    except Exception:
        return None

    for name in candidates:
        target = getattr(module, name, None)
        if target is None:
            continue
        if isinstance(target, type):
            try:
                return target(settings=settings)
            except TypeError:
                try:
                    return target(settings)
                except TypeError:
                    return target()
        if callable(target):
            return target
    return None


def _invoke(obj: Any, method_names: list[str], variants: list[tuple[tuple[Any, ...], dict[str, Any]]]) -> Any:
    call_targets: list[Any] = []
    for name in method_names:
        fn = getattr(obj, name, None)
        if callable(fn):
            call_targets.append(fn)
    if callable(obj):
        call_targets.append(obj)

    last_type_error: TypeError | None = None
    for fn in call_targets:
        for args, kwargs in variants:
            try:
                return fn(*args, **kwargs)
            except TypeError as exc:
                last_type_error = exc
                continue
    if last_type_error is not None:
        raise last_type_error
    raise RuntimeError(f"No callable entrypoint found on component: {obj!r}")


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
        settings: Any | None = None,
        segmenter: Any | None = None,
        extractor: Any | None = None,
        mapper: Any | None = None,
        writer: Neo4jWriter | None = None,
        write_to_neo4j: bool = True,
    ) -> None:
        self.settings = settings or _load_settings()
        self.segmenter = segmenter or _resolve_component(
            "parser.segmenter",
            ["FilingSegmenter", "TenKSegmenter", "ReportSegmenter", "Segmenter", "segment"],
            self.settings,
        )
        self.extractor = extractor or _resolve_component(
            "parser.llm.extractor",
            ["LLMExtractor", "LexicalExtractor", "Extractor", "extract"],
            self.settings,
        )
        self.mapper = mapper or _resolve_component(
            "parser.graph_mapper",
            ["LexicalGraphMapper", "GraphMapper", "Mapper", "map_to_graph", "map_graph"],
            self.settings,
        )
        self.write_to_neo4j = write_to_neo4j
        self.writer = writer or (Neo4jWriter(settings=self.settings) if self.write_to_neo4j else None)

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

        segments = self._segment(path, meta)
        extracted = self._extract(segments, meta)
        graph_payload = self._map(extracted, segments, meta)

        write_result = {"nodes": 0, "relationships": 0}
        if self.write_to_neo4j and self.writer is not None:
            write_result = self.writer.write_graph(graph_payload, metadata=meta)

        graph_dict = _to_dict(graph_payload)
        node_count = len(graph_dict.get("nodes") or [])
        rel_count = len(graph_dict.get("relationships") or graph_dict.get("edges") or [])
        return {
            **(
                {
                    "debug": {
                        "segments": [_to_dict(segment) for segment in _as_segment_list(segments)],
                        "extracted": _to_dict(extracted),
                        "graph": graph_dict,
                    }
                }
                if include_debug
                else {}
            ),
            "file_path": str(path),
            "segments": len(_as_segment_list(segments)),
            "graph_nodes": node_count,
            "graph_relationships": rel_count,
            "written_nodes": write_result["nodes"],
            "written_relationships": write_result["relationships"],
        }

    def _segment(self, filing_path: Path, metadata: Mapping[str, Any]) -> Any:
        raw = filing_path.read_text(encoding="utf-8", errors="ignore")
        if filing_path.suffix.lower() in {".html", ".htm", ".xhtml", ".xml"}:
            text = normalize_text(html_to_text(raw))
        else:
            text = normalize_text(raw)
        if self.segmenter is None:
            return [{"id": "seg-0", "text": text}]
        return _invoke(
            self.segmenter,
            ["run", "segment", "segment_file"],
            [
                ((text,), {"metadata": metadata}),
                (((metadata.get("report_type") or metadata.get("form_type") or "10-K"), text), {}),
                ((text,), {}),
                ((filing_path,), {"metadata": metadata}),
                ((str(filing_path),), {"metadata": metadata}),
            ],
        )

    def _extract(self, segments: Any, metadata: Mapping[str, Any]) -> Any:
        if self.extractor is None:
            return {"segments": _as_segment_list(segments)}
        return _invoke(
            self.extractor,
            ["extract", "run"],
            [
                ((segments,), {"metadata": metadata}),
                ((segments, metadata), {}),
                ((segments,), {}),
            ],
        )

    def _map(self, extracted: Any, segments: Any, metadata: Mapping[str, Any]) -> dict[str, Any]:
        extracted_dict: dict[str, Any]
        try:
            extracted_dict = _to_dict(extracted)
        except TypeError:
            extracted_dict = {}

        if extracted_dict.get("nodes") and (extracted_dict.get("relationships") or extracted_dict.get("edges")):
            if "relationships" not in extracted_dict and "edges" in extracted_dict:
                extracted_dict["relationships"] = extracted_dict["edges"]
            return {
                "nodes": extracted_dict.get("nodes") or [],
                "relationships": extracted_dict.get("relationships") or [],
            }

        if self.mapper is not None:
            mapped = _invoke(
                self.mapper,
                ["map", "to_graph", "run"],
                [
                    ((extracted,), {"metadata": metadata}),
                    ((extracted, metadata), {}),
                    ((extracted,), {}),
                ],
            )
            mapped_dict = _to_dict(mapped)
            if "relationships" not in mapped_dict and "edges" in mapped_dict:
                mapped_dict["relationships"] = mapped_dict["edges"]
            if mapped_dict.get("nodes") is not None and mapped_dict.get("relationships") is not None:
                return {
                    "nodes": mapped_dict.get("nodes") or [],
                    "relationships": mapped_dict.get("relationships") or [],
                }

        return self._fallback_graph(segments, metadata)

    @staticmethod
    def _fallback_graph(segments: Any, metadata: Mapping[str, Any]) -> dict[str, Any]:
        segment_list = _as_segment_list(segments)
        report_id = (
            metadata.get("report_id")
            or metadata.get("accession_no")
            or metadata.get("source_url")
            or metadata.get("report_local_path")
            or "unknown_report"
        )
        report_key = str(report_id)

        report_node = {
            "labels": ["Report"],
            "key": {"id": report_key},
            "properties": {
                "title": metadata.get("report_filename") or report_key,
                "source_url": metadata.get("source_url"),
                "company_name": metadata.get("company_name"),
                "ticker": metadata.get("ticker"),
                "form_type": metadata.get("report_type"),
                "filing_date": metadata.get("filing_date"),
                "accession_no": metadata.get("accession_no"),
                "cik": metadata.get("cik"),
            },
        }

        nodes: list[dict[str, Any]] = [report_node]
        relationships: list[dict[str, Any]] = []
        for idx, segment in enumerate(segment_list):
            segment_dict = _to_dict(segment)
            segment_id = (
                segment_dict.get("section_id")
                or segment_dict.get("id")
                or segment_dict.get("chunk_id")
                or f"seg-{idx}"
            )
            segment_text = segment_dict.get("text") or ""
            segment_node = {
                "labels": ["SectionText"],
                "key": {"id": str(segment_id)},
                "properties": {
                    "text": str(segment_text),
                    "item_code": segment_dict.get("item_code"),
                    "title": segment_dict.get("section_title") or segment_dict.get("title"),
                    "order_index": idx,
                },
            }
            nodes.append(segment_node)
            relationships.append(
                {
                    "type": "CONTAINS_SEGMENT",
                    "start": {"labels": ["Report"], "key": {"id": report_key}},
                    "end": {"labels": ["SectionText"], "key": {"id": str(segment_id)}},
                    "properties": {"order_index": idx},
                }
            )
        return {"nodes": nodes, "relationships": relationships}
