"""Pure checks for the real-HTTP starter validation harness."""
import pytest

from scripts.validate_sec_starters import (
    evaluate_chat,
    evaluate_collection,
    evaluate_collection_tools,
    load_starters,
    verify_company,
)


def test_load_exact_committed_starters():
    cases = load_starters()
    assert len(cases) == 24
    assert cases[0]["label"] == "10-K 읽는 순서"
    assert cases[-1]["label"] == "수집 범위 먼저 설명"
    assert all(case["prompt"].strip() for case in cases)


def test_rejects_partial_source(tmp_path):
    source = tmp_path / "starters.ts"
    source.write_text('{ displayText: "label", prompt: "prompt" }')
    with pytest.raises(ValueError, match="exactly 24"):
        load_starters(source)


def test_company_and_evidence_require_expected_provenance():
    verify_company({"ticker": "AAPL", "cik": "0000320193"}, 1)
    with pytest.raises(ValueError, match="CIK"):
        verify_company({"ticker": "NVDA", "cik": "1045810"}, 1)
    answer = {"program": "root = Col([])", "evidence": {"filing": {"cik": "320193", "accessionNo": "abc", "filingDate": "2026-01-01"}, "sourceUrl": "https://www.sec.gov/", "findings": [{"item": "1", "quote": "Exact filing text"}]}, "followUps": ["다음 질문", "다음 질문2", "다음 질문3"]}
    evaluate_chat(answer, 1)
    answer["evidence"]["findings"] = []
    with pytest.raises(ValueError, match="quoted"):
        evaluate_chat(answer, 1)


def test_item_and_exact_metadata_evaluation():
    answer = {"program": "2026-01-01 abc 저장 기준", "evidence": {"filing": {"cik": "320193", "accessionNo": "abc", "filingDate": "2026-01-01"}, "sourceUrl": "https://www.sec.gov/", "findings": [{"item": "1", "quote": "Exact text"}]}}
    evaluate_chat(answer, 2)
    answer["program"] = "2025-01-01 abc 저장 기준"
    with pytest.raises(ValueError, match="filingDate"):
        evaluate_chat(answer, 2)
    with pytest.raises(ValueError, match="required Item"):
        evaluate_chat(answer, 9)


def test_collection_checks_scope_and_non_boolean_counters():
    result = {"action": "reply", "collection": {"cik": "320193", "years": 1, "since": None, "companiesProcessed": 1, "filingsSynced": 2, "downloaded": 2, "failed": 0, "checkedAt": "2026-11-17T00:00:00Z"}}
    evaluate_collection(result, 20)
    result["collection"]["failed"] = False
    with pytest.raises(ValueError, match="counter"):
        evaluate_collection(result, 20)
    result["collection"]["failed"] = 0
    result["collection"]["years"] = 2
    with pytest.raises(ValueError, match="scope"):
        evaluate_collection(result, 20)


def test_rejects_another_filing_from_same_company():
    filing = {"cik": "0000320193", "accessionNo": "current", "filingDate": "2026-11-03"}
    result = {"program": "root = Text(\"answer\")", "evidence": {"filing": {**filing, "accessionNo": "older"}, "sourceUrl": "https://www.sec.gov/", "findings": [{"item": "1", "quote": "Original"}]}}
    with pytest.raises(ValueError, match="identity differs"):
        evaluate_chat(result, 1, {"filing": filing})


def test_actual_collection_tool_scope_is_required():
    args = {"ciks": ["0000320193"], "tickers": [], "years": 1, "since": None, "downloadDocuments": True, "refreshArchive": False}
    record = {"events": [{"name": "sec.activity", "value": {"kind": "tool", "label": "SEC 도구 · sync_sec_company_filings", "status": "completed", "arguments": args}}]}
    evaluate_collection_tools(record, 20)
    args["years"] = 2
    with pytest.raises(ValueError, match="period scope"):
        evaluate_collection_tools(record, 20)
    record["events"] = []
    with pytest.raises(ValueError, match="one completed"):
        evaluate_collection_tools(record, 20)
