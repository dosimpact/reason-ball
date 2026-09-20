from datetime import UTC, datetime

import httpx
import pytest
from ag_ui.core import RunAgentInput, UserMessage
from ag_ui_langgraph import LangGraphAgent
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from domains.tenk.sec_client import SecClient
from graph.primary_graphs.a2ui_demo.contract import ContractError
from graph.primary_graphs.sec_a2ui import workflow as sec_workflow
from graph.primary_graphs.sec_a2ui.surface import validate_action
from graph.primary_graphs.sec_a2ui.workflow import build_sec_graph

CIK = "0000320193"
ACCESSION = "0000320193-25-000079"
QUOTE = "The company provides cloud services to enterprise customers."


class ReportModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def graph(failures=None):
    def handler(request):
        assert request.method == "GET"
        if failures and failures.get("path") == request.url.path:
            return httpx.Response(503, text="private upstream diagnostics")
        if request.url.path.endswith("/content"):
            return httpx.Response(200, text=f"<h1>ITEM 1. BUSINESS</h1><p>{QUOTE}</p>")
        if request.url.path.endswith("/companies"):
            items = [{"cik": CIK, "name": "Fixture Company", "ticker": "DEMO"}]
        else:
            assert request.url.params["cik"] == CIK
            items = [{"cik": CIK, "accessionNo": ACCESSION, "formType": "10-K", "filingDate": "2025-10-31", "status": "downloaded"}]
        return httpx.Response(200, json={"items": items, "pagination": {"page": 1, "totalItems": 1, "hasNextPage": False}})

    report = {"summary": [{"analysis": "클라우드 서비스를 제공합니다.", "citations": [{"evidence_id": "E1", "quote": QUOTE}]}], "business": [], "financials": [], "risks": []}
    model = ReportModel(responses=[AIMessage(content="", tool_calls=[{"name": "FilingReport", "id": "report", "args": report}])])
    return build_sec_graph(SecClient(transport=httpx.MockTransport(handler)), model)


def action(result, component, **inputs):
    surface_id, surface = next(iter(result["surfaces"].items()))
    event = surface["components"][component]["action"]["event"]
    return {"surfaceId": surface_id, "sourceComponentId": component, "name": event["name"], "context": {**event["context"], **inputs}}


@pytest.mark.asyncio
async def test_company_filing_report_round_trip_keeps_one_surface_and_valid_citations(monkeypatch):
    class Clock:
        current = datetime(2026, 9, 21, 0, 0, tzinfo=UTC)

        @classmethod
        def now(cls, timezone):
            return cls.current

    original_generate = sec_workflow.generate_report

    async def generate_later(model, source):
        Clock.current = datetime(2026, 9, 21, 0, 2, tzinfo=UTC)
        return await original_generate(model, source)

    monkeypatch.setattr(sec_workflow, "datetime", Clock)
    monkeypatch.setattr(sec_workflow, "generate_report", generate_later)
    workflow = graph()
    config: RunnableConfig = {"configurable": {"thread_id": "sec-roundtrip"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    original_id = next(iter(result["surfaces"]))
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "report-button")}, config)
    assert list(result["surfaces"]) == [original_id]
    assert result["sec"]["report"]["summary"][0]["citations"][0]["quote"] == QUOTE
    assert ACCESSION in result["sec"]["report_source_label"]
    assert "발췌" in result["sec"]["report_source_label"]
    assert "원문 조회 2026-09-21T00:00:00+00:00" in result["sec"]["report_source_label"]
    assert "00:02:00" not in result["sec"]["report_source_label"]
    assert not (await workflow.aget_state({"configurable": {"thread_id": "other"}})).values


@pytest.mark.asyncio
async def test_old_surface_actions_and_unknown_company_cannot_change_selection():
    workflow = graph()
    config: RunnableConfig = {"configurable": {"thread_id": "sec-stale"}}
    initial = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    old_action = action(initial, "company-select", cik=CIK)
    current = await workflow.ainvoke({"messages": [], "a2ui_action": old_action}, config)
    with pytest.raises(ContractError, match="Stale"):
        validate_action(old_action, current["surfaces"])
    current = await workflow.ainvoke({"messages": [], "a2ui_action": action(current, "company-select", cik="0000000001")}, config)
    assert current["sec"]["company"]["cik"] == CIK
    assert "없는 회사" in current["sec"]["notice"]


@pytest.mark.asyncio
async def test_initial_surface_is_delivered_as_a_tool_result_event():
    agent = LangGraphAgent(name="a2ui-sec", graph=graph())
    value = RunAgentInput(thread_id="sec-wire", run_id="first", state={}, messages=[UserMessage(id="query", role="user", content="DEMO")], tools=[], context=[], forwarded_props={})
    events = [event async for event in agent.run(value)]
    assert any(event.type == "TOOL_CALL_RESULT" and "a2ui_operations" in event.model_dump_json() for event in events)


@pytest.mark.asyncio
async def test_upstream_failure_preserves_selection_and_recovers_in_same_thread():
    failures = {}
    workflow = graph(failures)
    config: RunnableConfig = {"configurable": {"thread_id": "sec-recovery"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    original_surface = next(iter(result["surfaces"]))
    failures["path"] = f"/api/sec/filings/{CIK}/{ACCESSION}/content"
    failed = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "report-button")}, config)
    assert "report" not in failed["sec"]
    assert failed["sec"]["filing"]["accessionNo"] == ACCESSION
    assert failed["sec"]["notice"] != result["sec"]["notice"]
    assert "private upstream diagnostics" not in str(failed)
    assert failed["surfaces"][original_surface]["components"]["report-button"]["disabled"] is False
    failures.clear()
    recovered = await workflow.ainvoke({"messages": [], "a2ui_action": action(failed, "report-button")}, config)
    assert recovered["sec"]["report"]["summary"]
    assert list(recovered["surfaces"]) == [original_surface]


@pytest.mark.asyncio
async def test_model_failure_can_retry_without_losing_selected_filing(monkeypatch):
    workflow = graph()
    config: RunnableConfig = {"configurable": {"thread_id": "sec-model-recovery"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    original_generate = sec_workflow.generate_report

    async def unavailable(model, source):
        raise RuntimeError("simulated provider unavailable")

    monkeypatch.setattr(sec_workflow, "generate_report", unavailable)
    with pytest.raises(RuntimeError, match="simulated provider unavailable"):
        await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "report-button")}, config)
    snapshot = await workflow.aget_state(config)
    assert snapshot.values["sec"]["filing"]["accessionNo"] == ACCESSION
    assert "report" not in snapshot.values["sec"]
    monkeypatch.setattr(sec_workflow, "generate_report", original_generate)
    recovered = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "report-button")}, config)
    assert recovered["sec"]["report"]["summary"]
