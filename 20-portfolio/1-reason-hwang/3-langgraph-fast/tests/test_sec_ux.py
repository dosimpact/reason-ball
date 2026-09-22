"""SEC-A2UI-12: direct actions, clear scope, recovery and report identity."""
import pytest
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from domains.tenk.a2ui_report_plan import ReportPlan
from graph.primary_graphs.a2ui_demo.contract import ContractError, validate_operations
from graph.primary_graphs.sec_a2ui.surface import render_surface, validate_action
from tests.test_sec_a2ui_workflow import ACCESSION, CIK, action, graph


@pytest.mark.asyncio
async def test_default_annual_scope_and_explicit_all_documents_are_reversible():
    requests = []
    workflow = graph(requests=requests)
    config: RunnableConfig = {"configurable": {"thread_id": "ux-scope"}}
    found = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    tree = next(iter(found["surfaces"].values()))["components"]
    assert "company-choice" not in tree and "company-table" not in tree
    with pytest.raises(ContractError):
        validate_action(action(found, "company-select", cik="0000000001"), found["surfaces"])
    listed = await workflow.ainvoke({"messages": [], "a2ui_action": action(found, "company-select")}, config)
    assert "status=downloaded" in requests[-1] and "formType=10-K" in requests[-1]
    tree = next(iter(listed["surfaces"].values()))["components"]
    assert "연간보고서 (10-K) · 분석 가능" in tree["filing-status"]["text"]
    assert "filing-choice" not in tree and "filing-table" not in tree
    full = await workflow.ainvoke({"messages": [], "a2ui_action": action(listed, "all-filings")}, config)
    assert full["sec"]["filters"] == {"status": "", "form": "", "since": ""}
    assert "status=" not in requests[-1] and "formType=" not in requests[-1]
    assert "목록을 열었습니다" in full["messages"][-1].content


@pytest.mark.asyncio
async def test_preset_analysis_keeps_selected_document_and_visible_identity(monkeypatch):
    from graph.primary_graphs.sec_a2ui import workflow as module

    async def plan(model, request):
        assert request == "핵심 요약만 카드로 정리해줘"
        return ReportPlan.model_validate({"sections": [{"section": "summary", "presentation": "cards"}]})

    monkeypatch.setattr(module, "plan_report", plan)
    workflow = graph()
    config: RunnableConfig = {"configurable": {"thread_id": "ux-preset"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select")}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select")}, config)
    assert "선택했습니다" in result["messages"][-1].content
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "summary-report")}, config)
    assert result["sec"]["filing"]["accessionNo"] == ACCESSION
    tree = next(iter(result["surfaces"].values()))["components"]
    assert "report-document" in tree["root"]["children"]
    assert "10-K" in tree["report-document"]["text"] and "2025-10-31" in tree["report-document"]["text"]
    assert tree["report-source"]["component"] == "Accordion"
    assert tree["report-fields"]["children"].index("report-source") > tree["report-fields"]["children"].index("report-summary-cards")


def test_unavailable_original_blocks_presets_and_direct_request_but_keeps_navigation():
    state = {"company": {"name": "Demo", "cik": CIK}, "filing": {"accessionNo": ACCESSION, "formType": "10-K", "status": "pending"}}
    surface = validate_operations("sec", render_surface("unavailable", state, create=True))["unavailable"]
    for id in ["summary-report", "risks-report", "full-report", "report-button"]:
        assert surface["components"][id]["disabled"] is True
    assert surface["components"]["change-filing"]["disabled"] is False
