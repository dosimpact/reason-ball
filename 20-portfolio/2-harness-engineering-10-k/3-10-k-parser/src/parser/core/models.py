from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class FilingDocument:
    document_id: str
    company_name: str
    ticker: str
    form_type: str
    source_url: str
    local_path: Optional[str] = None
    content: Optional[str] = None
    cik: Optional[str] = None
    accession_no: Optional[str] = None
    filing_date: Optional[str] = None
    report_period_start: Optional[str] = None
    report_period_end: Optional[str] = None
    fiscal_year: Optional[str] = None
    fiscal_quarter: Optional[str] = None


@dataclass
class TextChunk:
    chunk_id: str
    text: str


@dataclass
class FilingSection:
    section_id: str
    part_code: Optional[str]
    item_code: str
    section_title: str
    text: str
    chunks: List[TextChunk] = field(default_factory=list)


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
    unit: Optional[str] = None
    currency: Optional[str] = None
    period: Optional[str] = None
    scale: Optional[str] = None
    confidence: float = 0.5


@dataclass
class RiskRecord:
    risk_type: str
    risk_text: str
    likelihood: Optional[str] = None
    impact: Optional[str] = None
    change_vs_prior: Optional[str] = None
    confidence: float = 0.5


@dataclass
class SectionExtractionResult:
    statements: List[StatementRecord] = field(default_factory=list)
    facts: List[FactRecord] = field(default_factory=list)
    entities: List[EntityRecord] = field(default_factory=list)
    metrics: List[MetricRecord] = field(default_factory=list)
    risks: List[RiskRecord] = field(default_factory=list)
