"""Section-level information extraction engines.

Two modes:
- MockExtractionEngine: deterministic regex/rule-based extraction
- OpenAIExtractionEngine: LLM extraction with mock fallback on failures
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List

from ..core.config import AppConfig
from ..core.models import (
    EntityRecord,
    FactRecord,
    FilingDocument,
    FilingSection,
    MetricRecord,
    RiskRecord,
    SectionExtractionResult,
    StatementRecord,
)
from .codex_runner import run_codex_exec_json

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

logger = logging.getLogger(__name__)

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


class BaseExtractionEngine(ABC):
    @abstractmethod
    def extract_section(self, document: FilingDocument, section: FilingSection) -> SectionExtractionResult:
        raise NotImplementedError


class MockExtractionEngine(BaseExtractionEngine):
    def extract_section(self, document: FilingDocument, section: FilingSection) -> SectionExtractionResult:
        aggregated = SectionExtractionResult()
        for chunk in section.chunks:
            partial = self._extract_from_text(document, section, chunk.text)
            aggregated = _merge_results(aggregated, partial)
        return aggregated

    def _extract_from_text(
        self, document: FilingDocument, section: FilingSection, text: str
    ) -> SectionExtractionResult:
        result = SectionExtractionResult()
        sentences = [s.strip() for s in SENTENCE_SPLIT_RE.split(text) if s.strip()]

        for sentence in sentences:
            if len(sentence) < 20:
                continue

            result.statements.append(StatementRecord(text=sentence, confidence=0.55))
            for entity in self._extract_entities(sentence):
                result.entities.append(entity)

            fact = self._extract_fact(sentence)
            if fact:
                result.facts.append(fact)

            result.metrics.extend(self._extract_metrics(sentence, section.item_code))
            maybe_risk = self._extract_risk(sentence, section.item_code)
            if maybe_risk:
                result.risks.append(maybe_risk)

        return _dedupe_result(result)

    def _extract_entities(self, sentence: str) -> List[EntityRecord]:
        entities: List[EntityRecord] = []
        for match in ENTITY_RE.finditer(sentence):
            value = match.group(0).strip()
            if len(value) <= 1:
                continue
            classification = self._classify_entity(value)
            entities.append(EntityRecord(value=value, classification=classification))
        return entities

    def _classify_entity(self, value: str) -> str:
        lowered = value.lower()
        if lowered.endswith("inc") or lowered.endswith("inc.") or lowered.endswith("corp") or lowered.endswith(
            "corporation"
        ):
            return "Company"
        if "item" in lowered:
            return "RegulatorySection"
        if len(value) <= 5 and value.upper() == value:
            return "Ticker"
        return "Entity"

    def _extract_fact(self, sentence: str) -> FactRecord | None:
        relation_match = re.search(r"\b(is|are|was|were|has|have)\b", sentence, flags=re.IGNORECASE)
        if not relation_match:
            return None

        split_at = relation_match.start()
        subject = sentence[:split_at].strip(" ,.;:")
        predicate = relation_match.group(1).upper()
        obj = sentence[relation_match.end() :].strip(" ,.;:")
        if not subject or not obj:
            return None

        fact_type = "SPO" if self._looks_like_entity(obj) else "SPC"
        return FactRecord(
            subject=subject,
            predicate=predicate,
            object_or_complement=obj,
            fact_type=fact_type,
            confidence=0.5,
        )

    def _looks_like_entity(self, text: str) -> bool:
        return bool(ENTITY_RE.search(text))

    def _extract_metrics(self, sentence: str, item_code: str) -> List[MetricRecord]:
        metrics: List[MetricRecord] = []
        for match in NUMBER_RE.finditer(sentence):
            value = match.group(1)
            scale = match.group(2)
            metric_name = self._metric_name_from_context(sentence, match.start())
            currency = "USD" if "$" in value else None
            compact_value = value.replace("$", "").replace(",", "").strip()

            if not self._looks_like_metric(
                sentence=sentence,
                number_start=match.start(),
                metric_name=metric_name,
                compact_value=compact_value,
                currency=currency,
                scale=scale,
            ):
                continue

            clean_value = value.replace("$", "")
            metrics.append(
                MetricRecord(
                    metric_name=metric_name,
                    value=clean_value,
                    unit=scale,
                    currency=currency,
                    period=item_code,
                    scale=scale,
                    confidence=0.5,
                )
            )
        return metrics

    def _metric_name_from_context(self, sentence: str, number_start: int) -> str:
        prefix = sentence[:number_start].strip()
        if not prefix:
            return "metric_value"
        words = prefix.split()
        return "_".join(words[-3:]).lower()

    def _looks_like_metric(
        self,
        *,
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

        if compact_value.isdigit():
            numeric_value = int(compact_value)
            if 1900 <= numeric_value <= 2100:
                return False

        context_window = sentence[max(0, number_start - 80) : number_start].lower()
        if any(keyword in context_window for keyword in FINANCIAL_CONTEXT_KEYWORDS):
            return True

        return len(metric_name.split("_")) >= 3

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

        return RiskRecord(
            risk_type=risk_type or "Other",
            risk_text=sentence,
            likelihood=None,
            impact=None,
            change_vs_prior="unknown",
            confidence=0.5,
        )


class OpenAIExtractionEngine(BaseExtractionEngine):
    def __init__(self, config: AppConfig, prompt_template_path: Path) -> None:
        if OpenAI is None:
            raise RuntimeError("openai package is not available. Install requirements first.")
        if not config.llm_api_key:
            raise RuntimeError("LLM_API_KEY is required when LLM_PROVIDER=openai.")

        self.client = OpenAI(api_key=config.llm_api_key)
        self.model = config.llm_model
        self.prompt_template = prompt_template_path.read_text(encoding="utf-8")
        self.fallback = MockExtractionEngine()

    def extract_section(self, document: FilingDocument, section: FilingSection) -> SectionExtractionResult:
        aggregated = SectionExtractionResult()
        for chunk in section.chunks:
            try:
                partial = self._extract_chunk(document, section, chunk.text)
            except Exception as exc:
                logger.warning(
                    "openai extraction failed for document_id=%s section=%s chunk=%s, fallback to mock: %s",
                    document.document_id,
                    section.section_id,
                    chunk.chunk_id,
                    exc,
                )
                partial = self.fallback._extract_from_text(document, section, chunk.text)
            aggregated = _merge_results(aggregated, partial)

        return _dedupe_result(aggregated)

    def _extract_chunk(
        self, document: FilingDocument, section: FilingSection, text: str
    ) -> SectionExtractionResult:
        prompt = _render_prompt(
            self.prompt_template,
            {
                "company_name": document.company_name,
                "ticker": document.ticker,
                "form_type": document.form_type,
                "source_url": document.source_url,
                "item_code": section.item_code,
                "section_title": section.section_title,
                "text": text,
            },
        )

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content or "{}"
        payload = _parse_json_payload(content)
        return _payload_to_result(payload)


class CodexCLIExtractionEngine(BaseExtractionEngine):
    def __init__(self, config: AppConfig, prompt_template_path: Path) -> None:
        self.config = config
        self.prompt_template = prompt_template_path.read_text(encoding="utf-8")
        self.fallback = MockExtractionEngine()

    def extract_section(self, document: FilingDocument, section: FilingSection) -> SectionExtractionResult:
        aggregated = SectionExtractionResult()
        for chunk in section.chunks:
            try:
                partial = self._extract_chunk(document, section, chunk.text)
            except Exception as exc:
                logger.warning(
                    "codex-cli extraction failed for document_id=%s section=%s chunk=%s, fallback to mock: %s",
                    document.document_id,
                    section.section_id,
                    chunk.chunk_id,
                    exc,
                )
                partial = self.fallback._extract_from_text(document, section, chunk.text)
            aggregated = _merge_results(aggregated, partial)
        return _dedupe_result(aggregated)

    def _extract_chunk(
        self, document: FilingDocument, section: FilingSection, text: str
    ) -> SectionExtractionResult:
        prompt = _render_prompt(
            self.prompt_template,
            {
                "company_name": document.company_name,
                "ticker": document.ticker,
                "form_type": document.form_type,
                "source_url": document.source_url,
                "item_code": section.item_code,
                "section_title": section.section_title,
                "text": text,
            },
        )

        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "statements": {"type": "array", "items": {"$ref": "#/$defs/statement"}},
                "facts": {"type": "array", "items": {"$ref": "#/$defs/fact"}},
                "entities": {"type": "array", "items": {"$ref": "#/$defs/entity"}},
                "metrics": {"type": "array", "items": {"$ref": "#/$defs/metric"}},
                "risks": {"type": "array", "items": {"$ref": "#/$defs/risk"}},
            },
            "required": ["statements", "facts", "entities", "metrics", "risks"],
            "$defs": {
                "statement": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"text": {"type": "string"}, "confidence": {"type": "number"}},
                    "required": ["text", "confidence"],
                },
                "fact": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "subject": {"type": "string"},
                        "predicate": {"type": "string"},
                        "object_or_complement": {"type": "string"},
                        "fact_type": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["subject", "predicate", "object_or_complement", "fact_type", "confidence"],
                },
                "entity": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"value": {"type": "string"}, "classification": {"type": "string"}},
                    "required": ["value", "classification"],
                },
                "metric": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "metric_name": {"type": "string"},
                        "value": {"type": "string"},
                        "unit": {"type": ["string", "null"]},
                        "currency": {"type": ["string", "null"]},
                        "period": {"type": ["string", "null"]},
                        "scale": {"type": ["string", "null"]},
                        "confidence": {"type": "number"},
                    },
                    "required": ["metric_name", "value", "unit", "currency", "period", "scale", "confidence"],
                },
                "risk": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "risk_type": {"type": "string"},
                        "risk_text": {"type": "string"},
                        "likelihood": {"type": ["string", "null"]},
                        "impact": {"type": ["string", "null"]},
                        "change_vs_prior": {"type": ["string", "null"]},
                        "confidence": {"type": "number"},
                    },
                    "required": ["risk_type", "risk_text", "likelihood", "impact", "change_vs_prior", "confidence"],
                },
            },
        }

        content = run_codex_exec_json(self.config, prompt=prompt, schema=schema)
        payload = _parse_json_payload(content)
        return _payload_to_result(payload)


def build_extraction_engine(config: AppConfig) -> BaseExtractionEngine:
    if config.llm_provider == "openai":
        template = config.prompts_dir / "item_aware_extract_10k.md"
        return OpenAIExtractionEngine(config=config, prompt_template_path=template)
    if config.llm_provider == "codex-cli":
        template = config.prompts_dir / "item_aware_extract_10k.md"
        return CodexCLIExtractionEngine(config=config, prompt_template_path=template)

    logger.info("using mock extraction engine (LLM_PROVIDER=%s)", config.llm_provider)
    return MockExtractionEngine()


def _render_prompt(template: str, values: Dict[str, Any]) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", str(value if value is not None else ""))
    return rendered


def _parse_json_payload(content: str) -> Dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _payload_to_result(payload: Dict[str, Any]) -> SectionExtractionResult:
    result = SectionExtractionResult()
    for row in payload.get("statements", []):
        result.statements.append(StatementRecord(text=str(row.get("text", "")).strip(), confidence=float(row.get("confidence", 0.5))))
    for row in payload.get("facts", []):
        result.facts.append(
            FactRecord(
                subject=str(row.get("subject", "")).strip(),
                predicate=str(row.get("predicate", "")).strip(),
                object_or_complement=str(row.get("object_or_complement", "")).strip(),
                fact_type=str(row.get("fact_type", "SPO")).strip() or "SPO",
                confidence=float(row.get("confidence", 0.5)),
            )
        )
    for row in payload.get("entities", []):
        result.entities.append(
            EntityRecord(
                value=str(row.get("value", "")).strip(),
                classification=str(row.get("classification", "Entity")).strip() or "Entity",
            )
        )
    for row in payload.get("metrics", []):
        result.metrics.append(
            MetricRecord(
                metric_name=str(row.get("metric_name", "")).strip(),
                value=str(row.get("value", "")).strip(),
                unit=_as_optional_str(row.get("unit")),
                currency=_as_optional_str(row.get("currency")),
                period=_as_optional_str(row.get("period")),
                scale=_as_optional_str(row.get("scale")),
                confidence=float(row.get("confidence", 0.5)),
            )
        )
    for row in payload.get("risks", []):
        result.risks.append(
            RiskRecord(
                risk_type=str(row.get("risk_type", "Other")).strip() or "Other",
                risk_text=str(row.get("risk_text", "")).strip(),
                likelihood=_as_optional_str(row.get("likelihood")),
                impact=_as_optional_str(row.get("impact")),
                change_vs_prior=_as_optional_str(row.get("change_vs_prior")),
                confidence=float(row.get("confidence", 0.5)),
            )
        )
    return _dedupe_result(result)


def _as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _merge_results(base: SectionExtractionResult, other: SectionExtractionResult) -> SectionExtractionResult:
    return SectionExtractionResult(
        statements=base.statements + other.statements,
        facts=base.facts + other.facts,
        entities=base.entities + other.entities,
        metrics=base.metrics + other.metrics,
        risks=base.risks + other.risks,
    )


def _dedupe_result(result: SectionExtractionResult) -> SectionExtractionResult:
    statement_seen = set()
    statements: List[StatementRecord] = []
    for statement in result.statements:
        key = statement.text.strip().lower()
        if not key or key in statement_seen:
            continue
        statement_seen.add(key)
        statements.append(statement)

    fact_seen = set()
    facts: List[FactRecord] = []
    for fact in result.facts:
        key = (fact.subject.strip().lower(), fact.predicate.strip().lower(), fact.object_or_complement.strip().lower())
        if not all(key) or key in fact_seen:
            continue
        fact_seen.add(key)
        facts.append(fact)

    entity_seen = set()
    entities: List[EntityRecord] = []
    for entity in result.entities:
        key = entity.value.strip().lower()
        if not key or key in entity_seen:
            continue
        entity_seen.add(key)
        entities.append(entity)

    metric_seen = set()
    metrics: List[MetricRecord] = []
    for metric in result.metrics:
        key = (metric.metric_name.strip().lower(), metric.value.strip(), (metric.period or "").strip())
        if not metric.metric_name or key in metric_seen:
            continue
        metric_seen.add(key)
        metrics.append(metric)

    risk_seen = set()
    risks: List[RiskRecord] = []
    for risk in result.risks:
        key = (risk.risk_type.strip().lower(), risk.risk_text.strip().lower())
        if not risk.risk_text or key in risk_seen:
            continue
        risk_seen.add(key)
        risks.append(risk)

    return SectionExtractionResult(statements=statements, facts=facts, entities=entities, metrics=metrics, risks=risks)


class LLMExtractor:
    """Pipeline-compatible section extraction orchestrator."""

    def __init__(self, settings: AppConfig | None = None) -> None:
        self.config = settings or AppConfig.from_env()
        self.engine = build_extraction_engine(self.config)

    def extract(self, segments: List[FilingSection], metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
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

        sections: List[Dict[str, Any]] = []
        for section in segments:
            result = self.engine.extract_section(document, section)
            sections.append(
                {
                    "section": section,
                    "result": result,
                }
            )

        return {
            "document": document,
            "sections": sections,
        }


Extractor = LLMExtractor
