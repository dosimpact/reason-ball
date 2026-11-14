from dataclasses import replace
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from domains.tenk.document_structure import (
    ITEM_CODES,
    FilingMetadata,
    display_text,
    parse_document,
    sanitize_html,
)
from scripts.tenk_model1_sample import SAMPLES

META = FilingMetadata(
    "0001834584",
    "Coupang",
    "CPNG",
    "0001834584-26-000024",
    "2026-02-26",
    "2025-12-31",
    "https://www.sec.gov/example.htm",
)


def document(body: str) -> bytes:
    return (
        "<html><body><ix:header><ix:hidden>"
        '<ix:nonNumeric name="dei:EntityCentralIndexKey">0001834584</ix:nonNumeric>'
        '<ix:nonNumeric name="dei:DocumentType">10-K</ix:nonNumeric>'
        '<ix:nonNumeric name="dei:DocumentPeriodEndDate">December 31, 2025</ix:nonNumeric>'
        "</ix:hidden></ix:header>" + body + "</body></html>"
    ).encode()


def test_excludes_toc_preserves_table_and_unwraps_inline_fact():
    raw = document(
        '<div><a href="#actual">Item 1. Business</a></div>'
        '<div id="actual">Item 1. Business</div><p>A <b>retailer</b>.</p>'
        '<div>Item 1A. Risk Factors</div><table><tr><th>Revenue</th><td colspan="2"><ix:nonFraction>26,312</ix:nonFraction></td></tr></table>'
        "<div>SIGNATURES</div><p>Director</p>"
    )
    result = parse_document(raw, META)
    items = result["nodes"][2:]
    assert [item["properties"]["itemCode"] for item in items] == ["1", "1A"]
    assert "26,312" in items[1]["properties"]["text"]
    assert "Revenue\t26,312" in items[1]["properties"]["text"]
    assert '<td colspan="2">26,312</td>' in items[1]["properties"]["displayHtml"]
    assert "ix:" not in items[1]["properties"]["displayHtml"]
    assert "Director" not in items[1]["properties"]["text"]
    assert result["summary"]["excludedTrailingCharacters"] > 0
    assert [edge["type"] for edge in result["relationships"]] == [
        "FILED",
        "HAS_ITEM",
        "HAS_ITEM",
    ]


@pytest.mark.parametrize(
    "body",
    [
        "<p>No Items</p>",
        "<div>Item 1. Business</div><div>Item 1. Business again</div>",
        "<div>Item 1. Business</div><div>Item 8. Financials</div><div>Item 7. MD&amp;A</div>",
    ],
)
def test_rejects_ambiguous_boundaries(body):
    with pytest.raises(ValueError, match="boundaries"):
        parse_document(document(body), META)


def test_rejects_identity_mismatch_and_incomplete_strict_sample():
    raw = document("<div>Item 1. Business</div>")
    with pytest.raises(ValueError, match="Metadata does not match"):
        parse_document(raw, replace(META, cik="0000320193"))
    with pytest.raises(ValueError, match="Incomplete sample"):
        parse_document(raw, META, expected_codes=ITEM_CODES)


def test_sanitizer_removes_active_and_hidden_content_preserves_inline_text():
    dirty = """<div onclick="alert(1)" style="text-align:right; background-image:url(https://bad);width:50%">
      <script>alert(1)</script><iframe src="https://bad"></iframe>
      <ix:header><ix:hidden><span>secret context</span></ix:hidden></ix:header>
      <span style="display:none">hidden duplicate</span><xbrli:context>context</xbrli:context>
      <a href="javascript:alert(1)">visible</a><img src="https://bad">
      <ix:nonFraction><span>26</span>,<span>312</span></ix:nonFraction></div>"""
    clean = sanitize_html(dirty)
    assert "26,312" in display_text(clean)
    assert "visible" in display_text(clean)
    assert "text-align:right" in clean and "width:50%" in clean
    for forbidden in [
        "onclick",
        "<script",
        "<iframe",
        "<img",
        "javascript:",
        "https://bad",
        "secret context",
        "hidden duplicate",
        "xbrli:",
        "ix:",
    ]:
        assert forbidden not in clean


@pytest.mark.parametrize("filename,metadata", SAMPLES)
def test_supplied_reports_when_available(filename, metadata):
    path = Path(__file__).resolve().parents[2] / "docs/human-docs/1-sec-분석" / filename
    if not path.exists():
        pytest.skip("User-provided report is not part of committed fixtures")
    result = parse_document(path.read_bytes(), metadata, expected_codes=ITEM_CODES)
    assert len(result["nodes"]) == 25
    assert len(result["relationships"]) == 24
    assert result["summary"]["excludedTrailingCharacters"] > 0
    items = {
        node["properties"]["itemCode"]: node["properties"]
        for node in result["nodes"][2:]
    }
    assert len(items["1"]["text"]) > 1000
    assert len(items["1A"]["text"]) > 1000
    assert "<table" in items["15" if metadata.ticker == "NVDA" else "8"]["displayHtml"]
    assert len(items["16"]["text"]) < 2000
    for item in items.values():
        soup = BeautifulSoup(item["displayHtml"], "html.parser")
        assert not soup.find(["script", "iframe", "img"])
        assert not any(":" in tag.name for tag in soup.find_all(True))
        assert item["text"] == display_text(item["displayHtml"])
    if metadata.ticker == "CPNG":
        assert items["8"]["text"].count("26,312") >= 1
        assert "Executive Compensation" in items["11"]["title"]


def test_preview_resolves_cross_item_links_without_changing_payload(tmp_path):
    from copy import deepcopy

    from scripts.tenk_model1_sample import export_previews

    payload = {
        "nodes": [
            {
                "labels": ["Item"],
                "properties": {
                    "itemCode": "1",
                    "title": "Business",
                    "displayHtml": '<p id="local">Business</p><a href="#local">Here</a><a href="#financials">Financials</a><a href="#toc">Contents</a>',
                },
            },
            {
                "labels": ["Item"],
                "properties": {
                    "itemCode": "8",
                    "title": "Financials",
                    "displayHtml": '<p id="financials">Revenue</p>',
                },
            },
        ]
    }
    original = deepcopy(payload)
    export_previews(tmp_path, payload, META)
    standalone = BeautifulSoup(
        (tmp_path / "cpng/item-1.html").read_text(), "html.parser"
    )
    combined = BeautifulSoup(
        (tmp_path / "cpng/preview.html").read_text(), "html.parser"
    )
    assert standalone.find("a", href="#local") is not None
    assert standalone.find("a", href="preview.html#financials") is not None
    assert combined.find("a", href="#financials") is not None
    assert standalone.find("a", href="#toc") is None
    assert combined.find("a", href="#toc") is None
    assert "Contents" in combined.get_text()
    assert payload == original
