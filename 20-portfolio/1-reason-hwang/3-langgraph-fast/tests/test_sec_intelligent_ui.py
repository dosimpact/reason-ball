import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from domains.sec_chat.answer import (
    Answer,
    Finding,
    evidence_for_question,
    render_program,
    validate_answer,
)
from domains.sec_chat.source import FilingSourceClient, prepare_source, referenced_pages
from domains.tenk.sec_client import SecReadError
from server.sec_chat.router import router

FILING = {"cik": "0000320193", "accessionNo": "0000320193-25-000079", "filingDate": "2025-10-31", "formType": "10-K", "status": "downloaded"}
HTML = """<html><body><h1>PART I</h1><h2>ITEM 1. Business</h2><h3>Products</h3><p>We sell devices and services to customers worldwide.</p><h2>ITEM 1A. Risk Factors</h2><p>Supply constraints may affect our results.</p><h2>ITEM 3. Legal Proceedings</h2><p>Litigation outcomes remain uncertain.</p><h1>PART II</h1><h2>ITEM 7. Management Discussion</h2><p>Revenue increased during the fiscal year.</p><h2>ITEM 8. Financial Statements</h2><p>Net sales were 100 million dollars in 2025.</p><h2>ITEM 9. Changes</h2><p>None</p></body></html>"""

def test_source_has_separate_items_and_provenance():
    source = prepare_source(HTML, FILING, "2026-10-21")
    assert list(source["sections"]) == ["1", "1A", "3", "7", "8"]
    assert "Supply constraints" not in source["sections"]["1"]
    assert source["missingItems"] == []
    assert source["sourceUrl"].startswith("https://www.sec.gov/Archives/edgar/data/320193/")
    assert len(source["sha256"]) == 64

def test_quotes_must_belong_to_correct_item():
    source = prepare_source(HTML, FILING, None)
    answer = Answer(title="사업 분석", findings=[Finding(item="1", heading="제품", summary="기기와 서비스를 판매합니다.", quote="We sell devices and services to customers worldwide.")], limitations="fixture")
    validate_answer(answer, source["sections"])
    program = render_program(answer, source, source["sections"])
    assert "Checkbox($showEvidence" in program
    assert "최신성 미확인" in program
    answer.findings[0].item = "8"
    with pytest.raises(ValueError, match="인용문"):
        validate_answer(answer, source["sections"])

def test_evidence_budget_keeps_small_items_and_reports_missing():
    source = prepare_source(HTML, FILING, None)
    assert evidence_for_question(source, ["1"], "소제목") == {"1": source["sections"]["1"]}
    with pytest.raises(ValueError, match="원문이 없습니다"):
        evidence_for_question(source, ["9"], "test")

@pytest.mark.asyncio
async def test_latest_pending_does_not_fall_back_to_old_download():
    rows = [{**FILING, "filingDate": "2026-10-20", "status": "pending"}, {**FILING, "filingDate": "2025-10-31"}]
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"items": rows, "pagination": {}}))
    with pytest.raises(SecReadError, match="최신"):
        await FilingSourceClient(transport=transport).prepare(FILING["cik"], refresh=False)

@pytest.mark.asyncio
async def test_sync_requires_completed_and_zero_failures():
    for payload in [{"companiesProcessed": 1, "failed": 1}, None]:
        text = "event: completed\ndata: " + json.dumps(payload) + "\n\n" if payload else ": heartbeat\n\n"
        transport = httpx.MockTransport(lambda request, text=text: httpx.Response(200, text=text))
        with pytest.raises(SecReadError):
            await FilingSourceClient(transport=transport).synchronize(FILING["cik"])

def test_api_rejects_invalid_identity_and_unknown_thread():
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        assert client.post("/api/sec-chat/prepare", json={"cik": "../escape"}).status_code == 422
        assert client.post("/api/sec-chat/chat", json={"threadId": "a" * 32, "message": "Item 1"}).status_code == 404


def test_repeated_running_headers_preserve_entire_item():
    text = "Item 1. Business\nProducts and customers.\nItem 1\nSupply and distribution.\nItem 1\nHuman capital details.\nItem 1A. Risks\nRisk details.\nItem 8. Financial Statements\nFirst note.\nItem 8\nLast note.\nItem 9. Changes"
    source = prepare_source(text, FILING, None)
    assert "Products and customers" in source["sections"]["1"]
    assert "Human capital details" in source["sections"]["1"]
    assert "First note" in source["sections"]["8"]
    assert "Last note" in source["sections"]["8"]
    assert "Risk details" not in source["sections"]["1"]


def test_evidence_ids_resolve_to_exact_source_and_reject_cross_item():
    from domains.sec_chat.answer import (
        DraftAnswer,
        DraftFinding,
        evidence_packets,
        resolve_draft,
    )
    source = prepare_source(HTML, FILING, None)
    packets = evidence_packets(source["sections"])
    draft = DraftAnswer(title="Business", findings=[DraftFinding(item="1", heading="Products", summary="기기와 서비스를 판매합니다.", evidence_id="1:1")], limitations="")
    answer = resolve_draft(draft, packets)
    validate_answer(answer, source["sections"])
    assert answer.findings[0].quote == packets["1:1"]["text"]
    draft.findings[0].evidence_id = "8:1"
    with pytest.raises(ValueError, match="evidence_id"):
        resolve_draft(draft, packets)


