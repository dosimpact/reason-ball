from __future__ import annotations

import re
from dataclasses import asdict
from typing import Any

from langgraph_fast.domains.tenk.models import (
    EntityRecord,
    FactRecord,
    FilingDocument,
    FilingSection,
    MetricRecord,
    RiskRecord,
    SectionExtractionResult,
    StatementRecord,
)
from langgraph_fast.settings import AppSettings, get_settings

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
ENTITY_RE = re.compile(r"\b[A-Z][A-Za-z0-9&\-/]*(?:\s+[A-Z][A-Za-z0-9&\-/]*)*\b")
NUMBER_RE = re.compile(r"(?i)(\$?\d[\d,]*(?:\.\d+)?)\s*(billion|million|thousand|%)?")
FINANCIAL_CONTEXT_KEYWORDS = {
    "revenue",
    "sales",
    "income",
    "margin",
    "cash",
    "debt",
    "assets",
    "liabilities",
    "equity",
    "expense",
    "loss",
    "profit",
    "customers",
    "subscribers",
    "loan",
    "credit",
    "interest",
}
RISK_KEYWORDS = {
    "cyber": "Cyber",
    "security": "Cyber",
    "regulatory": "Regulatory",
    "compliance": "Regulatory",
    "market": "Market",
    "credit": "Credit",
    "operational": "Operational",
    "supply chain": "Operational",
}


class MockExtractionEngine:
    def extract_section(self, document: FilingDocument, section: FilingSection) -> SectionExtractionResult:
        del document
        aggregated = SectionExtractionResult()
        for chunk in section.chunks:
            partial = self._extract_from_text(section, chunk.text)
            aggregated = _merge_results(aggregated, partial)
        return _dedupe_result(aggregated)

    def _extract_from_text(self, section: FilingSection, text: str) -> SectionExtractionResult:
        result = SectionExtractionResult()
        sentences = [sentence.strip() for sentence in SENTENCE_SPLIT_RE.split(text) if sentence.strip()]
        for sentence in sentences:
            if len(sentence) < 20:
                continue
            result.statements.append(StatementRecord(text=sentence, confidence=0.55))
            result.entities.extend(self._extract_entities(sentence))
            fact = self._extract_fact(sentence)
            if fact is not None:
                result.facts.append(fact)
            result.metrics.extend(self._extract_metrics(sentence, section.item_code))
            risk = self._extract_risk(sentence, section.item_code)
            if risk is not None:
                result.risks.append(risk)
        return _dedupe_result(result)

    def _extract_entities(self, sentence: str) -> list[EntityRecord]:
        entities: list[EntityRecord] = []
        for match in ENTITY_RE.finditer(sentence):
            value = match.group(0).strip()
            if len(value) <= 1:
                continue
            entities.append(EntityRecord(value=value, classification=self._classify_entity(value)))
        return entities

    def _classify_entity(self, value: str) -> str:
        lowered = value.lower()
        if lowered.endswith(("inc", "inc.", "corp", "corporation")):
            return "Company"
        if "item" in lowered:
            return "RegulatorySection"
        if len(value) <= 5 and value.upper() == value:
            return "Ticker"
        return "Entity"

    def _extract_fact(self, sentence: str) -> FactRecord | None:
        relation_match = re.search(r"\b(is|are|was|were|has|have)\b", sentence, flags=re.IGNORECASE)
        if relation_match is None:
            return None
        subject = sentence[: relation_match.start()].strip(" ,.;:")
        predicate = relation_match.group(1).upper()
        obj = sentence[relation_match.end() :].strip(" ,.;:")
        if not subject or not obj:
            return None
        fact_type = "SPO" if ENTITY_RE.search(obj) else "SPC"
        return FactRecord(subject=subject, predicate=predicate, object_or_complement=obj, fact_type=fact_type)

    def _extract_metrics(self, sentence: str, item_code: str) -> list[MetricRecord]:
        metrics: list[MetricRecord] = []
        for match in NUMBER_RE.finditer(sentence):
            value = match.group(1)
            scale = match.group(2)
            metric_name = self._metric_name_from_context(sentence, match.start())
            currency = "USD" if "$" in value else None
            compact_value = value.replace("$", "").replace(",", "").strip()
            if not self._looks_like_metric(sentence, match.start(), metric_name, compact_value, currency, scale):
                continue
            metrics.append(
                MetricRecord(
                    metric_name=metric_name,
                    value=value.replace("$", ""),
                    unit=scale,
                    currency=currency,
                    period=item_code,
                    scale=scale,
                    confidence=0.5,
                )
            )
        return metrics

    def _metric_name_from_context(self, sentence: str, number_start: int) -> str:
        words = sentence[:number_start].strip().split()
        if not words:
            return "metric_value"
        return "_".join(words[-3:]).lower()

    def _looks_like_metric(
        self,
        sentence: str,
        number_start: int,
        metric_name: str,
        compact_value: str,
        currency: str | None,
        scale: str | None,
    ) -> bool:
        if not compact_value or metric_name == "metric_value":
            return False
        if currency or scale:
            return True
        if compact_value.isdigit() and 1900 <= int(compact_value) <= 2100:
            return False
        context = sentence[max(0, number_start - 80) : number_start].lower()
        return any(keyword in context for keyword in FINANCIAL_CONTEXT_KEYWORDS) or len(metric_name.split("_")) >= 3

    def _extract_risk(self, sentence: str, item_code: str) -> RiskRecord | None:
        lowered = sentence.lower()
        risk_type = None
        for key, category in RISK_KEYWORDS.items():
            if key in lowered:
                risk_type = category
                break
        item_is_risk_focused = item_code.upper() in {"1A", "7A"}
        has_risk_word = "risk" in lowered or risk_type is not None
        if not item_is_risk_focused and not has_risk_word:
            return None
        return RiskRecord(risk_type=risk_type or "Other", risk_text=sentence, change_vs_prior="unknown")


