import json

import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import ValidationError

from domains.tenk.a2ui_report import ReportError, generate_report, prepare_report_source
from domains.tenk.a2ui_report_plan import ReportPlan, plan_report
from graph.primary_graphs.a2ui_demo.contract import ContractError, validate_operations
from graph.primary_graphs.sec_a2ui.surface import render_surface, validate_action
from tests.test_sec_a2ui_workflow import ACCESSION, CIK, QUOTE, action, graph


class Model(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def tool_result(name, value):
    return AIMessage(content="", tool_calls=[{"id": name, "name": name, "args": value}])


@pytest.mark.parametrize("value", [
    {"sections": []},
    {"sections": [{"section": "risks", "presentation": "chart"}]},
    {"sections": [{"section": "other", "presentation": "cards"}]},
    {"sections": [{"section": "risks", "presentation": "cards"}] * 2},
])
def test_plan_rejects_unbounded_or_unsupported_ui(value):
    with pytest.raises(ValidationError):
        ReportPlan.model_validate(value)


@pytest.mark.asyncio
async def test_plan_retries_invalid_output_then_accepts_requested_table():
    value = {"sections": [{"section": "risks", "presentation": "table"}]}
    model = Model(responses=[tool_result("ReportPlan", {"sections": []}), tool_result("ReportPlan", value)])
    assert (await plan_report(model, "위험만 표로")).model_dump() == value
    with pytest.raises(ReportError):
        await plan_report(Model(responses=[tool_result("ReportPlan", {"sections": []})]), "위험만")


@pytest.mark.asyncio
async def test_focused_report_rejects_unrequested_claims_and_keeps_citation_checks():
    source = prepare_report_source("ITEM 1. BUSINESS\n" + QUOTE, "10-K")
    claim = {"analysis": "클라우드 사업입니다.", "citations": [{"evidence_id": "E1", "quote": QUOTE}]}
    full = {"summary": [claim], "business": [], "financials": [], "risks": []}
    empty = {key: [] for key in full}
    model = Model(responses=[tool_result("FilingReport", full), tool_result("FilingReport", empty)])
    result = await generate_report(model, source, request="위험만", sections=["risks"])
    assert result.model_dump() == empty  # No supported risk evidence is a visible empty result.
    bad = {**empty, "risks": [{"analysis": "위험", "citations": [{"evidence_id": "E1", "quote": "This invented quote must never be displayed."}]}]}
    with pytest.raises(ReportError):
        await generate_report(Model(responses=[tool_result("FilingReport", bad)]), source, request="위험만", sections=["risks"])


@pytest.mark.asyncio
async def test_stages_remove_hidden_actions_and_search_clears_report():
    workflow = graph()
    config = {"configurable": {"thread_id": "hybrid-stages"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    tree = next(iter(result["surfaces"].values()))["components"]
    assert "companies" in tree and "filings" not in tree and "report" not in tree
    old_company_action = action(result, "company-select", cik=CIK)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": old_company_action}, config)
    tree = next(iter(result["surfaces"].values()))["components"]
    assert "companies" not in tree and "filings" in tree and "report-button" not in tree
    with pytest.raises(ContractError):
        validate_action(old_company_action, result["surfaces"])
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    old_report_action = action(result, "report-button")
    assert "report-request" in next(iter(result["surfaces"].values()))["components"]
    result = await workflow.ainvoke({"messages": [], "a2ui_action": old_report_action}, config)
    assert result["sec"]["report_plan"]["sections"]
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "change-filing")}, config)
    assert "report" not in result["sec"] and "filing" not in result["sec"]
    tree = next(iter(result["surfaces"].values()))["components"]
    assert "filing-table" in tree and "report-request" not in tree
    with pytest.raises(ContractError):
        validate_action(old_report_action, result["surfaces"])
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "report-button")}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "search-button", query="DEMO")}, config)
    assert "report" not in result["sec"] and "filing" not in result["sec"]
    with pytest.raises(ContractError):
        validate_action(old_report_action, result["surfaces"])


def test_empty_filing_results_show_filters_but_no_dead_selectors_or_report():
    operations = render_surface("empty", {"company": {"cik": CIK, "name": "Demo"}, "filings": {"items": []}}, create=True)
    surface = validate_operations("sec", operations)["empty"]
    tree = surface["components"]
    assert "filter-button" in tree
    assert not {"filing-select", "filing-choice", "filing-table", "report", "report-button"} & tree.keys()
    assert "조건에 맞는 공시가 없습니다" in tree["filing-status"]["text"]


@pytest.mark.parametrize("presentation,expected", [("cards", "Card"), ("table", "Table"), ("accordion", "Accordion")])
def test_model_plan_compiles_only_requested_section_and_keeps_exact_citations(presentation, expected):
    claim = {"analysis": "요청한 위험 분석", "citations": [{"evidence_id": "E1", "quote": QUOTE}]}
    state = {"report": {"risks": [claim]}, "report_plan": {"sections": [{"section": "risks", "presentation": presentation}]}, "report_source_label": "CIK · accession · SHA-256", "report_request": "위험만"}
    surface = validate_operations("sec", render_surface("report", state, create=True))["report"]
    serialized = json.dumps(surface, ensure_ascii=False)
    assert QUOTE in serialized and "[E1]" in serialized
    assert "사업 분석" not in serialized and "핵심 요약" not in serialized
    assert any(item["component"] == expected and item["id"].startswith("report-risks") for item in surface["components"].values())


@pytest.mark.asyncio
async def test_selected_filing_chat_runs_focused_report_and_limits_request(monkeypatch):
    from graph.primary_graphs.sec_a2ui import workflow as module

    async def select_plan(model, request):
        assert request == "핵심만 카드로"
        return ReportPlan.model_validate({"sections": [{"section": "summary", "presentation": "cards"}]})

    monkeypatch.setattr(module, "plan_report", select_plan)
    workflow = graph()
    config = {"configurable": {"thread_id": "hybrid-chat"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    with pytest.raises(ContractError):
        validate_action(action(result, "report-button", request="x" * 501), result["surfaces"])
    result = await workflow.ainvoke({"messages": [HumanMessage(content="핵심만 카드로")]}, config)
    assert result["sec"]["company"]["cik"] == CIK
    assert result["sec"]["report_request"] == "핵심만 카드로"
    assert result["sec"]["report_plan"]["sections"] == [{"section": "summary", "presentation": "cards"}]
