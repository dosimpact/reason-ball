"""SEC 수집 서브그래프의 성공 경로와 보관본 재사용을 네트워크 없이 검증합니다."""

import asyncio

from agent.sec import client, service, storage


def test_collect_subgraph_downloads_original_and_read_section(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    filing = {
        "id": "0000000001-26-000001",
        "cik": "0000000001",
        "company": "Fixture company",
        "form": "10-K",
        "report_date": "2025-12-31",
        "filed": "2026-02-01",
        "url": "https://www.sec.gov/Archives/fixture.htm",
    }
    calls = []

    async def discover(*args):
        return [filing]

    async def fetch(url, **kwargs):
        calls.append(url)
        return (
            "<h2>Item 1. Business</h2><p>"
            + ("Products and services. " * 40)
            + "</p><h2>Item 1A. Risk Factors</h2><p>"
            + ("Export and supply risk. " * 40)
            + "</p>"
        )

    monkeypatch.setattr(client, "list_filings", discover)
    monkeypatch.setattr(client, "fetch", fetch)
    result = asyncio.run(service.collect("1"))
    assert result["downloaded"] == 1 and result["failed"] == 0
    assert result["reused"] == 0
    assert storage.get_filing(filing["id"])["status"] == "downloaded"
    section = service.read_section(filing["id"], "Item 1A", limit=200)
    assert "Export and supply" in section["text"]
    assert section["next_offset"] == 200 and section["url"] == filing["url"]
    result = asyncio.run(service.collect("1"))
    assert result["filings"][0]["cached"] is True and len(calls) == 1
    assert result["reused"] == 1


def test_report_scope_and_quarter_count(monkeypatch):
    import pytest

    columns = {
        key: []
        for key in (
            "accessionNumber",
            "form",
            "primaryDocument",
            "reportDate",
            "filingDate",
        )
    }
    for index, year in enumerate(range(2025, 2021, -1)):
        for quarter, end in enumerate(("09-30", "06-30", "03-31")):
            columns["accessionNumber"].append(
                f"0000000001-26-{index * 3 + quarter:06d}"
            )
            columns["form"].append("10-Q")
            columns["primaryDocument"].append("report.htm")
            columns["reportDate"].append(f"{year}-{end}")
            columns["filingDate"].append(f"{year}-11-01")
    company = {"cik": 1, "name": "Fixture", "filings": {"recent": columns}}

    async def fetch(*args, **kwargs):
        return company

    monkeypatch.setattr(client, "fetch", fetch)
    for years in (1, 2, 3):
        rows = asyncio.run(client.list_filings("1", years, "10-Q"))
        assert len(rows) == years * 3
        assert len({r["report_date"] for r in rows}) == years * 3
        assert all(r["form"] == "10-Q" for r in rows)
    for form in ("20-F", "8-K"):
        with pytest.raises(ValueError):
            asyncio.run(client.list_filings("1", 3, form))


def quarterly_html():
    return (
        "<h1>PART I — FINANCIAL INFORMATION</h1><p>Item 1. Financial statements</p>"
        "<p>3</p><h1>PART II — OTHER INFORMATION</h1><p>Item 1. Legal proceedings</p><p>9</p>"
        "<h1>PART I — FINANCIAL INFORMATION</h1><h2>ITEM 1. Financial statements</h2><p>"
        + "Quarterly financial results. " * 40
        + "</p><h2>Item 2. Management discussion</h2><p>"
        + "Management explains changes. " * 30
        + "</p><h1>PART II — OTHER INFORMATION</h1><h2>Item 1. Legal proceedings</h2><p>"
        + "Pending litigation. " * 20
        + "</p><h2>Item 1A. Risk factors</h2><p>"
        + "Quarterly risk updates. " * 20
        + "</p>"
    )


def test_quarterly_parts_survive_collection_and_ambiguous_read(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    filing = {
        "id": "quarter-fixture",
        "cik": "0000000001",
        "company": "Fixture company",
        "form": "10-Q/A",
        "report_date": "2026-03-31",
        "filed": "2026-05-01",
        "url": "https://www.sec.gov/Archives/quarter-fixture.htm",
    }
    calls = []

    async def fetch(url, **kwargs):
        calls.append(url)
        return quarterly_html()

    monkeypatch.setattr(client, "fetch", fetch)
    assert asyncio.run(service.collect_one(filing))["status"] == "downloaded"
    first = service.read_section(filing["id"], "Part I Item 1")
    second = service.read_section(filing["id"], "part ii item 1")
    assert (
        "Quarterly financial" in first["text"]
        and "Pending litigation" not in first["text"]
    )
    assert (
        "Pending litigation" in second["text"]
        and "Quarterly financial" not in second["text"]
    )
    assert second["section"] == "Part II Item 1"
    ambiguous = service.read_section(filing["id"], "Item 1")
    assert ambiguous["matching_sections"] == ["Part I Item 1", "Part II Item 1"]
    assert "text" not in ambiguous
    assert service.read_section(filing["id"], "Item 1A")["section"] == "Part II Item 1A"
    assert "PART II" not in service.read_section(filing["id"], "Part I Item 2")["text"]
    saved = storage.get_filing(filing["id"])
    for section in saved["sections"].values():
        assert saved["text"][section["offset"] :].lstrip().startswith(section["text"])
    assert asyncio.run(service.collect_one(filing))["cached"] is True
    assert len(calls) == 1

    # Legacy indexed reports are repaired from original text without redownloading.
    storage.save_filing(
        filing,
        "indexed",
        text=saved["text"],
        sections={"Item 1": saved["sections"]["Part I Item 1"]},
    )
    with storage.connection() as db:
        db.execute(
            "INSERT INTO passages(filing_id,section,text,embedding) VALUES(?,?,?,?)",
            (filing["id"], "Item 1", "stale index", b"old"),
        )
    repaired = storage.get_filing(filing["id"])
    assert repaired["status"] == "downloaded"
    assert "Part II Item 1" in repaired["sections"]
    assert repaired["text"] == saved["text"]
    with storage.connection() as db:
        assert db.execute("SELECT count(*) FROM passages").fetchone()[0] == 0
    assert len(calls) == 1