class LLMExtractor:
    def __init__(self, settings: AppSettings | None = None) -> None:
        self.settings = settings or get_settings()
        if self.settings.llm_provider != "mock":
            raise RuntimeError(
                "Only LLM_PROVIDER=mock is supported in the first migrated parser pass. "
                "External LLM extraction will be added after domain/API parity is stable."
            )
        self.engine = MockExtractionEngine()

    def extract(self, segments: list[FilingSection], metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        meta = metadata or {}
        document = FilingDocument(
            document_id=str(meta.get("report_id") or meta.get("accession_no") or meta.get("source_url") or "unknown"),
            company_name=str(meta.get("company_name") or "Unknown Company"),
            ticker=str(meta.get("ticker") or ""),
            form_type=str(meta.get("report_type") or meta.get("form_type") or "10-K"),
            source_url=str(meta.get("source_url") or ""),
            local_path=meta.get("report_local_path"),
            cik=meta.get("cik"),
            accession_no=meta.get("accession_no"),
            filing_date=meta.get("filing_date"),
            report_period_start=meta.get("report_period_start"),
            report_period_end=meta.get("report_period_end"),
            fiscal_year=meta.get("fiscal_year"),
            fiscal_quarter=meta.get("fiscal_quarter"),
        )
        return {
            "document": document,
            "sections": [{"section": section, "result": self.engine.extract_section(document, section)} for section in segments],
        }


def _merge_results(base: SectionExtractionResult, other: SectionExtractionResult) -> SectionExtractionResult:
    return SectionExtractionResult(
        statements=base.statements + other.statements,
        facts=base.facts + other.facts,
        entities=base.entities + other.entities,
        metrics=base.metrics + other.metrics,
        risks=base.risks + other.risks,
    )


def _dedupe_result(result: SectionExtractionResult) -> SectionExtractionResult:
    def dedupe(records: list[Any], key_fn):
        seen: set[Any] = set()
        output: list[Any] = []
        for record in records:
            key = key_fn(record)
            if not key or key in seen:
                continue
            seen.add(key)
            output.append(record)
        return output

    return SectionExtractionResult(
        statements=dedupe(result.statements, lambda record: record.text.strip().lower()),
        facts=dedupe(
            result.facts,
            lambda record: (
                record.subject.strip().lower(),
                record.predicate.strip().lower(),
                record.object_or_complement.strip().lower(),
            ),
        ),
        entities=dedupe(result.entities, lambda record: record.value.strip().lower()),
        metrics=dedupe(result.metrics, lambda record: (record.metric_name.strip().lower(), record.value, record.period)),
        risks=dedupe(result.risks, lambda record: (record.risk_type.strip().lower(), record.risk_text.strip().lower())),
    )


def to_plain_dict(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {key: to_plain_dict(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): to_plain_dict(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_plain_dict(item) for item in value]
    return value


Extractor = LLMExtractor