@pytest.mark.asyncio
async def test_exact_ticker_is_not_hidden_by_name_search_page():
    requests = []
    def respond(request):
        requests.append(dict(request.url.params))
        return httpx.Response(200, json={"items": [{"cik": "0001326801", "ticker": "META", "name": "Meta Platforms, Inc."}], "pagination": {}})
    result = await FilingSourceClient(transport=httpx.MockTransport(respond)).companies("meta")
    assert result["items"][0]["ticker"] == "META"
    assert requests == [{"ticker": "META", "page": "1", "pageSize": "10"}]


@pytest.mark.asyncio
async def test_reviewed_successor_preserves_actual_filing_identity():
    predecessor_filing = {**FILING, "cik": "0000034088"}
    def respond(request):
        if request.url.path.endswith("/content"):
            return httpx.Response(200, text=HTML)
        rows = [predecessor_filing] if request.url.params.get("cik") == "0000034088" else []
        return httpx.Response(200, json={"items": rows, "pagination": {}})
    source = await FilingSourceClient(transport=httpx.MockTransport(respond)).prepare("0002115436", refresh=False)
    assert source["filing"]["cik"] == "0000034088"
    assert source["requestedCik"] == "0002115436"
    assert "법인 재편" in source["issuerNote"]
    assert source["checkedAt"] is None


def test_incorporated_pages_use_consecutive_footers_not_table_values():
    text = """Item 7. Management Discussion
Management analysis appears on pages 46–47.
Item 8. Financial Statements
Statements appear on pages 48–49.
Item 9. Changes
Report/2025 Form 10-K
45
Revenue was 100 million dollars.
46
Report/2025 Form 10-K
Outlook and management policies.
153
Report/2025 Form 10-K
47
Financial statement assets 300 million.
48
Report/2025 Form 10-K
Financial statement accounting notes.
Report/2025 Form 10-K
49
Other information."""
    pages = referenced_pages(text)
    assert set(pages) == {46, 47, 48, 49}
    source = prepare_source(text, FILING, None)
    assert "Revenue was 100" in source["sections"]["7"]
    assert "management policies" in source["sections"]["7"]
    assert "assets 300" in source["sections"]["8"]
    assert "accounting notes" in source["sections"]["8"]


def test_financial_statements_in_item_15_are_followed_from_item_8():
    text = """Item 8. Financial Statements
Our Consolidated Financial Statements are included in this Annual Report.
Item 9. Changes
None.
Item 15. Exhibits and Financial Statement Schedules
Report of Independent Registered Public Accounting Firm
Audited Consolidated Statements of Income
Revenue was 100 million dollars in 2025.
Notes to the Consolidated Financial Statements
Accounting policy details.
Schedule II Valuation and Qualifying Accounts
Schedule details.
Item 16. Summary
None."""
    source = prepare_source(text, FILING, None)
    assert "Revenue was 100" in source["sections"]["8"]
    assert "Accounting policy" in source["sections"]["8"]
    assert "Schedule details" not in source["sections"]["8"]
    assert "15" not in source["sections"]


def test_separate_financial_section_uses_body_headings_not_toc():
    text = """Item 7. Management Discussion
Reference is made to MD&A in the Financial Section of this report.
Item 8. Financial Statements
Reference is made to the Financial Section, including Frequently Used Terms.
Item 9. Changes
None.
Item 16. Summary
Financial Section
Management’s Discussion and Analysis of Financial Condition and Results of Operations
36
FREQUENTLY USED TERMS
Capital employed definition.
MANAGEMENT’S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS
Revenue rose by 10%.
MANAGEMENT’S REPORT ON INTERNAL CONTROL OVER FINANCIAL REPORTING
Controls report.
REPORT OF INDEPENDENT REGISTERED PUBLIC ACCOUNTING FIRM
Audited net income was 100 million dollars.
INDEX TO EXHIBITS
Exhibit contracts."""
    source = prepare_source(text, FILING, None)
    assert "Revenue rose" in source["sections"]["7"]
    assert "Controls report" not in source["sections"]["7"]
    assert "Audited net income" in source["sections"]["8"]
    assert "Capital employed definition" in source["sections"]["8"]
    assert "Exhibit contracts" not in source["sections"]["8"]


@pytest.mark.asyncio
async def test_graph_repairs_cross_item_ids_with_specific_feedback():
    from domains.sec_chat.answer import DraftAnswer, DraftFinding
    from graph.primary_graphs.sec_intelligent_ui.workflow import Intent, build_graph

    class Model:
        calls = 0

        def with_structured_output(self, schema):
            self.schema = schema
            return self

        async def ainvoke(self, messages):
            if self.schema is Intent:
                return Intent(items=["7", "8"], task="재무 실적")
            self.calls += 1
            if self.calls == 2:
                feedback = json.loads(messages[-1].content)
                assert "7:1: requested Item 8, evidence Item 7" in feedback["validationError"]
                assert feedback["invalidDraft"]["findings"][1]["evidence_id"] == "7:1"
            return DraftAnswer(title="재무 실적", findings=[
                DraftFinding(item="7", heading="실적", summary="매출이 증가했습니다.", evidence_id="7:1"),
                DraftFinding(item="8", heading="재무제표", summary="2025년 순매출은 100백만 달러입니다.", evidence_id="7:1" if self.calls == 1 else "8:1"),
            ], limitations="")

    model = Model()
    result = await build_graph(model).ainvoke({
        "source": prepare_source(HTML, FILING, None), "question": "Item 7, 8", "history": [],
        "intent": {}, "evidence": {}, "answer": {}, "program": "",
    })
    assert model.calls == 2
    assert result["answer"]["findings"][1]["quote"].startswith("ITEM 8")
