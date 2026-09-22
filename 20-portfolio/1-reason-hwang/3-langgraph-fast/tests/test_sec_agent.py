"""SEC-A2UI-10: decisions, tool boundaries, state preservation and real wire events."""
import json

import pytest
from ag_ui.core import RunAgentInput, UserMessage
from ag_ui_langgraph import LangGraphAgent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from graph.primary_graphs.a2ui_demo.contract import ContractError, parse_operations
from graph.primary_graphs.sec_a2ui.surface import render_surface, validate_action
from tests.test_sec_a2ui_workflow import ACCESSION, CIK, action, graph


def call(name, **args):
    return AIMessage(content="", tool_calls=[{"id": name, "name": name, "args": args}])


def lookup():
    return [call("search_companies", query="DEMO"), call("render_fixed_ui"), AIMessage(content="조회했습니다.")]


@pytest.mark.asyncio
async def test_capability_question_is_text_only_with_no_reads_or_surface():
    requests = []
    workflow = graph(agent_responses=[AIMessage(content="회사 검색, 공시 조회와 근거 기반 분석을 할 수 있습니다.")], requests=requests)
    result = await workflow.ainvoke({"messages": [HumanMessage(content="뭐가 가능해?")]}, {"configurable": {"thread_id": "help"}})
    assert not requests and not result.get("surfaces") and not result.get("sec")
    assert not any(isinstance(message, ToolMessage) for message in result["messages"])


@pytest.mark.asyncio
async def test_help_after_filing_selection_preserves_state_and_does_not_analyze():
    requests = []
    workflow = graph(agent_responses=[*lookup(), AIMessage(content="선택한 공시의 요약, 사업, 재무, 위험을 분석할 수 있습니다.")], requests=requests)
    config: RunnableConfig = {"configurable": {"thread_id": "selected-help"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    selected = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    reads = len(requests)
    result = await workflow.ainvoke({"messages": [HumanMessage(content="뭐가 가능해?")]}, config)
    assert len(requests) == reads
    assert result["sec"] == selected["sec"] and result["surfaces"] == selected["surfaces"]


@pytest.mark.asyncio
async def test_search_and_fixed_render_are_model_calls_with_tool_result_on_wire():
    workflow = graph()
    agent = LangGraphAgent(name="a2ui-sec", graph=workflow)
    events = [event async for event in agent.run(RunAgentInput(
        thread_id="agent-wire", run_id="run", state={}, messages=[UserMessage(id="user", role="user", content="DEMO")],
        tools=[], context=[], forwarded_props={},
    ))]
    names = [event.tool_call_name for event in events if event.type == "TOOL_CALL_START"]
    assert names == ["search_companies", "render_fixed_ui"]
    assert any(event.type == "TOOL_CALL_RESULT" and "a2ui_operations" in event.model_dump_json() for event in events)


@pytest.mark.asyncio
async def test_unknown_company_and_filing_are_rejected_without_upstream_reads():
    requests = []
    workflow = graph(agent_responses=[
        *lookup(), call("list_filings", cik="0000000001"), AIMessage(content="검색 결과에서 회사를 선택해 주세요."),
        call("select_filing", accession=ACCESSION), AIMessage(content="먼저 회사의 공시를 조회해 주세요."),
    ], requests=requests)
    config: RunnableConfig = {"configurable": {"thread_id": "unknown"}}
    before = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    for query in ("다른 회사 공시", "없는 공시 선택"):
        result = await workflow.ainvoke({"messages": [HumanMessage(content=query)]}, config)
        assert result["sec"] == before["sec"] and result["surfaces"] == before["surfaces"]
        assert len(requests) == 1
        assert any(isinstance(message, ToolMessage) and '"error"' in str(message.content) for message in result["messages"])


@pytest.mark.asyncio
async def test_company_change_after_selection_resets_report_and_increments_revision():
    workflow = graph(agent_responses=[*lookup(), *lookup()])
    config: RunnableConfig = {"configurable": {"thread_id": "change"}}
    result = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    old_search = action(result, "search-button", query="old")
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "company-select", cik=CIK)}, config)
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(result, "filing-select", accession=ACCESSION)}, config)
    revision = result["sec"]["revision"]
    result = await workflow.ainvoke({"messages": [HumanMessage(content="다른 회사 찾아줘")]}, config)
    assert not result["sec"].get("filing") and not result["sec"].get("company")
    assert result["sec"]["revision"] > revision
    with pytest.raises(ContractError):
        validate_action(old_search, result["surfaces"])


@pytest.mark.asyncio
async def test_dynamic_tool_cannot_render_an_unanalyzed_report():
    workflow = graph(agent_responses=[
        call("render_dynamic_ui", plan={"sections": [{"section": "risks", "presentation": "table"}]}),
        AIMessage(content="먼저 공시를 선택하고 분석해 주세요."),
    ])
    result = await workflow.ainvoke({"messages": [HumanMessage(content="위험 표")]}, {"configurable": {"thread_id": "no-report"}})
    assert not result.get("surfaces")
    assert not any(isinstance(message, ToolMessage) and parse_operations(message.content) for message in result["messages"])


