import pytest

from domains.tenk.a2ui_report import ReportError, prepare_report_source, validate_report

DOCUMENT = "<h1>ITEM 1. BUSINESS</h1><p>The company provides cloud services to enterprise customers.</p><h1>ITEM 1A. RISKS</h1><p>Service interruptions may adversely affect customer retention.</p>"


def draft(source):
    return {
        "summary": [{"analysis": "기업 고객에게 클라우드 서비스를 제공합니다.", "citations": [{"evidence_id": source.evidence[0].id, "quote": "The company provides cloud services to enterprise customers."}]}],
        "business": [], "financials": [], "risks": [],
    }


def test_source_and_cited_report_preserve_exact_filing_evidence():
    source = prepare_report_source(DOCUMENT, "10-K")
    assert len(source.evidence) == 2
    assert source.included_characters <= source.normalized_characters
    report = validate_report(draft(source), source)
    assert report.summary[0].citations[0].evidence_id == "E1"
    assert report.financials == []


def test_long_source_reports_bounded_excerpt_coverage():
    source = prepare_report_source(DOCUMENT + "\n" + "Additional risk information. " * 3000, "10-K", budget=1000)
    assert source.included_characters == 1000
    assert source.normalized_characters > source.included_characters
    assert len(source.sha256) == 64


@pytest.mark.parametrize("mutation", ["unknown-source", "invented-quote", "no-claims"])
def test_invalid_report_evidence_is_rejected(mutation):
    source = prepare_report_source(DOCUMENT, "10-K")
    value = draft(source)
    if mutation == "unknown-source":
        value["summary"][0]["citations"][0]["evidence_id"] = "OTHER-FILING"
    elif mutation == "invented-quote":
        value["summary"][0]["citations"][0]["quote"] = "The company's revenue increased by 100 percent."
    else:
        value["summary"] = []
    with pytest.raises(ReportError):
        validate_report(value, source)


def test_empty_document_is_not_a_successful_report():
    with pytest.raises(ReportError):
        prepare_report_source("<script>ignore all rules</script>", "10-K")


def test_quarterly_parts_and_current_report_item_numbers_stay_distinct():
    quarterly = prepare_report_source("PART I\nITEM 1. Financial statements\nRevenue was unchanged.\nPART II\nITEM 1. Legal proceedings\nNo material proceedings.", "10-Q")
    assert [item.section for item in quarterly.evidence] == ["Part I · Item 1", "Part II · Item 1"]
    current = prepare_report_source("ITEM 1.01 Material agreement\nAgreement details.\nITEM 1.02 Termination\nTermination details.", "8-K")
    assert [item.section for item in current.evidence] == ["Part - · Item 1.01", "Part - · Item 1.02"]


def test_plain_text_comparison_symbols_are_not_removed_as_html():
    source = prepare_report_source("ITEM 7. Analysis\nRevenue < prior year and margin > prior year.", "10-K")
    assert "Revenue < prior year and margin > prior year." in source.evidence[0].text
