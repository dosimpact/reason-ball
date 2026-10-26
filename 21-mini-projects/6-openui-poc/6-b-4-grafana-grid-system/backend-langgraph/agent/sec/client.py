"""선언된 SEC 클라이언트: 허용 호스트, 속도 제한, 재시도, 캐시."""

import asyncio
import json
import math
import os
import re
import time
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

from agent import settings  # noqa: F401
from agent.sec import storage

_gate = asyncio.Lock()
_last_request = 0.0
_cooldown_until = 0.0
_inflight = {}
REQUEST_INTERVAL = 1.0
COOLDOWN_SECONDS = 60.0
HOSTS = {"www.sec.gov", "data.sec.gov", "archives.sec.gov"}


class SecCooldownError(RuntimeError):
    def __init__(self, seconds):
        self.retry_after = max(1, math.ceil(seconds))
        super().__init__("SEC requests are temporarily paused")


def retry_after_seconds(value):
    if not value:
        return 0.0
    try:
        seconds = float(value)
        return max(0.0, seconds) if math.isfinite(seconds) else 0.0
    except ValueError:
        try:
            when = parsedate_to_datetime(value)
            if when.tzinfo is None:
                when = when.replace(tzinfo=UTC)
            return max(0.0, (when - datetime.now(UTC)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return 0.0


async def _fetch_and_store(url, max_age, json_response):
    # Recheck after joining the queue: an earlier request may have filled SQLite.
    body = await asyncio.to_thread(storage.cached, url, max_age)
    if body is None:
        body = await download(url)
        if json_response:
            json.loads(body)  # Invalid provider bodies must not poison the cache.
        await asyncio.to_thread(storage.cache, url, body)
    return body


async def fetch(url, *, max_age=3600, json_response=True):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in HOSTS or parsed.username:
        raise ValueError("Only public SEC HTTPS endpoints are permitted")
    body = await asyncio.to_thread(storage.cached, url, max_age)
    if body is None:
        # Refresh requests bypass old cache, but concurrent refreshes share one request.
        key = (str(storage.data_directory()), url, max_age <= 0, json_response)
        task = _inflight.get(key)
        if task is None:
            task = asyncio.create_task(_fetch_and_store(url, max_age, json_response))
            _inflight[key] = task

            def finished(done):
                if _inflight.get(key) is done:
                    _inflight.pop(key, None)
                if not done.cancelled():
                    done.exception()  # Observe errors even if every waiter was cancelled.

            task.add_done_callback(finished)
        body = await asyncio.shield(task)
    return json.loads(body) if json_response else body


async def download(url):
    global _last_request, _cooldown_until
    user_agent = os.getenv("SEC_USER_AGENT", "")
    if "@" not in user_agent:
        raise ValueError("SEC_USER_AGENT must contain a contact email")
    async with httpx.AsyncClient(
        timeout=60,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate",
        },
    ) as client:
        for attempt in range(3):
            async with _gate:
                remaining = _cooldown_until - time.monotonic()
                if remaining > 0:
                    raise SecCooldownError(remaining)
                await asyncio.sleep(
                    max(0, REQUEST_INTERVAL - (time.monotonic() - _last_request))
                )
                _last_request = time.monotonic()
                response = await client.get(url)
                retry_after = retry_after_seconds(response.headers.get("Retry-After"))
                if response.status_code in (403, 429) or (
                    response.status_code in (500, 502, 503, 504) and retry_after > 0
                ):
                    _cooldown_until = time.monotonic() + max(
                        COOLDOWN_SECONDS, retry_after
                    )
                    response.raise_for_status()
            if response.status_code in (500, 502, 503, 504) and attempt < 2:
                await asyncio.sleep(2**attempt)
                continue
            response.raise_for_status()
            return response.text
    raise RuntimeError("SEC request failed")


def cik_number(value):
    value = str(value).strip()
    if not re.fullmatch(r"\d{1,10}", value) or int(value) <= 0:
        raise ValueError("CIK must contain 1–10 digits")
    return value.zfill(10)


ALIASES = {
    "엔비디아": "NVDA",
    "엔비디아코퍼레이션": "NVDA",
    "애플": "AAPL",
    "마이크로소프트": "MSFT",
    "아마존": "AMZN",
    "인텔": "INTC",
    "테슬라": "TSLA",
    "쿠팡": "CPNG",
    "에이엠디": "AMD",
    "알파벳": "GOOGL",
    "구글": "GOOGL",
    "메타": "META",
}


async def resolve_company(query):
    query = query.strip()
    if query.isdigit():
        data = await fetch(
            f"https://data.sec.gov/submissions/CIK{cik_number(query)}.json"
        )
        return [
            {
                "cik": cik_number(data["cik"]),
                "name": data["name"],
                "ticker": next(iter(data.get("tickers", [])), ""),
            }
        ]
    query = ALIASES.get(query, query).upper()
    data = await fetch("https://www.sec.gov/files/company_tickers.json", max_age=86400)
    rows = [
        {
            "cik": cik_number(row["cik_str"]),
            "name": row["title"],
            "ticker": row["ticker"],
        }
        for row in data.values()
    ]
    exact = [
        r for r in rows if r["ticker"].upper() == query or r["name"].upper() == query
    ]
    return (
        exact
        or [
            r
            for r in rows
            if query in r["name"].upper() or query in r["ticker"].upper()
        ][:12]
    )


def filing_rows(columns, company):
    result = []
    for i, accession in enumerate(columns.get("accessionNumber", [])):
        form = columns["form"][i]
        primary = columns["primaryDocument"][i]
        if form not in ("10-K", "10-K/A", "10-Q", "10-Q/A") or not primary:
            continue
        # SEC가 반환한 accession과 파일명만 원문 주소를 구성할 수 있습니다.
        if not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession) or not re.fullmatch(
            r"[\w.\-]+", primary
        ):
            continue
        result.append(
            {
                "id": accession,
                "cik": cik_number(company["cik"]),
                "company": company["name"],
                "form": form,
                "report_date": columns["reportDate"][i],
                "filed": columns["filingDate"][i],
                "url": f"https://www.sec.gov/Archives/edgar/data/{int(company['cik'])}/{accession.replace('-', '')}/{primary}",
            }
        )
    return result


async def list_filings(cik, years=1, form="10-K"):
    if not 1 <= years <= 20 or form not in ("10-K", "10-Q"):
        raise ValueError("Choose 1–20 years and a supported filing form")
    company = await fetch(f"https://data.sec.gov/submissions/CIK{cik_number(cik)}.json")
    rows = filing_rows(company["filings"]["recent"], company)
    target = years * (3 if form == "10-Q" else 1)
    for archive in company["filings"].get("files", []):
        if len({r["report_date"] for r in rows if r["form"] == form}) >= target:
            break
        name = archive["name"]
        if re.fullmatch(r"CIK\d+-submissions-\d+\.json", name):
            rows += filing_rows(
                await fetch(f"https://data.sec.gov/submissions/{name}", max_age=86400),
                company,
            )
    rows = sorted(
        {r["id"]: r for r in rows}.values(),
        key=lambda r: (r["report_date"], r["filed"]),
        reverse=True,
    )
    # 동일 기간의 정정 공시는 함께 제공합니다. 선택 기준을 분석자가 알 수 있게 유지합니다.
    periods = sorted(
        {r["report_date"] for r in rows if r["form"] == form}, reverse=True
    )[:target]
    return [
        r
        for r in rows
        if r["form"] in (form, form + "/A") and r["report_date"] in periods
    ]