@pytest.mark.asyncio
async def test_read_failure_from_agent_tool_preserves_surface_and_can_retry():
    failures, requests = {}, []
    workflow = graph(failures=failures, agent_responses=[
        *lookup(), call("search_companies", query="OTHER"), AIMessage(content="조회 서비스 오류입니다. 다시 시도해 주세요."), *lookup(),
    ], requests=requests)
    config: RunnableConfig = {"configurable": {"thread_id": "agent-retry"}}
    before = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    failures["path"] = "/api/sec/companies"
    failed = await workflow.ainvoke({"messages": [HumanMessage(content="OTHER")]}, config)
    assert failed["sec"] == before["sec"] and failed["surfaces"] == before["surfaces"]
    assert "private upstream diagnostics" not in str(failed)
    failures.clear()
    result = await workflow.ainvoke({"messages": [HumanMessage(content="다시 검색")]}, config)
    assert result["sec"]["companies"]["items"] and len(requests) == 3


def test_empty_result_has_a_different_component_id_from_company_table():
    populated = {"companies": {"items": [{"cik": CIK, "name": "Demo"}], "pagination": {}}, "query": "DEMO"}
    empty = {"companies": {"items": [], "pagination": {}}, "query": "NO_MATCH"}
    initial, update = render_surface("one", populated, create=True), render_surface("one", empty, create=False)
    components = initial[1]["updateComponents"]["components"]
    prior_types = {item["id"]: item["component"] for item in components}
    updates = update[0]["updateComponents"]["components"]
    assert all(item["id"] not in prior_types or item["component"] == prior_types[item["id"]] for item in updates)
    assert "companies-empty" in next(item for item in updates if item["id"] == "root")["children"]
    assert "companies" not in next(item for item in updates if item["id"] == "root")["children"]
    assert "NO_MATCH" in json.dumps(update)


@pytest.mark.asyncio
async def test_unrendered_state_is_not_committed_and_next_help_can_recover():
    workflow = graph(agent_responses=[
        *lookup(), call("search_companies", query="OTHER"), AIMessage(content="화면 없이 잘못 종료"),
        AIMessage(content="기능을 설명합니다."),
    ])
    config: RunnableConfig = {"configurable": {"thread_id": "unrendered"}}
    before = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    with pytest.raises(ContractError, match="화면이 아직"):
        await workflow.ainvoke({"messages": [HumanMessage(content="OTHER")]}, config)
    snapshot = await workflow.aget_state(config)
    assert snapshot.values["sec"] == before["sec"]
    after = await workflow.ainvoke({"messages": [HumanMessage(content="뭐가 가능해?")]}, config)
    assert after["sec"] == before["sec"] and after["surfaces"] == before["surfaces"]
    assert after["ui_dirty"] is False


def test_cancelled_tool_history_does_not_leave_orphan_calls_in_next_model_request():
    from graph.primary_graphs.sec_a2ui.workflow import agent_history

    question = HumanMessage(content="조회해줘")
    next_question = HumanMessage(content="뭐가 가능해?")
    messages = [question, call("search_companies", query="DEMO"), next_question]
    assert agent_history(messages) == [question, next_question]
    orphan = ToolMessage(content="data", tool_call_id="unmatched")
    assert agent_history([question, orphan]) == [question]


@pytest.mark.asyncio
async def test_model_can_switch_dynamic_and_fixed_report_without_changing_facts():
    plan = {"sections": [{"section": name, "presentation": "cards"} for name in ("risks", "summary", "business", "financials")]}
    workflow = graph(agent_responses=[
        *lookup(), call("render_dynamic_ui", plan=plan), AIMessage(content="카드로 표시했습니다."),
        call("render_fixed_ui"), AIMessage(content="기본 접이식 화면입니다."),
    ])
    config: RunnableConfig = {"configurable": {"thread_id": "layout-switch"}}
    current = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")]}, config)
    current = await workflow.ainvoke({"messages": [], "a2ui_action": action(current, "company-select", cik=CIK)}, config)
    current = await workflow.ainvoke({"messages": [], "a2ui_action": action(current, "filing-select", accession=ACCESSION)}, config)
    current = await workflow.ainvoke({"messages": [], "a2ui_action": action(current, "report-button")}, config)
    dynamic = await workflow.ainvoke({"messages": [HumanMessage(content="위험부터 카드로 표시해줘")]}, config)
    assert dynamic["sec"]["report_plan"] == plan
    fixed = await workflow.ainvoke({"messages": [HumanMessage(content="Fixed 기본 화면으로 보여줘")]}, config)
    assert all(section["presentation"] == "accordion" for section in fixed["sec"]["report_plan"]["sections"])
    assert fixed["sec"]["report"] == dynamic["sec"]["report"] == current["sec"]["report"]
    assert fixed["sec"]["report_source_label"] == current["sec"]["report_source_label"]
