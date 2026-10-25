"""실제 SEC 응답 구조의 경계: 정정 공시, 연간 기간, 원문 상태, 섹션."""

import asyncio

import pytest

from agent.sec import client, service, storage
from agent.sec.parsing import annual_series, extract_report


def observation(start="2022-01-01", end="2022-12-31", val=100, **kwargs):
    return dict(
        start=start,
        end=end,
        val=val,
        form="10-K",
        accn="0000000001-23-000001",
        filed="2023-02-01",
        fy=2023,
        **kwargs,
    )


def facts(rows):
    return {
        "cik": 1,
        "entityName": "Example",
        "facts": {"us-gaap": {"Revenues": {"units": {"USD": rows}}}},
    }


def test_annual_period_not_filing_fy_and_revision():
    original = observation()
    revision = {**original, "val": 110, "filed": "2024-02-01", "fy": 2023}
    quarter = observation(start="2022-10-01", val=22)
    latest = observation(start="2023-01-01", end="2023-12-31", val=132)
    result = annual_series(facts([original, revision, quarter, latest]), years=2)
    assert [r["value"] for r in result["rows"]] == [110, 132]
    assert result["rows"][0]["year"] == 2022
    assert result["rows"][1]["growth_percent"] == 20
    assert result["rows"][0]["filed"] == "2024-02-01"


def test_missing_year_not_zero_or_misleading_growth():
    rows = [observation(), observation(start="2024-01-01", end="2024-12-31", val=180)]
    result = annual_series(facts(rows), years=3)
    assert result["missing_years"] == [2023]
    assert result["rows"][-1]["growth_percent"] is None
    assert len(annual_series(facts(rows), years=3, exclude_years=[2022])["rows"]) == 1


def test_sections_choose_body_not_toc():
    html = "<html><script>secret</script><p>Item 1. Business</p><p>3</p><p>Item 1A. Risks</p><p>4</p>"
    html += "<h2>ITEM 1. Business</h2><p>" + "Our business sells chips. " * 40 + "</p>"
    html += (
        "<h2>ITEM 1A. Risk Factors</h2><p>" + "Supply chain risk. " * 40 + "</p></html>"
    )
    text, sections = extract_report(html)
    assert "secret" not in text
    assert "Our business" in sections["Item 1"]["text"]
    assert "Supply chain" not in sections["Item 1"]["text"]
    assert "Supply chain" in sections["Item 1A"]["text"]


def test_failed_download_is_not_downloaded(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    filing = {
        "id": "0000000001-23-000001",
        "cik": "0000000001",
        "company": "Example",
        "form": "10-K",
        "report_date": "2022-12-31",
        "filed": "2023-02-01",
        "url": "https://www.sec.gov/a.htm",
    }

    async def fail(*args, **kwargs):
        raise RuntimeError("network")

    monkeypatch.setattr(client, "fetch", fail)
    result = asyncio.run(service.collect_one(filing))
    assert result["status"] == "failed"
    assert storage.filings()[0]["status"] == "failed"
    with pytest.raises(ValueError, match="not been downloaded"):
        service.read_section(filing["id"])
    storage.save_filing(filing, "downloaded", text="real original", sections={})
    storage.save_filing(filing, "failed", error="retry failed")
    assert storage.get_filing(filing["id"])["text"] == "real original"
    assert storage.get_filing(filing["id"])["status"] == "downloaded"


def test_cik_and_fetch_allowlist():
    assert client.cik_number("1045810") == "0001045810"
    with pytest.raises(ValueError):
        client.cik_number("../private")
    with pytest.raises(ValueError, match="Only public SEC"):
        asyncio.run(client.fetch("http://127.0.0.1/private"))


def test_sec_access_error_reports_status_without_sensitive_request_data():
    import json

    import httpx

    from agent.sec.tools import safely

    async def failing():
        request = httpx.Request(
            "GET",
            "https://data.sec.gov/submissions/example.json?private=value",
            headers={"Authorization": "secret"},
        )
        response = httpx.Response(403, request=request)
        response.raise_for_status()

    result = json.loads(asyncio.run(safely(failing())))
    assert result["http_status"] == 403
    assert result["retryable"] is False
    assert result["host"] == "data.sec.gov"
    assert "secret" not in json.dumps(result)
    assert "private" not in json.dumps(result)


def test_variable_annual_range_and_supported_forms():
    rows = [
        observation(start=f"{year}-01-01", end=f"{year}-12-31", val=year)
        for year in range(2020, 2026)
    ]
    rows += [{**rows[-1], "form": "20-F", "val": 99999, "filed": "2027-01-01"}]
    for years in (1, 2, 3, 5):
        result = annual_series(facts(rows), years=years)
        assert [r["year"] for r in result["rows"]] == list(range(2026 - years, 2026))
        assert all(r["value"] != 99999 for r in result["rows"])
    assert len(annual_series(facts(rows))["rows"]) == 3
    excluded = annual_series(facts(rows), years=3, exclude_years=[2024])
    assert [r["year"] for r in excluded["rows"]] == [2023, 2025]
    assert excluded["rows"][-1]["growth_percent"] is None
