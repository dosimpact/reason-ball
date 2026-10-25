"""HTML 보고서의 섹션과 XBRL 연간 수치를 출처를 보존하며 정규화합니다."""

import math
import re
from datetime import date

from bs4 import BeautifulSoup


def extract_report(html, form="10-K"):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "noscript", "ix:header", "ix:hidden"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if (
        len(text) < 500
        or "Your Request Originates from an Undeclared Automated Tool" in text
    ):
        raise ValueError("SEC response does not contain a usable filing")
    return text, extract_sections(text, form)


def extract_sections(text, form="10-K"):
    """Keep repeated Item numbers distinct across quarterly report Parts."""
    quarterly = form in {"10-Q", "10-Q/A"}
    pattern = r"(?:^|\n)[ \t]*(?:PART\s+(?P<part>IV|III|II|I)\b|ITEM\s+(?P<item>\d{1,2}[A-C]?)\b)[ \t]*[.\-:—]?[ \t]*"
    matches = list(re.finditer(pattern, text, re.IGNORECASE))
    sections = {}
    part = None
    for i, match in enumerate(matches):
        if match.group("part"):
            part = match.group("part").upper()
            continue
        # Without a known Part a quarterly Item cannot be safely attributed.
        if quarterly and part is None:
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        key = "Item " + match.group("item").upper()
        if quarterly:
            key = f"Part {part} {key}"
        candidate = {"text": text[match.start() : end].strip(), "offset": match.start()}
        # TOC entries and body headings share a key; retain the longer body span.
        if len(candidate["text"]) > len(sections.get(key, {}).get("text", "")):
            sections[key] = candidate
    return {key: value for key, value in sections.items() if len(value["text"]) >= 100}


METRICS = {
    "revenue": [
        ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"),
        ("us-gaap", "Revenues"),
        ("us-gaap", "SalesRevenueNet"),
        ("ifrs-full", "Revenue"),
    ],
    "net_income": [("us-gaap", "NetIncomeLoss"), ("ifrs-full", "ProfitLoss")],
    "operating_income": [
        ("us-gaap", "OperatingIncomeLoss"),
        ("ifrs-full", "ProfitLossFromOperatingActivities"),
    ],
}


def annual_series(company_facts, metric="revenue", years=3, exclude_years=None):
    if metric not in METRICS or not 1 <= years <= 20:
        raise ValueError("Unsupported metric or period; choose 1–20 years")
    candidates = {}
    for priority, (taxonomy, tag) in enumerate(METRICS[metric]):
        fact = company_facts.get("facts", {}).get(taxonomy, {}).get(tag, {})
        for unit, observations in fact.get("units", {}).items():
            for row in observations:
                try:
                    start, end = (
                        date.fromisoformat(row["start"]),
                        date.fromisoformat(row["end"]),
                    )
                    duration = (end - start).days
                    if (
                        row.get("form") not in ("10-K", "10-K/A")
                        or not 330 <= duration <= 380
                    ):
                        continue
                    if not isinstance(row["val"], (int, float)) or not math.isfinite(
                        row["val"]
                    ):
                        continue
                except (KeyError, ValueError, TypeError):
                    continue
                # period-end를 기준으로 묶습니다. fy는 재공시 연도일 수 있어 그룹 키로 쓰지 않습니다.
                key = (row["end"], unit)
                rank = (row.get("filed", ""), -priority)
                if key in candidates and candidates[key][0] >= rank:
                    continue
                candidates[key] = (
                    rank,
                    {
                        "period": row["end"],
                        "start": row["start"],
                        "year": end.year,
                        "value": row["val"],
                        "unit": unit,
                        "filed": row.get("filed"),
                        "accession": row["accn"],
                        "form": row["form"],
                        "concept": f"{taxonomy}:{tag}",
                        "url": f"https://www.sec.gov/Archives/edgar/data/{int(company_facts['cik'])}/{row['accn'].replace('-', '')}/{row['accn']}-index.html",
                    },
                )
    all_rows = sorted(
        (value[1] for value in candidates.values()), key=lambda r: r["period"]
    )
    units = sorted({r["unit"] for r in all_rows})
    if len(units) > 1:
        # 서로 다른 통화를 단일 시계열에 섞지 않습니다.
        all_rows = [
            r for r in all_rows if r["unit"] == ("USD" if "USD" in units else units[0])
        ]
    if not all_rows:
        return {
            "metric": metric,
            "rows": [],
            "missing_years": [],
            "note": "No comparable annual observations found",
        }
    latest = max(r["year"] for r in all_rows)
    requested = set(range(latest - years + 1, latest + 1)) - set(exclude_years or [])
    rows = [r for r in all_rows if r["year"] in requested]
    for i, row in enumerate(rows):
        row["growth_percent"] = None
        if i:
            previous = rows[i - 1]
            gap = (
                date.fromisoformat(row["period"])
                - date.fromisoformat(previous["period"])
            ).days
            if 300 <= gap <= 430 and previous["value"] > 0:
                row["growth_percent"] = round(
                    (row["value"] / previous["value"] - 1) * 100, 4
                )
    return {
        "company": company_facts.get("entityName"),
        "cik": str(company_facts["cik"]).zfill(10),
        "metric": metric,
        "rows": rows,
        "missing_years": sorted(requested - {r["year"] for r in rows}),
        "available_units": units,
        "period_basis": "annual period end date; latest filed observation",
        "source": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(company_facts['cik']):010d}.json",
    }
