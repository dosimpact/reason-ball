from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from infrastructure.neo4j.writer import GraphDatabase
from settings import AppSettings, get_settings

RISK_ITEM_CODES = ("1A", "7A", "3", "7", "8", "1")
METRIC_ITEM_CODES = ("8", "7", "7A", "1A", "6")


@dataclass
class Evidence:
    citation_label: str
    node_type: str
    text: str
    item_code: str | None
    filing_id: str | None
    company_name: str | None
    score: float
    reason: str


@dataclass
class RetrievalResult:
    intent: str
    selected_filing: dict[str, Any] | None
    evidence_bundle: list[Evidence]


class RetrievalService:
    def __init__(self, settings: AppSettings | None = None) -> None:
        self.settings = settings or get_settings()
        if GraphDatabase is None:
            raise RuntimeError("neo4j package is not installed")
        self.driver = GraphDatabase.driver(
            self.settings.neo4j_uri,
            auth=(self.settings.neo4j_user, self.settings.neo4j_password),
        )
        self.database = self.settings.neo4j_database

    def close(self) -> None:
        self.driver.close()

    def detect_intent(self, text: str) -> str:
        lowered = text.lower()
        if any(token in lowered for token in ("risk", "리스크", "위험")):
            return "risk"
        if any(token in lowered for token in ("metric", "revenue", "매출", "실적", "재무")):
            return "metric"
        if any(token in lowered for token in ("compare", "vs", "비교")):
            return "compare"
        if any(token in lowered for token in ("brief", "브리프", "투자", "판단")):
            return "brief"
        return "summary"

    def retrieve(
        self,
        query: str,
        selected_filing: dict[str, Any] | None = None,
        *,
        company_query: str | None = None,
        ticker: str | None = None,
        cik: str | None = None,
        accession_no: str | None = None,
        filing_id: str | None = None,
        evidence_limit: int = 8,
    ) -> RetrievalResult:
        intent = self.detect_intent(query)
        with self.driver.session(database=self.database) as session:
            resolved_filing = self._resolve_selected_filing(
                session,
                selected_filing=selected_filing,
                company_query=company_query,
                ticker=ticker,
                cik=cik,
                accession_no=accession_no,
                filing_id=filing_id,
            )
            rows = self._retrieve_rows(session, intent=intent, query=query, selected_filing=resolved_filing, limit=evidence_limit)
        evidence_bundle = self._build_evidence_bundle(rows, intent=intent)
        selected = resolved_filing if resolved_filing is not None else self._select_filing_from_evidence(evidence_bundle)
        return RetrievalResult(intent=intent, selected_filing=selected, evidence_bundle=evidence_bundle)

    def answer(
        self,
        query: str,
        selected_filing: dict[str, Any] | None = None,
        *,
        company_query: str | None = None,
        ticker: str | None = None,
        cik: str | None = None,
        accession_no: str | None = None,
        filing_id: str | None = None,
        evidence_limit: int = 8,
    ) -> tuple[str, RetrievalResult]:
        result = self.retrieve(
            query=query,
            selected_filing=selected_filing,
            company_query=company_query,
            ticker=ticker,
            cik=cik,
            accession_no=accession_no,
            filing_id=filing_id,
            evidence_limit=evidence_limit,
        )
        if not result.evidence_bundle:
            return (
                "I could not find grounded evidence in the current filing graph. "
                "Try parsing the filing into Neo4j first or specify the company more clearly.",
                result,
            )
        lines: list[str] = []
        if result.selected_filing and result.selected_filing.get("company_name"):
            lines.append(f"Grounded evidence for {result.selected_filing['company_name']}.")
        lines.append(f"Focus: {result.intent}.")
        for evidence in result.evidence_bundle[:4]:
            snippet = evidence.text.strip().replace("\n", " ")
            lines.append(f"- [{evidence.citation_label}] {snippet[:280]}")
        return "\n".join(lines), result

    def _resolve_selected_filing(
        self,
        session: Any,
        *,
        selected_filing: dict[str, Any] | None,
        company_query: str | None,
        ticker: str | None,
        cik: str | None,
        accession_no: str | None,
        filing_id: str | None,
    ) -> dict[str, Any] | None:
        normalized = _normalize_selected_filing(selected_filing)
        filing_id = filing_id or (normalized or {}).get("filing_id")
        accession_no = accession_no or (normalized or {}).get("accession_no")
        company_query = company_query or (normalized or {}).get("company_name")
        ticker = ticker or (normalized or {}).get("ticker")
        cik = cik or (normalized or {}).get("cik")
        if filing_id or accession_no:
            row = session.run(
                """
                MATCH (c:Company)-[:FILED]->(f:Filing)
                WHERE
                  ($filing_id IS NOT NULL AND f.id = $filing_id)
                  OR ($accession_no IS NOT NULL AND f.accession_no = $accession_no)
                RETURN
                  f.id AS filing_id,
                  f.accession_no AS accession_no,
                  c.name AS company_name,
                  c.ticker AS ticker,
                  c.cik AS cik,
                  f.form_type AS form_type,
                  f.filing_date AS filing_date
                ORDER BY coalesce(f.filing_date, '') DESC
                LIMIT 1
                """,
                filing_id=filing_id,
                accession_no=accession_no,
            ).single()
            return dict(row) if row is not None else normalized
        if not any((company_query, ticker, cik)):
            return normalized
        row = session.run(
            """
            MATCH (c:Company)-[:FILED]->(f:Filing)
            WHERE
              ($cik IS NOT NULL AND c.cik = $cik)
              OR ($ticker IS NOT NULL AND toUpper(coalesce(c.ticker, '')) = toUpper($ticker))
              OR (
                $company_query IS NOT NULL
                AND toLower(coalesce(c.name, '')) CONTAINS toLower($company_query)
              )
            RETURN
              f.id AS filing_id,
              f.accession_no AS accession_no,
              c.name AS company_name,
              c.ticker AS ticker,
              c.cik AS cik,
              f.form_type AS form_type,
              f.filing_date AS filing_date
            ORDER BY coalesce(f.filing_date, '') DESC
            LIMIT 1
            """,
            cik=cik,
            ticker=ticker,
            company_query=company_query,
        ).single()
        return dict(row) if row is not None else normalized

    def _retrieve_rows(
        self,
        session: Any,
        *,
        intent: str,
        query: str,
        selected_filing: dict[str, Any] | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        if intent == "risk":
            rows = self._retrieve_risks(session, selected_filing=selected_filing, limit=max(limit, 8))
            if rows:
                return rows[:limit]
            return self._retrieve_item_sections(session, selected_filing=selected_filing, item_codes=list(RISK_ITEM_CODES), limit=limit)
        if intent == "metric":
            rows = self._retrieve_metrics(session, selected_filing=selected_filing, limit=max(limit, 8))
            if rows:
                return rows[:limit]
            return self._retrieve_item_sections(session, selected_filing=selected_filing, item_codes=list(METRIC_ITEM_CODES), limit=limit)
        rows = self._retrieve_sections(session, query=query, selected_filing=selected_filing, limit=limit)
        if rows:
            return rows
        return self._retrieve_item_sections(session, selected_filing=selected_filing, item_codes=[], limit=limit)

    def _retrieve_risks(self, session: Any, *, selected_filing: dict[str, Any] | None, limit: int) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_RISK]->(r:Risk)
            WHERE $filing_id IS NULL OR f.id = $filing_id
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN c.name AS company_name, f.id AS filing_id, i.item_code AS item_code,
                   r.risk_text AS text, 'Risk' AS node_type
            ORDER BY CASE WHEN i.item_code = '1A' THEN 0 ELSE 1 END, coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            limit=limit,
        ).data()

    def _retrieve_metrics(self, session: Any, *, selected_filing: dict[str, Any] | None, limit: int) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_METRIC]->(m:Metric)
            WHERE $filing_id IS NULL OR f.id = $filing_id
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN c.name AS company_name, f.id AS filing_id, i.item_code AS item_code,
                   (coalesce(m.metric_name, 'Metric') + ': ' + coalesce(m.value, 'n/a')) AS text,
                   'Metric' AS node_type
            ORDER BY CASE WHEN i.item_code = '8' THEN 0 WHEN i.item_code = '7' THEN 1 ELSE 2 END,
                     coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            limit=limit,
        ).data()

    def _retrieve_sections(
        self,
        session: Any,
        *,
        query: str,
        selected_filing: dict[str, Any] | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        terms = _extract_query_terms(query)
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND (size($terms) = 0 OR any(term IN $terms WHERE toLower(coalesce(s.text, '')) CONTAINS term))
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN c.name AS company_name, f.id AS filing_id, i.item_code AS item_code,
                   substring(s.text, 0, 900) AS text, 'SectionText' AS node_type
            ORDER BY coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            terms=terms,
            limit=limit,
        ).data()

    def _retrieve_item_sections(
        self,
        session: Any,
        *,
        selected_filing: dict[str, Any] | None,
        item_codes: list[str],
        limit: int,
    ) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND (size($item_codes) = 0 OR i.item_code IN $item_codes)
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN c.name AS company_name, f.id AS filing_id, i.item_code AS item_code,
                   substring(s.text, 0, 900) AS text, 'SectionText' AS node_type
            ORDER BY coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            item_codes=item_codes,
            limit=limit,
        ).data()

    def _build_evidence_bundle(self, rows: list[dict[str, Any]], *, intent: str) -> list[Evidence]:
        return [
            Evidence(
                citation_label=f"Item {row.get('item_code') or '?'}",
                node_type=str(row.get("node_type") or "SectionText"),
                text=str(row.get("text") or ""),
                item_code=row.get("item_code"),
                filing_id=row.get("filing_id"),
                company_name=row.get("company_name"),
                score=max(0.1, 1 - idx * 0.08),
                reason=f"{intent} retrieval match",
            )
            for idx, row in enumerate(rows)
            if row.get("text")
        ]

    def _select_filing_from_evidence(self, evidence_bundle: list[Evidence]) -> dict[str, Any] | None:
        if not evidence_bundle:
            return None
        first = evidence_bundle[0]
        return {"filing_id": first.filing_id, "company_name": first.company_name}


def _normalize_selected_filing(selected_filing: dict[str, Any] | None) -> dict[str, Any] | None:
    if not selected_filing:
        return None
    normalized = {
        "filing_id": selected_filing.get("filing_id") or selected_filing.get("filingId"),
        "accession_no": selected_filing.get("accession_no") or selected_filing.get("accessionNo"),
        "company_name": selected_filing.get("company_name") or selected_filing.get("companyName"),
        "ticker": selected_filing.get("ticker"),
        "cik": selected_filing.get("cik"),
        "form_type": selected_filing.get("form_type") or selected_filing.get("formType"),
        "filing_date": selected_filing.get("filing_date") or selected_filing.get("filingDate"),
    }
    return normalized if any(normalized.values()) else None


def _extract_query_terms(query: str) -> list[str]:
    stopwords = {"and", "the", "what", "which", "about", "main", "risk", "metric", "report", "filing"}
    terms: list[str] = []
    for token in re.findall(r"[0-9A-Za-z가-힣]{2,}", query.lower()):
        if token in stopwords or token in terms:
            continue
        terms.append(token)
    return terms[:8]
