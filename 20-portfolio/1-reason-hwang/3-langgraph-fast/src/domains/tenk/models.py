from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FilingDocument:
    document_id: str
    company_name: str
    ticker: str
    form_type: str
    source_url: str
    local_path: str | None = None
    content: str | None = None
    cik: str | None = None
    accession_no: str | None = None
    filing_date: str | None = None
    report_period_start: str | None = None
    report_period_end: str | None = None
    fiscal_year: str | None = None
    fiscal_quarter: str | None = None


@dataclass
class TextChunk:
    chunk_id: str
    text: str


@dataclass
class FilingSection:
    section_id: str
    part_code: str | None
    item_code: str
    section_title: str
    text: str
    chunks: list[TextChunk] = field(default_factory=list)


@dataclass
class StatementRecord:
    text: str
    confidence: float = 0.5


@dataclass
class FactRecord:
    subject: str
    predicate: str
    object_or_complement: str
    fact_type: str = "SPO"
    confidence: float = 0.5


@dataclass
class EntityRecord:
    value: str
    classification: str = "Entity"


@dataclass
class MetricRecord:
    metric_name: str
    value: str
    unit: str | None = None
    currency: str | None = None
    period: str | None = None
    scale: str | None = None
    confidence: float = 0.5


@dataclass
class RiskRecord:
    risk_type: str
    risk_text: str
    likelihood: str | None = None
    impact: str | None = None
    change_vs_prior: str | None = None
    confidence: float = 0.5


@dataclass
class SectionExtractionResult:
    statements: list[StatementRecord] = field(default_factory=list)
    facts: list[FactRecord] = field(default_factory=list)
    entities: list[EntityRecord] = field(default_factory=list)
    metrics: list[MetricRecord] = field(default_factory=list)
    risks: list[RiskRecord] = field(default_factory=list)


GraphPayload = dict[str, list[dict[str, Any]]]
