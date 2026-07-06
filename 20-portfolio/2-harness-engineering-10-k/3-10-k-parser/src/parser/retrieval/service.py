from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from parser.core.config import AppConfig, get_settings
from parser.storage.neo4j_writer import GraphDatabase

RISK_ITEM_CODES = ("1A", "7A", "3", "7", "8", "1")
METRIC_ITEM_CODES = ("8", "7", "7A", "1A", "6")
MARKET_RISK_QUERY_TERMS = {
    "market",
    "markets",
    "interest",
    "rate",
    "rates",
    "foreign",
    "currency",
    "currencies",
    "exchange",
    "fx",
}
LIQUIDITY_QUERY_TERMS = {
    "liquidity",
    "cash",
    "debt",
    "credit",
    "financing",
    "funding",
    "borrow",
    "borrowings",
    "loan",
    "loans",
    "capital",
}
LEGAL_RISK_QUERY_TERMS = {
    "legal",
    "regulatory",
    "litigation",
    "lawsuit",
    "lawsuits",
    "investigation",
    "investigations",
    "compliance",
    "court",
    "antitrust",
    "dma",
}
RISK_TEXT_KEYWORDS = (
    "risk",
    "risks",
    "market risk",
    "liquidity",
    "interest rate",
    "foreign exchange",
    "foreign currency",
    "legal",
    "litigation",
    "regulatory",
    "investigation",
    "debt",
    "indebtedness",
    "capital",
    "material adverse",
)
ITEM_TITLE_HINTS = {
    "1": "Business",
    "1A": "Risk Factors",
    "1B": "Unresolved Staff Comments",
    "1C": "Cybersecurity",
    "2": "Properties",
    "3": "Legal Proceedings",
    "4": "Mine Safety Disclosures",
    "5": "Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
    "6": "Reserved",
    "7": "Management's Discussion and Analysis of Financial Condition and Results of Operations",
    "7A": "Quantitative and Qualitative Disclosures About Market Risk",
    "8": "Financial Statements and Supplementary Data",
    "9": "Changes in and Disagreements With Accountants on Accounting and Financial Disclosure",
    "9A": "Controls and Procedures",
    "9B": "Other Information",
    "9C": "Disclosure Regarding Foreign Jurisdictions that Prevent Inspections",
    "10": "Directors, Executive Officers and Corporate Governance",
    "11": "Executive Compensation",
    "12": "Security Ownership of Certain Beneficial Owners and Management and Related Stockholder Matters",
    "13": "Certain Relationships and Related Transactions, and Director Independence",
    "14": "Principal Accountant Fees and Services",
    "15": "Exhibits and Financial Statement Schedules",
    "16": "Form 10-K Summary",
}


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
    def __init__(self, settings: AppConfig | None = None) -> None:
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
            rows = self._retrieve_rows(
                session,
                intent=intent,
                query=query,
                selected_filing=resolved_filing,
                evidence_limit=evidence_limit,
            )
            rows = self._prepare_evidence_rows(rows, intent=intent, query=query)

        evidence_bundle = self._build_evidence_bundle(rows, intent=intent)
        selected = self._select_filing_from_evidence(resolved_filing, evidence_bundle)
        return RetrievalResult(
            intent=intent,
            selected_filing=selected,
            evidence_bundle=evidence_bundle,
        )

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
        if result.selected_filing:
            company_name = result.selected_filing.get("company_name")
            form_type = result.selected_filing.get("form_type")
            filing_date = result.selected_filing.get("filing_date")
            if company_name:
                header = f"Grounded evidence for {company_name}"
                if form_type:
                    header += f" {form_type}"
                if filing_date:
                    header += f" filed on {filing_date}"
                header += "."
                lines.append(header)
        lines.append(f"Focus: {result.intent}.")

        for evidence in result.evidence_bundle[:4]:
            snippet = evidence.text.strip().replace("\n", " ")
            lines.append(f"- [{evidence.citation_label}] {snippet[:280]}")

        return "\n".join(lines), result

    def _normalize_selected_filing(
        self, selected_filing: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        if not selected_filing:
            return None

        normalized = {
            "filing_id": selected_filing.get("filing_id") or selected_filing.get("filingId"),
            "accession_no": selected_filing.get("accession_no")
            or selected_filing.get("accessionNo"),
            "company_name": selected_filing.get("company_name")
            or selected_filing.get("companyName"),
            "ticker": selected_filing.get("ticker"),
            "cik": selected_filing.get("cik"),
            "form_type": selected_filing.get("form_type") or selected_filing.get("formType"),
            "filing_date": selected_filing.get("filing_date")
            or selected_filing.get("filingDate"),
        }

        if not any(normalized.values()):
            return None

        return normalized

    def _build_evidence_bundle(
        self, rows: list[dict[str, Any]], *, intent: str
    ) -> list[Evidence]:
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

    def _select_filing_from_evidence(
        self,
        selected_filing: dict[str, Any] | None,
        evidence_bundle: list[Evidence],
    ) -> dict[str, Any] | None:
        if selected_filing is not None or not evidence_bundle:
            return selected_filing

        first = evidence_bundle[0]
        return {
            "filing_id": first.filing_id,
            "accession_no": None,
            "company_name": first.company_name,
            "ticker": None,
            "cik": None,
            "form_type": None,
            "filing_date": None,
        }

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
        normalized = self._normalize_selected_filing(selected_filing)
        filing_id = filing_id or (normalized or {}).get("filing_id")
        accession_no = accession_no or (normalized or {}).get("accession_no")
        company_query = company_query or (normalized or {}).get("company_name")
        ticker = ticker or (normalized or {}).get("ticker")
        cik = cik or (normalized or {}).get("cik")
        explicit_scope_requested = any((filing_id, accession_no, company_query, ticker, cik))

        if not explicit_scope_requested:
            return normalized

        if filing_id or accession_no:
            row = (
                session.run(
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
                    ORDER BY
                      CASE
                        WHEN $filing_id IS NOT NULL AND f.id = $filing_id THEN 0
                        WHEN $accession_no IS NOT NULL AND f.accession_no = $accession_no THEN 1
                        ELSE 2
                      END
                    LIMIT 1
                    """,
                    filing_id=filing_id,
                    accession_no=accession_no,
                ).single()
                or None
            )

            if row is None:
                return self._build_unresolved_filing_scope(
                    normalized=normalized,
                    filing_id=filing_id,
                    accession_no=accession_no,
                    company_query=company_query,
                    ticker=ticker,
                    cik=cik,
                )

            return self._merge_selected_filing_hint(row, normalized)

        row = (
            session.run(
                """
                MATCH (c:Company)-[:FILED]->(f:Filing)
                WHERE
                  ($cik IS NOT NULL AND c.cik = $cik)
                  OR (
                    $ticker IS NOT NULL
                    AND toUpper(coalesce(c.ticker, '')) = toUpper($ticker)
                  )
                  OR (
                    $company_query IS NOT NULL
                    AND (
                      toLower(coalesce(c.name, '')) CONTAINS toLower($company_query)
                      OR toUpper(coalesce(c.ticker, '')) = toUpper($company_query)
                    )
                  )
                RETURN
                  f.id AS filing_id,
                  f.accession_no AS accession_no,
                  c.name AS company_name,
                  c.ticker AS ticker,
                  c.cik AS cik,
                  f.form_type AS form_type,
                  f.filing_date AS filing_date
                ORDER BY
                  CASE
                    WHEN f.form_type IN ['10-K', '10-K/A', '20-F', '20-F/A'] THEN 0
                    WHEN f.form_type IN ['10-Q', '10-Q/A'] THEN 1
                    ELSE 2
                  END,
                  coalesce(f.filing_date, '') DESC
                LIMIT 1
                """,
                cik=cik,
                ticker=ticker,
                company_query=company_query,
            ).single()
            or None
        )

        if row is None:
            return self._build_unresolved_filing_scope(
                normalized=normalized,
                filing_id=filing_id,
                accession_no=accession_no,
                company_query=company_query,
                ticker=ticker,
                cik=cik,
            )

        return self._merge_selected_filing_hint(row, normalized)

    def _build_unresolved_filing_scope(
        self,
        *,
        normalized: dict[str, Any] | None,
        filing_id: str | None,
        accession_no: str | None,
        company_query: str | None,
        ticker: str | None,
        cik: str | None,
    ) -> dict[str, Any]:
        unresolved = dict(normalized or {})
        unresolved["unresolved"] = True
        unresolved["requested_scope"] = {
            "filing_id": filing_id,
            "accession_no": accession_no,
            "company_query": company_query,
            "ticker": ticker,
            "cik": cik,
        }
        return unresolved

    def _merge_selected_filing_hint(
        self, row: Any, normalized: dict[str, Any] | None
    ) -> dict[str, Any]:
        resolved = dict(row)
        if not normalized:
            return resolved

        for key in (
            "accession_no",
            "company_name",
            "ticker",
            "cik",
            "form_type",
            "filing_date",
        ):
            hint = normalized.get(key)
            if not hint:
                continue
            if key == "company_name" or not resolved.get(key):
                resolved[key] = hint

        return resolved

    def _retrieve_rows(
        self,
        session: Any,
        *,
        intent: str,
        query: str,
        selected_filing: dict[str, Any] | None,
        evidence_limit: int,
    ) -> list[dict[str, Any]]:
        if (selected_filing or {}).get("unresolved"):
            return []

        if intent == "risk":
            priority_terms = self._priority_terms(intent=intent, query=query)
            risk_rows = self._retrieve_risks(
                session,
                selected_filing=selected_filing,
                limit=max(48, evidence_limit * 12),
                item_codes=list(RISK_ITEM_CODES),
                priority_terms=priority_terms,
            )
            section_rows = self._retrieve_item_sections(
                session,
                selected_filing=selected_filing,
                item_codes=list(RISK_ITEM_CODES),
                limit=6,
                priority_terms=priority_terms,
            )
            return self._rank_rows(
                risk_rows + section_rows,
                intent=intent,
                query=query,
                limit=evidence_limit,
            )
        if intent == "metric":
            priority_terms = self._priority_terms(intent=intent, query=query)
            metric_rows = self._retrieve_metrics(
                session,
                selected_filing=selected_filing,
                limit=max(24, evidence_limit * 6),
                item_codes=list(METRIC_ITEM_CODES),
                priority_terms=priority_terms,
            )
            section_rows = self._retrieve_item_sections(
                session,
                selected_filing=selected_filing,
                item_codes=list(METRIC_ITEM_CODES),
                limit=4,
                priority_terms=priority_terms,
            )
            return self._rank_rows(
                metric_rows + section_rows,
                intent=intent,
                query=query,
                limit=evidence_limit,
            )
        if intent in {"brief", "compare"}:
            rows = (
                self._retrieve_risks(
                    session,
                    selected_filing=selected_filing,
                    limit=18,
                    item_codes=list(RISK_ITEM_CODES),
                    priority_terms=self._priority_terms(intent="risk", query=query),
                )
                + self._retrieve_metrics(
                    session,
                    selected_filing=selected_filing,
                    limit=8,
                    item_codes=list(METRIC_ITEM_CODES),
                    priority_terms=self._priority_terms(intent="metric", query=query),
                )
                + self._retrieve_sections(
                    session,
                    query=query,
                    selected_filing=selected_filing,
                    limit=8,
                )
            )
            return self._rank_rows(
                rows,
                intent=intent,
                query=query,
                limit=evidence_limit,
            )

        rows = self._retrieve_sections(
            session,
            query=query,
            selected_filing=selected_filing,
            limit=evidence_limit,
        )
        if rows:
            return self._rank_rows(
                rows,
                intent=intent,
                query=query,
                limit=evidence_limit,
            )

        fallback = (
            self._retrieve_risks(
                session,
                selected_filing=selected_filing,
                limit=12,
                item_codes=list(RISK_ITEM_CODES),
                priority_terms=self._priority_terms(intent="risk", query=query),
            )
            + self._retrieve_metrics(
                session,
                selected_filing=selected_filing,
                limit=8,
                item_codes=list(METRIC_ITEM_CODES),
                priority_terms=self._priority_terms(intent="metric", query=query),
            )
            + self._retrieve_recent_sections(
                session, selected_filing=selected_filing, limit=3
            )
        )
        return self._rank_rows(
            fallback,
            intent=intent,
            query=query,
            limit=evidence_limit,
        )

    def _retrieve_risks(
        self,
        session: Any,
        *,
        selected_filing: dict[str, Any] | None,
        limit: int,
        item_codes: list[str] | None = None,
        priority_terms: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_RISK]->(r:Risk)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND (
                size($item_codes) = 0
                OR i.item_code IN $item_codes
              )
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN
              c.name AS company_name,
              f.id AS filing_id,
              i.item_code AS item_code,
              r.risk_text AS text,
              'Risk' AS node_type,
              reduce(
                matches = 0,
                term IN $priority_terms |
                  matches + CASE
                    WHEN toLower(coalesce(r.risk_text, '')) CONTAINS term THEN 1
                    ELSE 0
                  END
              ) AS term_matches
            ORDER BY
              term_matches DESC,
              CASE
                WHEN i.item_code = '1A' THEN 0
                WHEN i.item_code = '7A' THEN 1
                WHEN i.item_code = '3' THEN 2
                WHEN i.item_code = '7' THEN 3
                WHEN i.item_code = '8' THEN 4
                WHEN i.item_code = '1' THEN 5
                ELSE 6
              END,
              coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            item_codes=item_codes or [],
            priority_terms=priority_terms or [],
            limit=limit,
        ).data()

    def _retrieve_metrics(
        self,
        session: Any,
        *,
        selected_filing: dict[str, Any] | None,
        limit: int,
        item_codes: list[str] | None = None,
        priority_terms: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_METRIC]->(m:Metric)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND (
                size($item_codes) = 0
                OR i.item_code IN $item_codes
              )
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN
              c.name AS company_name,
              f.id AS filing_id,
              i.item_code AS item_code,
              (coalesce(m.metric_name, 'Metric') + ': ' + coalesce(m.value, 'n/a')) AS text,
              'Metric' AS node_type,
              reduce(
                matches = 0,
                term IN $priority_terms |
                  matches + CASE
                    WHEN toLower(coalesce(m.metric_name, '') + ' ' + coalesce(m.value, '')) CONTAINS term THEN 1
                    ELSE 0
                  END
              ) AS term_matches
            ORDER BY
              term_matches DESC,
              CASE
                WHEN i.item_code = '8' THEN 0
                WHEN i.item_code = '7' THEN 1
                WHEN i.item_code = '7A' THEN 2
                WHEN i.item_code = '1A' THEN 3
                WHEN i.item_code = '6' THEN 4
                ELSE 5
              END,
              coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            item_codes=item_codes or [],
            priority_terms=priority_terms or [],
            limit=limit,
        ).data()

    def _retrieve_item_sections(
        self,
        session: Any,
        *,
        selected_filing: dict[str, Any] | None,
        item_codes: list[str],
        limit: int,
        priority_terms: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND i.item_code IN $item_codes
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN
              c.name AS company_name,
              f.id AS filing_id,
              i.item_code AS item_code,
              substring(s.text, 0, 900) AS text,
              'SectionText' AS node_type,
              reduce(
                matches = 0,
                term IN $priority_terms |
                  matches + CASE
                    WHEN toLower(coalesce(s.text, '')) CONTAINS term THEN 1
                    ELSE 0
                  END
              ) AS term_matches
            ORDER BY
              term_matches DESC,
              CASE
                WHEN i.item_code = '1A' THEN 0
                WHEN i.item_code = '7A' THEN 1
                WHEN i.item_code = '3' THEN 2
                WHEN i.item_code = '7' THEN 3
                WHEN i.item_code = '8' THEN 4
                WHEN i.item_code = '1' THEN 5
                ELSE 6
              END,
              coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            item_codes=item_codes,
            priority_terms=priority_terms or [],
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
        terms = self._extract_query_terms(query)
        rows = session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)
            WHERE ($filing_id IS NULL OR f.id = $filing_id)
              AND (
                size($terms) = 0
                OR any(term IN $terms WHERE toLower(coalesce(s.text, '')) CONTAINS term)
              )
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN
              c.name AS company_name,
              f.id AS filing_id,
              i.item_code AS item_code,
              substring(s.text, 0, 900) AS text,
              'SectionText' AS node_type
            ORDER BY coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            terms=terms,
            limit=limit,
        ).data()

        if rows:
            return rows

        return self._retrieve_recent_sections(
            session, selected_filing=selected_filing, limit=limit
        )

    def _retrieve_recent_sections(
        self, session: Any, *, selected_filing: dict[str, Any] | None, limit: int
    ) -> list[dict[str, Any]]:
        return session.run(
            """
            MATCH (f:Filing)-[:HAS_ITEM]->(i:Item)-[:HAS_SECTION]->(s:SectionText)
            WHERE $filing_id IS NULL OR f.id = $filing_id
            OPTIONAL MATCH (c:Company)-[:FILED]->(f)
            RETURN
              c.name AS company_name,
              f.id AS filing_id,
              i.item_code AS item_code,
              substring(s.text, 0, 900) AS text,
              'SectionText' AS node_type
            ORDER BY
              CASE
                WHEN i.item_code IN ['1A', '7A', '3', '7', '8', '1'] THEN 0
                ELSE 1
              END,
              coalesce(f.filing_date, '') DESC
            LIMIT $limit
            """,
            filing_id=(selected_filing or {}).get("filing_id"),
            limit=limit,
        ).data()

    def _extract_query_terms(self, query: str) -> list[str]:
        tokens = [token.lower() for token in re.findall(r"[0-9A-Za-z가-힣]{2,}", query)]
        stopwords = {
            "and",
            "build",
            "does",
            "emphasis",
            "explain",
            "focus",
            "focused",
            "from",
            "give",
            "into",
            "its",
            "latest",
            "look",
            "looks",
            "main",
            "of",
            "on",
            "outline",
            "recent",
            "show",
            "summarize",
            "their",
            "thesis",
            "through",
            "using",
            "whether",
            "with",
            "what",
            "which",
            "about",
            "report",
            "filing",
            "company",
            "this",
            "that",
            "tell",
            "risk",
            "metric",
            "summary",
            "brief",
            "보고서",
            "사업보고서",
            "최신",
            "기업",
            "투자",
            "판단",
        }
        prioritized_vocabulary = (
            MARKET_RISK_QUERY_TERMS
            | LIQUIDITY_QUERY_TERMS
            | LEGAL_RISK_QUERY_TERMS
            | {
                "revenue",
                "sales",
                "margin",
                "margins",
                "income",
                "expenses",
                "profit",
                "profits",
                "loss",
                "losses",
                "growth",
                "market",
                "liquidity",
                "cash",
                "debt",
            }
        )
        prioritized_tokens: list[str] = []
        other_tokens: list[str] = []
        for token in tokens:
            if token in stopwords:
                continue
            bucket = prioritized_tokens if token in prioritized_vocabulary else other_tokens
            if token not in bucket:
                bucket.append(token)
        return (prioritized_tokens + other_tokens)[:8]

    def _dedupe_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        seen: set[tuple[str | None, str | None, str]] = set()

        for row in rows:
            key = (
                row.get("filing_id"),
                row.get("item_code"),
                str(row.get("text") or "")[:160],
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(row)

        return deduped

    def _prepare_evidence_rows(
        self,
        rows: list[dict[str, Any]],
        *,
        intent: str,
        query: str,
    ) -> list[dict[str, Any]]:
        priority_terms = self._priority_terms(intent=intent, query=query)
        query_terms = self._extract_query_terms(query)
        prepared: list[dict[str, Any]] = []

        for row in rows:
            text = self._clean_text(str(row.get("text") or ""))
            if not text:
                prepared.append(row)
                continue

            updated = dict(row)
            updated["text"] = self._build_evidence_snippet(
                text=text,
                item_code=str(row.get("item_code") or ""),
                node_type=str(row.get("node_type") or ""),
                query_terms=query_terms,
                priority_terms=priority_terms,
            )
            prepared.append(updated)

        return prepared

    def _clean_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    def _build_evidence_snippet(
        self,
        *,
        text: str,
        item_code: str,
        node_type: str,
        query_terms: list[str],
        priority_terms: list[str],
    ) -> str:
        cleaned = self._clean_text(text)
        if not cleaned:
            return cleaned

        if node_type == "Metric":
            return self._truncate_text(cleaned, 220)

        header, body = self._split_item_header(cleaned, item_code=item_code)
        source_text = body or cleaned
        anchor = self._find_best_anchor(
            source_text,
            priority_terms=priority_terms,
            query_terms=query_terms,
        )

        if anchor is None:
            if header and body:
                return f"{header} {self._truncate_text(body, 240)}".strip()
            return self._truncate_text(source_text, 280)

        window_start = self._align_window_start(source_text, max(0, anchor - 110))
        window_end = self._align_window_end(source_text, min(len(source_text), anchor + 240))
        window = self._clean_snippet_fragment(source_text[window_start:window_end])

        if window_start > 0:
            window = f"... {window}"
        if window_end < len(source_text):
            window = f"{window} ..."

        if header:
            return f"{header} {window}".strip()

        return window

    def _truncate_text(self, text: str, limit: int) -> str:
        if len(text) <= limit:
            return text
        return text[: max(0, limit - 4)].rstrip() + " ..."

    def _align_window_start(self, text: str, start: int) -> int:
        if start <= 0:
            return 0

        sentence_search_start = max(0, start - 140)
        prefix = text[sentence_search_start:start]
        sentence_matches = list(re.finditer(r"[.!?;:]\s+", prefix))
        if sentence_matches:
            return sentence_search_start + sentence_matches[-1].end()

        whitespace_search_start = max(0, start - 40)
        whitespace_prefix = text[whitespace_search_start:start]
        whitespace_matches = list(re.finditer(r"\s+", whitespace_prefix))
        if whitespace_matches:
            return whitespace_search_start + whitespace_matches[-1].end()

        forward_match = re.search(r"\s+", text[start : min(len(text), start + 32)])
        if forward_match:
            return start + forward_match.end()

        return start

    def _align_window_end(self, text: str, end: int) -> int:
        if end >= len(text):
            return len(text)

        suffix = text[end : min(len(text), end + 140)]
        sentence_match = re.search(r"[.!?;:](?=\s|$)", suffix)
        if sentence_match:
            return end + sentence_match.end()

        whitespace_match = re.search(r"\s+", text[end : min(len(text), end + 40)])
        if whitespace_match:
            return end + whitespace_match.start()

        return end

    def _clean_snippet_fragment(self, text: str) -> str:
        cleaned = self._clean_text(text)
        cleaned = re.sub(r"^[,;:)\]\-–—]+", "", cleaned).strip()
        return cleaned

    def _split_item_header(self, text: str, *, item_code: str) -> tuple[str, str]:
        normalized_item_code = item_code.upper().strip()
        body = text

        if normalized_item_code:
            body = re.sub(
                rf"^Item\s+{re.escape(normalized_item_code)}\.?\s*",
                "",
                body,
                count=1,
                flags=re.IGNORECASE,
            ).strip()

            title = ITEM_TITLE_HINTS.get(normalized_item_code)
            if title:
                body = re.sub(
                    rf"^{re.escape(title)}\.?\s*",
                    "",
                    body,
                    count=1,
                    flags=re.IGNORECASE,
                ).strip()
                return f"Item {normalized_item_code}. {title}", body

            return f"Item {normalized_item_code}", body

        if text.startswith("Item "):
            match = re.match(r"^(Item\s+[0-9A-Z]+[A-Z]?)\.?\s*", text)
            if match:
                header = match.group(1).strip()
                body = text[match.end() :].strip()
                return header, body

        return "", text

    def _find_best_anchor(
        self,
        text: str,
        *,
        priority_terms: list[str],
        query_terms: list[str],
    ) -> int | None:
        lowered = text.lower()
        candidates = sorted(
            {term.lower() for term in priority_terms + query_terms if len(term) >= 3},
            key=len,
            reverse=True,
        )

        for term in candidates:
            index = lowered.find(term)
            if index >= 0:
                return index

        return None

    def _rank_rows(
        self,
        rows: list[dict[str, Any]],
        *,
        intent: str,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        query_terms = self._extract_query_terms(query)
        ranked = sorted(
            enumerate(self._dedupe_rows(rows)),
            key=lambda item: (
                -self._score_row(item[1], intent=intent, query=query, query_terms=query_terms),
                item[0],
            ),
        )
        return [row for _, row in ranked[:limit]]

    def _score_row(
        self,
        row: dict[str, Any],
        *,
        intent: str,
        query: str,
        query_terms: list[str],
    ) -> float:
        item_code = str(row.get("item_code") or "").upper()
        node_type = str(row.get("node_type") or "")
        text = str(row.get("text") or "")
        lowered = text.lower()
        score = self._item_priority(intent=intent, item_code=item_code, query=query)
        score += 4.0 * sum(1 for term in query_terms if term in lowered)

        if node_type == "SectionText":
            score += 2.5
        elif node_type == "Risk":
            score += 1.5 if intent in {"risk", "brief", "compare"} else 0.5
        elif node_type == "Metric":
            score += 2.5 if intent == "metric" else 0.5

        if intent in {"risk", "brief", "compare"}:
            if any(keyword in lowered for keyword in RISK_TEXT_KEYWORDS):
                score += 2.0
            if len(text) < 80:
                score -= 1.0

            if self._query_has_market_risk_focus(query, query_terms):
                if item_code == "7A":
                    score += 6.0
                if any(
                    keyword in lowered
                    for keyword in (
                        "market risk",
                        "interest rate",
                        "foreign exchange",
                        "foreign currency",
                        "value-at-risk",
                    )
                ):
                    score += 4.0

            if self._query_has_liquidity_focus(query, query_terms):
                if item_code in {"1A", "7", "7A", "8"}:
                    score += 4.0
                if any(
                    keyword in lowered
                    for keyword in (
                        "liquidity",
                        "cash",
                        "debt",
                        "indebtedness",
                        "credit",
                        "capital",
                        "going concern",
                    )
                ):
                    score += 5.0

            if self._query_has_legal_focus(query, query_terms):
                if item_code == "3":
                    score += 6.0
                if any(
                    keyword in lowered
                    for keyword in (
                        "legal proceedings",
                        "litigation",
                        "regulatory",
                        "investigation",
                        "court",
                        "commission",
                        "dma",
                    )
                ):
                    score += 4.0

        if intent == "metric":
            if any(keyword in lowered for keyword in ("revenue", "gross", "margin", "cash", "debt", "assets", "income")):
                score += 2.0

        return score

    def _item_priority(self, *, intent: str, item_code: str, query: str) -> float:
        risk_weights = {
            "1A": 14.0,
            "7A": 12.0,
            "3": 9.0,
            "7": 8.0,
            "8": 7.0,
            "1": 5.0,
        }
        metric_weights = {
            "8": 14.0,
            "7": 12.0,
            "7A": 8.0,
            "1A": 5.0,
            "6": 4.0,
        }

        if intent == "metric":
            return metric_weights.get(item_code, 0.0)

        score = risk_weights.get(item_code, 0.0)
        lowered_query = query.lower()

        if intent in {"risk", "brief", "compare"}:
            if ("market risk" in lowered_query or self._query_has_market_risk_focus(query, [])) and item_code == "7A":
                score += 6.0
            if self._query_has_liquidity_focus(query, []) and item_code in {"1A", "7", "7A", "8"}:
                score += 3.0
            if self._query_has_legal_focus(query, []) and item_code == "3":
                score += 4.0

        return score

    def _priority_terms(self, *, intent: str, query: str) -> list[str]:
        terms = list(self._extract_query_terms(query))

        if intent in {"risk", "brief", "compare"}:
            if self._query_has_market_risk_focus(query, terms):
                terms.extend(
                    [
                        "market risk",
                        "interest rate",
                        "foreign exchange",
                        "foreign currency",
                        "currency",
                    ]
                )
            if self._query_has_liquidity_focus(query, terms):
                terms.extend(
                    [
                        "liquidity",
                        "cash",
                        "debt",
                        "credit",
                        "capital",
                        "going concern",
                    ]
                )
            if self._query_has_legal_focus(query, terms):
                terms.extend(
                    [
                        "legal",
                        "regulatory",
                        "litigation",
                        "investigation",
                        "court",
                        "commission",
                    ]
                )

        deduped: list[str] = []
        for term in terms:
            lowered = term.lower()
            if lowered not in deduped:
                deduped.append(lowered)
        return deduped[:16]

    def _query_has_market_risk_focus(
        self, query: str, query_terms: list[str]
    ) -> bool:
        lowered = query.lower()
        return "market risk" in lowered or any(
            term in MARKET_RISK_QUERY_TERMS for term in query_terms
        )

    def _query_has_liquidity_focus(
        self, query: str, query_terms: list[str]
    ) -> bool:
        lowered = query.lower()
        return "going concern" in lowered or any(
            term in LIQUIDITY_QUERY_TERMS for term in query_terms
        )

    def _query_has_legal_focus(self, query: str, query_terms: list[str]) -> bool:
        lowered = query.lower()
        return "legal" in lowered or "regulatory" in lowered or any(
            term in LEGAL_RISK_QUERY_TERMS for term in query_terms
        )
