"""기존 SEC API로 최신 10-K를 준비하고 추적 가능한 Item 근거를 만든다."""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime

import httpx

from domains.tenk.normalizer import html_to_text, normalize_text
from domains.tenk.sec_client import SecClient, SecReadError
from domains.tenk.segmenter import ITEM_HEADER_RE

ITEMS = {"1": "Business", "1A": "Risk Factors", "3": "Legal Proceedings", "7": "Management's Discussion and Analysis", "8": "Financial Statements and Supplementary Data"}

# Explicitly reviewed issuer succession, never inferred from similar names.
# July 1, 2026 holding-company reorganization; joint Q2 filing:
# https://www.sec.gov/Archives/edgar/data/34088/000003408826000093/xom-20260630.htm
PREDECESSORS = {"0002115436": "0000034088"}


def referenced_pages(text: str) -> dict[int, str]:
    """Resolve printed annual-report pages only from consecutive footer numbers.

    A table may end with a number immediately before a footer; accepting either
    adjacent number alone would mistake that value for the printed page number.
    """
    pages: dict[int, str] = {}
    previous: dict[int, int] = {}
    for footer in re.finditer(r"(?m)^[^\n]{1,100}/20\d{2} Form 10-K$", text):
        before = re.search(r"(?m)^(\d{1,3})\n$", text[:footer.start()])
        after = re.match(r"\n(\d{1,3})(?:\n|$)", text[footer.end():])
        candidates = {}
        if before:
            candidates[int(before[1])] = footer.end()
        if after:
            candidates[int(after[1])] = footer.end() + len(after[0].rstrip("\n"))
        for number, end in candidates.items():
            if number - 1 in previous:
                pages[number] = text[previous[number - 1]:end].strip()
        previous = candidates
    return pages


def incorporate_financial_section(selected: dict[str, str], text: str) -> None:
    """Follow explicit Financial Section references with actual body headings."""
    titles = {
        "terms": r"FREQUENTLY USED TERMS",
        "mda": r"MANAGEMENT[’']S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS",
        "control": r"MANAGEMENT[’']S REPORT ON INTERNAL CONTROL OVER FINANCIAL REPORTING",
        "audit": r"REPORT OF INDEPENDENT REGISTERED PUBLIC ACCOUNTING FIRM",
        "exhibits": r"INDEX TO EXHIBITS",
    }
    positions = {key: match.start() for key, title in titles.items() if (match := re.search(r"(?m)^" + title + r"$", text))}
    for code, start_key, end_key in [("7", "mda", "control"), ("8", "audit", "exhibits")]:
        block = selected.get(code, "")
        start, end = positions.get(start_key), positions.get(end_key)
        if len(block) < 2000 and "financial section" in block.lower() and start is not None and end is not None and start < end:
            selected[code] = block + "\n" + text[start:end].strip()
            if code == "8" and "frequently used terms" in block.lower() and positions.get("terms", len(text)) < positions.get("mda", 0):
                selected[code] += "\n" + text[positions["terms"]:positions["mda"]].strip()


