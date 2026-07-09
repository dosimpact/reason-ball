from __future__ import annotations

import os
import re
from collections import defaultdict
from dataclasses import asdict, is_dataclass
from typing import Any, Iterable, Mapping, cast

try:
    from neo4j import GraphDatabase
except ImportError:  # pragma: no cover
    GraphDatabase = None  # type: ignore[assignment]

_LABEL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_REL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_BATCH_SIZE = 250


def _to_dict(value: Any) -> dict[str, Any]:
    obj = cast(Any, value)
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if is_dataclass(obj) and not isinstance(obj, type):
        return asdict(obj)
    model_dump = getattr(obj, "model_dump", None)
    if callable(model_dump):
        return cast(dict[str, Any], model_dump(exclude_none=True))
    legacy_dict = getattr(obj, "dict", None)
    if callable(legacy_dict):
        return cast(dict[str, Any], legacy_dict(exclude_none=True))
    if hasattr(obj, "__dict__"):
        return dict(vars(obj))
    raise TypeError(f"Unsupported payload type: {type(value)!r}")


def _clean_prop_key(key: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", str(key))
    if not cleaned:
        cleaned = "prop"
    if cleaned[0].isdigit():
        cleaned = f"p_{cleaned}"
    return cleaned


def _safe_label(label: str) -> str:
    if not _LABEL_RE.match(label):
        raise ValueError(f"Unsafe Neo4j label: {label!r}")
    return label


def _safe_rel_type(rel_type: str) -> str:
    if not _REL_RE.match(rel_type):
        raise ValueError(f"Unsafe Neo4j relationship type: {rel_type!r}")
    return rel_type


def _normalize_node(node: Any) -> dict[str, Any]:
    data = _to_dict(node)
    labels = data.get("labels") or data.get("label") or ["LexicalNode"]
    if isinstance(labels, str):
        labels = [labels]
    labels = [_safe_label(str(label)) for label in labels]
    raw_key = data.get("key") or {}
    if not raw_key:
        node_id = data.get("id") or data.get("node_id") or data.get("uuid")
        if node_id is None:
            raise ValueError("Node requires either key or id/node_id/uuid")
        raw_key = {"id": node_id}
    key = {_clean_prop_key(k): v for k, v in _to_dict(raw_key).items()}
    props = {_clean_prop_key(k): v for k, v in _to_dict(data.get("properties") or {}).items()}
    props.update(key)
    return {"labels": labels, "key": key, "properties": props}


def _normalize_rel(rel: Any) -> dict[str, Any]:
    data = _to_dict(rel)
    rel_type = _safe_rel_type(str(data.get("type") or data.get("rel_type") or data.get("relationship") or "RELATED_TO"))
    start = data.get("start") or data.get("from") or data.get("source")
    end = data.get("end") or data.get("to") or data.get("target")
    if start is None or end is None:
        raise ValueError("Relationship requires start/end (or from/to, source/target)")
    return {
        "type": rel_type,
        "start": _normalize_node(start),
        "end": _normalize_node(end),
        "properties": {_clean_prop_key(k): v for k, v in _to_dict(data.get("properties") or {}).items()},
    }


def _chunked(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def _node_identity(node: Mapping[str, Any]) -> tuple[Any, ...]:
    return (tuple(node["labels"]), tuple(node["key"].items()))


def _relationship_identity(rel: Mapping[str, Any]) -> tuple[Any, ...]:
    return (
        rel["type"],
        tuple(rel["start"]["labels"]),
        tuple(rel["start"]["key"].items()),
        tuple(rel["end"]["labels"]),
        tuple(rel["end"]["key"].items()),
    )


class Neo4jWriter:
    def __init__(self, settings: Any | None = None, database: str | None = None) -> None:
        if GraphDatabase is None:
            raise RuntimeError("neo4j package is not installed. Add neo4j to project dependencies.")
        uri = _get_setting(settings, "neo4j_uri", "NEO4J_URI", "bolt://127.0.0.1:7687")
        user = _get_setting(settings, "neo4j_user", "NEO4J_USER", "neo4j")
        password = _get_setting(settings, "neo4j_password", "NEO4J_PASSWORD", "test1234")
        self.database = database or _get_setting(settings, "neo4j_database", "NEO4J_DATABASE", "neo4j")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self) -> None:
        self.driver.close()

    def __enter__(self) -> "Neo4jWriter":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def write_graph(self, graph_payload: Any, metadata: Mapping[str, Any] | None = None) -> dict[str, int]:
        payload = _to_dict(graph_payload)
        nodes = payload.get("nodes") or []
        relationships = payload.get("relationships") or payload.get("edges") or []
        if not isinstance(nodes, Iterable) or isinstance(nodes, (str, bytes)):
            raise TypeError("graph_payload.nodes must be iterable")
        if not isinstance(relationships, Iterable) or isinstance(relationships, (str, bytes)):
            raise TypeError("graph_payload.relationships must be iterable")

        metadata_props = {_clean_prop_key(k): v for k, v in (metadata or {}).items()}
        normalized_nodes = []
        normalized_relationships = []
        for raw_node in nodes:
            node = _normalize_node(raw_node)
            node["properties"].update(metadata_props)
            normalized_nodes.append(node)
        for raw_rel in relationships:
            rel = _normalize_rel(raw_rel)
            rel["properties"].update(metadata_props)
            normalized_relationships.append(rel)

        grouped_nodes = _group_node_batches(normalized_nodes)
        grouped_relationships = _group_relationship_batches(normalized_relationships)
        with self.driver.session(database=self.database) as session:
            for (labels, key_fields), rows in grouped_nodes.items():
                for chunk in _chunked(rows, _BATCH_SIZE):
                    session.execute_write(self._upsert_nodes_batch, labels, key_fields, chunk)
            for (rel_type, start_labels, start_key_fields, end_labels, end_key_fields), rows in grouped_relationships.items():
                for chunk in _chunked(rows, _BATCH_SIZE):
                    session.execute_write(
                        self._upsert_relationships_batch,
                        rel_type,
                        start_labels,
                        start_key_fields,
                        end_labels,
                        end_key_fields,
                        chunk,
                    )
        return {"nodes": len(normalized_nodes), "relationships": len(normalized_relationships)}

    @staticmethod
    def _upsert_nodes_batch(tx: Any, labels: tuple[str, ...], key_fields: tuple[str, ...], rows: list[dict[str, Any]]) -> None:
        label_body = ":".join(labels)
        merge_parts = ", ".join(f"`{field}`: row.key['{field}']" for field in key_fields)
        query = f"""
        UNWIND $rows AS row
        MERGE (n:{label_body} {{{merge_parts}}})
        SET n += row.props
        """
        tx.run(query, rows=rows)

    @staticmethod
    def _upsert_relationships_batch(
        tx: Any,
        rel_type: str,
        start_labels: tuple[str, ...],
        start_key_fields: tuple[str, ...],
        end_labels: tuple[str, ...],
        end_key_fields: tuple[str, ...],
        rows: list[dict[str, Any]],
    ) -> None:
        start_label_body = ":".join(start_labels)
        end_label_body = ":".join(end_labels)
        start_merge = ", ".join(f"`{field}`: row.start.key['{field}']" for field in start_key_fields)
        end_merge = ", ".join(f"`{field}`: row.end.key['{field}']" for field in end_key_fields)
        query = f"""
        UNWIND $rows AS row
        MATCH (a:{start_label_body} {{{start_merge}}})
        MATCH (b:{end_label_body} {{{end_merge}}})
        MERGE (a)-[r:{rel_type}]->(b)
        SET r += row.props
        """
        tx.run(query, rows=rows)


def _get_setting(settings: Any, attr: str, env_key: str, default: str) -> str:
    if settings is not None and hasattr(settings, attr):
        value = getattr(settings, attr)
        if value:
            return str(value)
    return os.getenv(env_key, default)


def _group_node_batches(nodes: list[dict[str, Any]]) -> dict[tuple[Any, ...], list[dict[str, Any]]]:
    deduped = {_node_identity(node): node for node in nodes}
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for node in deduped.values():
        grouped[(tuple(node["labels"]), tuple(node["key"].keys()))].append({"key": node["key"], "props": node["properties"]})
    return dict(grouped)


def _group_relationship_batches(relationships: list[dict[str, Any]]) -> dict[tuple[Any, ...], list[dict[str, Any]]]:
    deduped = {_relationship_identity(rel): rel for rel in relationships}
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for rel in deduped.values():
        group_key = (
            rel["type"],
            tuple(rel["start"]["labels"]),
            tuple(rel["start"]["key"].keys()),
            tuple(rel["end"]["labels"]),
            tuple(rel["end"]["key"].keys()),
        )
        grouped[group_key].append(
            {"start": {"key": rel["start"]["key"]}, "end": {"key": rel["end"]["key"]}, "props": rel["properties"]}
        )
    return dict(grouped)
