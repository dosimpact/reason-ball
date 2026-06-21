"""Graph mapping for parser extraction outputs."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, is_dataclass
from typing import Any

from parser.core.models import FilingDocument


def stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def company_key(document: FilingDocument) -> str:
    if document.cik:
        return f"cik:{document.cik}"
    if document.ticker:
        return f"ticker:{document.ticker.upper()}"
    return f"name:{normalize_key(document.company_name)}"


def filing_key(document: FilingDocument) -> str:
    if document.accession_no:
        return f"acc:{document.accession_no}"
    if document.source_url:
        return f"url:{document.source_url}"
    return f"doc:{document.document_id}"


def item_key(filing_key_value: str, item_code: str) -> str:
    return f"{filing_key_value}:item:{item_code.upper()}"


def section_key(item_key_value: str, section_id: str) -> str:
    return f"{item_key_value}:section:{section_id}"


def statement_key(item_key_value: str, text: str) -> str:
    return stable_hash(f"{item_key_value}|{text.strip()}")


def fact_key(subject: str, predicate: str, object_or_complement: str) -> str:
    return stable_hash(
        f"{normalize_key(subject)}|{normalize_key(predicate)}|{normalize_key(object_or_complement)}"
    )


def entity_key(value: str) -> str:
    return normalize_key(value)


def metric_key(item_key_value: str, metric_name: str, value: str, period: str) -> str:
    return stable_hash(f"{item_key_value}|{normalize_key(metric_name)}|{value}|{period}")


def risk_key(item_key_value: str, risk_type: str, risk_text: str) -> str:
    return stable_hash(f"{item_key_value}|{normalize_key(risk_type)}|{normalize_key(risk_text)}")


def _to_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if is_dataclass(value):
        return asdict(value)
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    if hasattr(value, "dict"):
        return value.dict(exclude_none=True)
    return dict(vars(value))


def _statement_contains(statement_text: str, probe: str) -> bool:
    normalized_statement = normalize_key(statement_text)
    normalized_probe = normalize_key(probe)
    return bool(normalized_probe) and normalized_probe in normalized_statement


def _statement_supports_fact(statement_text: str, fact: dict[str, Any]) -> bool:
    subject = str(fact.get("subject") or "")
    object_or_complement = str(fact.get("object_or_complement") or "")
    predicate = str(fact.get("predicate") or "")

    if subject and object_or_complement:
        return _statement_contains(statement_text, subject) and _statement_contains(statement_text, object_or_complement)

    if subject and predicate:
        return _statement_contains(statement_text, subject) and _statement_contains(statement_text, predicate)

    return False


def _dedupe_graph_payload(
    nodes: list[dict[str, Any]], relationships: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    deduped_nodes: dict[tuple[Any, ...], dict[str, Any]] = {}
    for node in nodes:
        identity = (
            tuple(node.get("labels") or []),
            tuple(sorted((node.get("key") or {}).items())),
        )
        deduped_nodes[identity] = node

    deduped_relationships: dict[tuple[Any, ...], dict[str, Any]] = {}
    for rel in relationships:
        identity = (
            rel.get("type"),
            tuple(rel.get("start", {}).get("labels") or []),
            tuple(sorted((rel.get("start", {}).get("key") or {}).items())),
            tuple(rel.get("end", {}).get("labels") or []),
            tuple(sorted((rel.get("end", {}).get("key") or {}).items())),
        )
        deduped_relationships[identity] = rel

    return list(deduped_nodes.values()), list(deduped_relationships.values())


class GraphMapper:
    """Project parsed filing sections into Neo4j-friendly nodes/edges."""

    def __init__(self, settings: Any | None = None) -> None:
        self.settings = settings

    def map(self, extracted: Any, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = _to_dict(extracted)
        meta = metadata or {}
        document = payload.get("document")
        if document is None:
            document = FilingDocument(
                document_id=str(meta.get("report_id") or meta.get("accession_no") or meta.get("source_url") or "unknown"),
                company_name=str(meta.get("company_name") or "Unknown Company"),
                ticker=str(meta.get("ticker") or ""),
                form_type=str(meta.get("report_type") or meta.get("form_type") or "10-K"),
                source_url=str(meta.get("source_url") or ""),
                cik=meta.get("cik"),
                accession_no=meta.get("accession_no"),
                filing_date=meta.get("filing_date"),
                report_period_start=meta.get("report_period_start"),
                report_period_end=meta.get("report_period_end"),
                fiscal_year=meta.get("fiscal_year"),
                fiscal_quarter=meta.get("fiscal_quarter"),
            )
        elif not isinstance(document, FilingDocument):
            document = FilingDocument(**_to_dict(document))

        company_id = company_key(document)
        filing_id = filing_key(document)

        nodes: list[dict[str, Any]] = [
            {
                "labels": ["Company"],
                "key": {"id": company_id},
                "properties": {
                    "name": document.company_name,
                    "ticker": document.ticker,
                    "cik": document.cik,
                },
            },
            {
                "labels": ["Filing"],
                "key": {"id": filing_id},
                "properties": {
                    "document_id": document.document_id,
                    "company_name": document.company_name,
                    "ticker": document.ticker,
                    "cik": document.cik,
                    "form_type": document.form_type,
                    "source_url": document.source_url,
                    "filing_date": document.filing_date,
                    "accession_no": document.accession_no,
                    "report_period_start": document.report_period_start,
                    "report_period_end": document.report_period_end,
                    "fiscal_year": document.fiscal_year,
                    "fiscal_quarter": document.fiscal_quarter,
                },
            },
        ]
        relationships: list[dict[str, Any]] = [
            {
                "type": "FILED",
                "start": {"labels": ["Company"], "key": {"id": company_id}},
                "end": {"labels": ["Filing"], "key": {"id": filing_id}},
                "properties": {},
            }
        ]

        for section_row in payload.get("sections", []):
            row = _to_dict(section_row)
            section = row.get("section")
            result = row.get("result")
            section_dict = _to_dict(section)
            result_dict = _to_dict(result)

            item_id = item_key(filing_id, str(section_dict.get("item_code") or "UNKNOWN"))
            sec_id = section_key(item_id, str(section_dict.get("section_id") or "unknown"))

            nodes.extend(
                [
                    {
                        "labels": ["Item"],
                        "key": {"id": item_id},
                        "properties": {
                            "item_code": section_dict.get("item_code"),
                            "part_code": section_dict.get("part_code"),
                            "filing_id": filing_id,
                        },
                    },
                    {
                        "labels": ["SectionText"],
                        "key": {"id": sec_id},
                        "properties": {
                            "section_id": section_dict.get("section_id"),
                            "item_code": section_dict.get("item_code"),
                            "part_code": section_dict.get("part_code"),
                            "title": section_dict.get("section_title"),
                            "text": section_dict.get("text"),
                            "filing_id": filing_id,
                        },
                    },
                ]
            )
            relationships.extend(
                [
                    {
                        "type": "HAS_ITEM",
                        "start": {"labels": ["Filing"], "key": {"id": filing_id}},
                        "end": {"labels": ["Item"], "key": {"id": item_id}},
                        "properties": {},
                    },
                    {
                        "type": "HAS_SECTION",
                        "start": {"labels": ["Item"], "key": {"id": item_id}},
                        "end": {"labels": ["SectionText"], "key": {"id": sec_id}},
                        "properties": {},
                    },
                ]
            )

            statement_entries: list[tuple[str, dict[str, Any]]] = []
            for statement in result_dict.get("statements", []):
                statement_dict = _to_dict(statement)
                statement_id = statement_key(item_id, str(statement_dict.get("text") or ""))
                statement_entries.append((statement_id, statement_dict))
                nodes.append(
                    {
                        "labels": ["Statement"],
                        "key": {"id": statement_id},
                        "properties": {
                            "text": statement_dict.get("text"),
                            "confidence": statement_dict.get("confidence"),
                            "item_id": item_id,
                            "filing_id": filing_id,
                        },
                    }
                )
                relationships.append(
                    {
                        "type": "HAS_STATEMENT",
                        "start": {"labels": ["SectionText"], "key": {"id": sec_id}},
                        "end": {"labels": ["Statement"], "key": {"id": statement_id}},
                        "properties": {},
                    }
                )

            for fact in result_dict.get("facts", []):
                fact_dict = _to_dict(fact)
                fact_id = fact_key(
                    str(fact_dict.get("subject") or ""),
                    str(fact_dict.get("predicate") or ""),
                    str(fact_dict.get("object_or_complement") or ""),
                )
                nodes.append(
                    {
                        "labels": ["Fact"],
                        "key": {"id": fact_id},
                        "properties": {
                            "subject": fact_dict.get("subject"),
                            "predicate": fact_dict.get("predicate"),
                            "object_or_complement": fact_dict.get("object_or_complement"),
                            "fact_type": fact_dict.get("fact_type"),
                            "confidence": fact_dict.get("confidence"),
                        },
                    }
                )
                for statement_id, statement_dict in statement_entries:
                    if not _statement_supports_fact(str(statement_dict.get("text") or ""), fact_dict):
                        continue
                    relationships.append(
                        {
                            "type": "SUPPORTED_BY",
                            "start": {"labels": ["Statement"], "key": {"id": statement_id}},
                            "end": {"labels": ["Fact"], "key": {"id": fact_id}},
                            "properties": {},
                        }
                    )

            for entity in result_dict.get("entities", []):
                entity_dict = _to_dict(entity)
                entity_id = entity_key(str(entity_dict.get("value") or ""))
                nodes.append(
                    {
                        "labels": ["Entity"],
                        "key": {"id": entity_id},
                        "properties": {
                            "value": entity_dict.get("value"),
                            "classification": entity_dict.get("classification"),
                        },
                    }
                )
                entity_value = str(entity_dict.get("value") or "")
                for statement_id, statement_dict in statement_entries:
                    if not _statement_contains(str(statement_dict.get("text") or ""), entity_value):
                        continue
                    relationships.append(
                        {
                            "type": "MENTIONS",
                            "start": {"labels": ["Statement"], "key": {"id": statement_id}},
                            "end": {"labels": ["Entity"], "key": {"id": entity_id}},
                            "properties": {},
                        }
                    )

            for metric in result_dict.get("metrics", []):
                metric_dict = _to_dict(metric)
                metric_id = metric_key(
                    item_id,
                    str(metric_dict.get("metric_name") or ""),
                    str(metric_dict.get("value") or ""),
                    str(metric_dict.get("period") or ""),
                )
                nodes.append(
                    {
                        "labels": ["Metric"],
                        "key": {"id": metric_id},
                        "properties": {
                            "metric_name": metric_dict.get("metric_name"),
                            "value": metric_dict.get("value"),
                            "unit": metric_dict.get("unit"),
                            "currency": metric_dict.get("currency"),
                            "period": metric_dict.get("period"),
                            "scale": metric_dict.get("scale"),
                            "confidence": metric_dict.get("confidence"),
                        },
                    }
                )
                relationships.append(
                    {
                        "type": "HAS_METRIC",
                        "start": {"labels": ["Item"], "key": {"id": item_id}},
                        "end": {"labels": ["Metric"], "key": {"id": metric_id}},
                        "properties": {},
                    }
                )

            for risk in result_dict.get("risks", []):
                risk_dict = _to_dict(risk)
                risk_id = risk_key(
                    item_id,
                    str(risk_dict.get("risk_type") or ""),
                    str(risk_dict.get("risk_text") or ""),
                )
                nodes.append(
                    {
                        "labels": ["Risk"],
                        "key": {"id": risk_id},
                        "properties": {
                            "risk_type": risk_dict.get("risk_type"),
                            "risk_text": risk_dict.get("risk_text"),
                            "likelihood": risk_dict.get("likelihood"),
                            "impact": risk_dict.get("impact"),
                            "change_vs_prior": risk_dict.get("change_vs_prior"),
                            "confidence": risk_dict.get("confidence"),
                        },
                    }
                )
                relationships.append(
                    {
                        "type": "HAS_RISK",
                        "start": {"labels": ["Item"], "key": {"id": item_id}},
                        "end": {"labels": ["Risk"], "key": {"id": risk_id}},
                        "properties": {},
                    }
                )

        deduped_nodes, deduped_relationships = _dedupe_graph_payload(nodes, relationships)
        return {"nodes": deduped_nodes, "relationships": deduped_relationships}


Mapper = GraphMapper
LexicalGraphMapper = GraphMapper