class FilingSourceClient(SecClient):
    def __init__(self, base_url: str | None = None, *, transport=None):
        super().__init__(base_url or os.getenv("SEC_CHAT_BFF_URL", "http://127.0.0.1:2801"), transport=transport)

    async def companies(self, query: str, page: int = 1) -> dict:
        # Broad name search may fill the first page with "Metals" before META.
        # Resolve an exact ticker first; fall back to the existing name search.
        if page == 1 and isinstance(query, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9.-]{0,9}", query.strip()):
            exact = await self._page("/api/sec/companies", {"ticker": query.strip().upper(), "page": 1, "pageSize": 10})
            if exact["items"]:
                return exact
        return await super().companies(query, page)

    async def synchronize(self, cik: str) -> str:
        """선택 기업만 수집한다. SSE completed를 확인해야 최신 확인으로 취급한다."""
        completed = None
        async with (
            httpx.AsyncClient(base_url=self.base_url, transport=self.transport, timeout=httpx.Timeout(900, connect=10)) as client,
            client.stream("POST", "/api/sec/company-filing-sync-jobs", json={"ciks": [cik], "years": 2, "downloadDocuments": True}) as response,
        ):
            if response.status_code != 200:
                raise SecReadError("SEC 기업 동기화를 시작할 수 없습니다.")
            event = ""
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    payload = json.loads(line[5:])
                    if event == "error":
                        raise SecReadError("SEC 최신 공시 동기화에 실패했습니다. 수집 서비스를 확인해 주세요.")
                    if event == "completed":
                        completed = payload
        if not isinstance(completed, dict) or completed.get("companiesProcessed") != 1:
            raise SecReadError("SEC 동기화 완료를 확인하지 못했습니다.")
        # 다른 문서 실패도 숨기지 않는다. 최신 10-K의 본문은 아래에서 별도로 확인한다.
        if completed.get("failed", 0):
            raise SecReadError("일부 공시 다운로드에 실패했습니다. 수집 후 다시 시도해 주세요.")
        return datetime.now(UTC).isoformat()

    async def prepare(self, cik: str, *, refresh: bool = True) -> dict:
        # filings()가 식별자를 검증한다. 쓰기 요청 전에 먼저 검증한다.
        include_former = cik in PREDECESSORS.values()
        await self.filings(cik, form="10-K", include_former=include_former)
        checked_at = await self.synchronize(cik) if refresh else None
        page = await self.filings(cik, form="10-K", include_former=include_former)
        filings = [row for row in page["items"] if row.get("formType") == "10-K"]
        if not filings and cik in PREDECESSORS:
            predecessor = PREDECESSORS[cik]
            source = await self.prepare(predecessor, refresh=refresh)
            source["requestedCik"] = cik
            source["issuerNote"] = f"법인 재편: 선택 CIK {cik}의 자체 10-K가 없어, 확인된 이전 법인 CIK {predecessor}의 최신 10-K를 사용합니다."
            return source
        if not filings:
            raise SecReadError("이 기업의 10-K를 찾지 못했습니다. 20-F 등 다른 양식은 지원하지 않습니다.")
        filing = max(filings, key=lambda row: (row.get("filingDate") or "", row["accessionNo"]))
        if filing.get("status") != "downloaded":
            raise SecReadError("최신 10-K 원문 다운로드가 완료되지 않았습니다.")
        content = await self.content(cik, filing["accessionNo"])
        return prepare_source(content, filing, checked_at)


def prepare_source(content: str, filing: dict, checked_at: str | None) -> dict:
    text = normalize_text(html_to_text(content))
    # Running page headers repeat the same Item. Keep the complete contiguous
    # Item span, then discard shorter table-of-contents occurrences.
    headers = list(ITEM_HEADER_RE.finditer(text))
    groups = []
    for header in headers:
        code = header.group("code").upper()
        if not groups or groups[-1][0] != code:
            groups.append((code, header.start()))
    selected = {}
    for index, (code, start) in enumerate(groups):
        end = groups[index + 1][1] if index + 1 < len(groups) else len(text)
        block = text[start:end].strip()
        if code in {*ITEMS, "15"} and len(block) > len(selected.get(code, "")):
            selected[code] = block
    schedules = selected.pop("15", "")
    if not selected:
        raise SecReadError("10-K Item 경계를 인식하지 못했습니다. 원문을 확인해 주세요.")
    financials = selected.get("8", "")
    if len(financials) < 2000 and "consolidated financial statements" in financials.lower() and not re.search(r"appear(?:s)? on pages", financials, re.IGNORECASE):
        start = re.search(r"(?im)^Report of Independent Registered Public Accounting Firm$", schedules)
        if start:
            end = re.search(r"(?im)^Schedule II\b", schedules[start.end():])
            selected["8"] = financials + "\n" + schedules[start.start():start.end() + end.start() if end else len(schedules)]
    pages = referenced_pages(text)
    for code, block in list(selected.items()):
        # Some filings place MD&A/statements after all numbered Items and use
        # a short Item to incorporate a printed page range by reference.
        reference = re.search(r"appear(?:s)? on pages (\d+)[–−-](\d+)", block, re.IGNORECASE)
        if len(block) < 2000 and reference:
            numbers = range(int(reference[1]), int(reference[2]) + 1)
            if numbers and all(number in pages for number in numbers):
                selected[code] = block + "\n" + "\n".join(pages[number] for number in numbers)
    incorporate_financial_section(selected, text)
    cik, accession = filing["cik"], filing["accessionNo"]
    return {
        "filing": {key: filing.get(key) for key in ("cik", "accessionNo", "filingDate", "reportDate", "formType", "primaryDocument")},
        "sourceUrl": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{accession}-index.html",
        "checkedAt": checked_at,
        "sha256": hashlib.sha256(content.encode()).hexdigest(),
        "sections": selected,
        "missingItems": [code for code in ITEMS if code not in selected],
    }
