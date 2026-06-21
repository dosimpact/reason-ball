"""Neo4j persistence layer for graph payloads.

Responsibilities:
- normalize heterogeneous node/edge payloads
- enforce safe labels/relationship types
- upsert nodes and relationships with metadata enrichment
"""

from __future__ import annotations

import os
import re
from dataclasses import asdict, is_dataclass
from collections import defaultdict
from typing import Any, Iterable, Mapping

try:
    from neo4j import GraphDatabase
except ImportError:  # pragma: no cover
    GraphDatabase = None  # type: ignore


_LABEL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_REL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_BATCH_SIZE = 250


def _to_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if is_dataclass(value):
        return asdict(value)
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)  # pydantic v2
    if hasattr(value, "dict"):
        return value.dict(exclude_none=True)  # pydantic v1
    if hasattr(value, "__dict__"):
        return dict(vars(value))
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
    raw_key = _to_dict(raw_key)
    key = {_clean_prop_key(k): v for k, v in raw_key.items()}

    raw_props = data.get("properties") or {}
    raw_props = _to_dict(raw_props)
    props = {_clean_prop_key(k): v for k, v in raw_props.items()}
    props.update(key)
    return {"labels": labels, "key": key, "properties": props}


def _normalize_rel(rel: Any) -> dict[str, Any]:
    data = _to_dict(rel)
    rel_type = _safe_rel_type(
        str(data.get("type") or data.get("rel_type") or data.get("relationship") or "RELATED_TO")
    )

    start = data.get("start") or data.get("from") or data.get("source")
    end = data.get("end") or data.get("to") or data.get("target")
    if start is None or end is None:
        raise ValueError("Relationship requires start/end (or from/to, source/target)")

    start_node = _normalize_node(start)
    end_node = _normalize_node(end)

    raw_props = data.get("properties") or {}
    raw_props = _to_dict(raw_props)
    props = {_clean_prop_key(k): v for k, v in raw_props.items()}
    return {
        "type": rel_type,
        "start": start_node,
        "end": end_node,
        "properties": props,
    }


def _chunked(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def _node_identity(node: Mapping[str, Any]) -> tuple[Any, ...]:
    key_items = tuple(node["key"].items())
    return (tuple(node["labels"]), key_items)


def _relationship_identity(rel: Mapping[str, Any]) -> tuple[Any, ...]:
    start_key_items = tuple(rel["start"]["key"].items())
    end_key_items = tuple(rel["end"]["key"].items())
    return (
        rel["type"],
        tuple(rel["start"]["labels"]),
        start_key_items,
        tuple(rel["end"]["labels"]),
        end_key_items,
    )


def _group_node_batches(nodes: list[dict[str, Any]]) -> dict[tuple[Any, ...], list[dict[str, Any]]]:
    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for node in nodes:
        deduped[_node_identity(node)] = node

    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for node in deduped.values():
        group_key = (tuple(node["labels"]), tuple(node["key"].keys()))
        grouped[group_key].append({"key": node["key"], "props": node["properties"]})

    return dict(grouped)


def _group_relationship_batches(
    relationships: list[dict[str, Any]],
) -> dict[tuple[Any, ...], list[dict[str, Any]]]:
    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for rel in relationships:
        deduped[_relationship_identity(rel)] = rel

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
            {
                "start": {"key": rel["start"]["key"]},
                "end": {"key": rel["end"]["key"]},
                "props": rel["properties"],
            }
        )

    return dict(grouped)


class Neo4jWriter:
    def __init__(self, settings: Any | None = None, database: str | None = None):
        if GraphDatabase is None:
            raise RuntimeError(
                "neo4j package is not installed. Add `neo4j` to requirements and install dependencies."
            )
        uri = self._get_setting(settings, "neo4j_uri", "NEO4J_URI", "bolt://127.0.0.1:7687")
        user = self._get_setting(settings, "neo4j_user", "NEO4J_USER", "neo4j")
        password = self._get_setting(settings, "neo4j_password", "NEO4J_PASSWORD", "neo4jpassword")
        self.database = database or self._get_setting(settings, "neo4j_database", "NEO4J_DATABASE", "neo4j")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    @staticmethod
    def _get_setting(settings: Any, attr: str, env_key: str, default: str) -> str:
        if settings is not None:
            if hasattr(settings, attr):
                value = getattr(settings, attr)
                if value:
                    return str(value)
            nested = getattr(settings, "neo4j", None)
            if nested is not None and hasattr(nested, attr.removeprefix("neo4j_")):
                value = getattr(nested, attr.removeprefix("neo4j_"))
                if value:
                    return str(value)
        return os.getenv(env_key, default)

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
        normalized_nodes: list[dict[str, Any]] = []
        normalized_relationships: list[dict[str, Any]] = []

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
            for (labels, key_fields), grouped_rows in grouped_nodes.items():
                for rows in _chunked(grouped_rows, _BATCH_SIZE):
                    session.execute_write(self._upsert_nodes_batch, labels, key_fields, rows)

            for (
                rel_type,
                start_labels,
                start_key_fields,
                end_labels,
                end_key_fields,
            ), grouped_rows in grouped_relationships.items():
                for rows in _chunked(grouped_rows, _BATCH_SIZE):
                    session.execute_write(
                        self._upsert_relationships_batch,
                        rel_type,
                        start_labels,
                        start_key_fields,
                        end_labels,
                        end_key_fields,
                        rows,
                    )

        return {"nodes": len(normalized_nodes), "relationships": len(normalized_relationships)}

    @staticmethod
    def _upsert_node(tx: Any, node: dict[str, Any]) -> None:
        labels = ":".join(node["labels"])
        key_items = list(node["key"].items())
        merge_parts = []
        params: dict[str, Any] = {"props": node["properties"]}
        for idx, (k, v) in enumerate(key_items):
            param_name = f"k{idx}"
            merge_parts.append(f"`{k}`: ${param_name}")
            params[param_name] = v
        merge_body = ", ".join(merge_parts)
        query = f"MERGE (n:{labels} {{{merge_body}}}) SET n += $props"
        tx.run(query, **params)

    @staticmethod
    def _upsert_relationship(tx: Any, rel: dict[str, Any]) -> None:
        start_labels = ":".join(rel["start"]["labels"])
        end_labels = ":".join(rel["end"]["labels"])
        rel_type = rel["type"]

        s_parts = []
        e_parts = []
        params: dict[str, Any] = {"props": rel["properties"]}
        for idx, (k, v) in enumerate(rel["start"]["key"].items()):
            pname = f"s{idx}"
            s_parts.append(f"`{k}`: ${pname}")
            params[pname] = v
        for idx, (k, v) in enumerate(rel["end"]["key"].items()):
            pname = f"e{idx}"
            e_parts.append(f"`{k}`: ${pname}")
            params[pname] = v

        s_body = ", ".join(s_parts)
        e_body = ", ".join(e_parts)

        query = (
            f"MATCH (a:{start_labels} {{{s_body}}}) "
            f"MATCH (b:{end_labels} {{{e_body}}}) "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            f"SET r += $props"
        )
        tx.run(query, **params)

    @staticmethod
    def _upsert_nodes_batch(
        tx: Any,
        labels: tuple[str, ...],
        key_fields: tuple[str, ...],
        rows: list[dict[str, Any]],
    ) -> None:
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
