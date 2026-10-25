"""Deep Agent가 사용하는 SEC 도구. 실패를 근거 부족으로 위장하지 않습니다."""

import asyncio
import json
from typing import Literal

import httpx
from langchain_core.tools import tool

from agent.sec import client, service, storage


def output(value):
    return json.dumps(value, ensure_ascii=False)


async def safely(call):
    try:
        return output(await call)
    except client.SecCooldownError as exc:
        return output(
            {
                "error": "SEC_COOLDOWN",
                "retry_after_seconds": exc.retry_after,
                "retryable": True,
                "message": "SEC requests are paused. Use cached reports or retry after the indicated delay.",
            }
        )
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        return output(
            {
                "error": "SEC_HTTP_ERROR",
                "http_status": status,
                "host": exc.request.url.host,
                "retryable": status == 429 or status >= 500,
                "message": "SEC access was denied; this does not mean the report is absent."
                if status == 403
                else "SEC request failed; no successful collection is implied.",
            }
        )
    except Exception as exc:  # noqa: BLE001 - provider boundary preserves failure status
        return output(
            {
                "error": type(exc).__name__,
                "message": "SEC operation failed. Retry or use previously downloaded reports; do not invent evidence.",
            }
        )


@tool
async def find_sec_company(query: str) -> str:
    """Resolve a company name, Korean name, ticker or CIK. Ask user to choose if ambiguous."""
    return await safely(client.resolve_company(query))


@tool
async def collect_sec_reports(
    cik: str, years: int = 1, form: Literal["10-K", "10-Q"] = "10-K"
) -> str:
    """Run SEC collection subgraph: discover and download original filings for 1–20 years.

    First resolve CIK with find_sec_company. Returns each filing's status and source URL.
    Reuses saved originals indefinitely by filing ID; repeated requests do not redownload them.
    Discovery metadata is cached for one hour. Concurrent identical requests share one download.
    The reused count identifies existing originals; downloaded includes all available originals.
    Do not claim successful download for failed filings. Supports only 10-K and 10-Q (including their amendments).
    """
    return await safely(service.collect(cik, years, form))


@tool
async def list_sec_reports(cik: str = "") -> str:
    """List locally stored SEC reports and their download/index status; empty CIK lists all."""
    return await safely(
        asyncio.to_thread(storage.filings, client.cik_number(cik) if cik else None)
    )


@tool
async def read_sec_section(
    filing_id: str, section: str = "", offset: int = 0, limit: int = 16000
) -> str:
    """Read an original section such as Item 1, Item 1A, Item 7, or full text.

    For 10-Q use Part-qualified names, e.g. Part I Item 1 (financial statements),
    Part I Item 2 (MD&A), Part II Item 1 (legal), Part II Item 1A (risks).
    Item alone may be ambiguous; use available_sections to resolve.
    Empty section reads full text. Follow next_offset for more. Cite URL and section.
    A full-report summary must cover all relevant sections, not just the first excerpt.
    """
    return await safely(
        asyncio.to_thread(service.read_section, filing_id, section, offset, limit)
    )


@tool
async def search_sec_reports(query: str, filing_ids: list[str], count: int = 4) -> str:
    """Find embedded passages across 1–20 downloaded reports for one comparison criterion.

    Returns per-report sources. Indexing runs on first use. Rephrase if a figure is missing.
    """
    return await safely(service.search(query, filing_ids, count))


@tool
async def get_sec_financials(
    cik: str,
    metric: str = "revenue",
    years: int = 3,
    exclude_years: list[int] | None = None,
) -> str:
    """Retrieve sourced annual XBRL revenue, net_income or operating_income for 1–20 years.

    Use for numerical charts and YoY. Rows are annual period-end dates, not filing FY labels.
    Never fill missing years with zero. Exclude specific period-end years only when unambiguous.
    """
    return await safely(service.financials(cik, metric, years, exclude_years))


SEC_TOOLS = [
    find_sec_company,
    collect_sec_reports,
    list_sec_reports,
    read_sec_section,
    search_sec_reports,
    get_sec_financials,
]
