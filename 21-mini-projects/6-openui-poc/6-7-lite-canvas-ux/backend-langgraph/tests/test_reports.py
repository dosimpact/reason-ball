import asyncio
import importlib
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessageChunk, HumanMessage
from starlette.testclient import TestClient

from agent.reports import (
    ReportRepository,
    kpi_comparisons,
    public_report,
    read_vendor,
    vendor_catalog,
)


@pytest.fixture
def repo(tmp_path):
    return ReportRepository(tmp_path / "reports.sqlite3")


def test_catalog_is_backend_owned_and_lookup_is_exact():
    assert len(vendor_catalog()) == 8
    assert read_vendor("공급업체 1")["id"] == "supplier-01"
    assert read_vendor("supplier-01")["name"] == "공급업체1"
    with pytest.raises(ValueError):
        read_vendor("../../.env")


def test_kpi_audit_preserves_original_and_calculated_values():
    row = kpi_comparisons(read_vendor("공급업체1")["text"])[0]
    assert row["calculated_difference"] == 1000000
    assert row["calculated_percent"] == 12.5
    assert "800,000" in row["source_claim"]


def test_replacement_is_single_current_report_and_old_id_cannot_be_saved(repo):
    thread = str(uuid4())
    old = repo.replace(thread, read_vendor("공급업체1"))
    old.update(status="ready", program="first")
    repo.save(old)
    repo.publish(old["id"])
    new = repo.replace(thread, read_vendor("공급업체2"))
    assert new["id"] != old["id"]
    assert repo.current(thread)["id"] == new["id"]
    assert repo.get(old["id"]) is None
    with pytest.raises(ValueError):
        repo.save(old)
    with pytest.raises(ValueError):
        repo.publish(new["id"])
    assert "source_text" not in public_report(new)
    assert "thread_id" not in public_report(new)


def test_public_http_requires_explicit_publication(repo, monkeypatch):
    from agent import http
    monkeypatch.setattr(http, "repository", repo)
    report = repo.replace(str(uuid4()), read_vendor("공급업체1"))
    client = TestClient(http.app)
    path = f"/canvas/reports/{report['id']}"
    assert client.get(path).status_code == 404
    assert client.post(path + "/publish").status_code == 409
    report.update(program="test", status="ready")
    repo.save(report)
    assert client.get(path).status_code == 404
    assert client.post(path + "/publish").status_code == 200
    assert client.get(path).json()["program"] == "test"
    assert "source_text" not in client.get(path).json()


@pytest.fixture
def graph_module(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "unit-test-no-network")
    return importlib.import_module("agent.graph")


class FakeModel:
    def __init__(self, decision=None, programs=None, fail=False):
        self.decision = decision
        self.programs = programs or ["answer"]
        self.calls = []
        self.fail = fail

    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages, config):
        self.calls.append(messages)
        return self.decision

    async def astream(self, messages, config):
        self.calls.append(messages)
        if self.fail:
            raise RuntimeError("test generation failure")
        text = self.programs[min(len(self.calls) - 1, len(self.programs) - 1)]
        for piece in (text[:3], text[3:]):
            yield AIMessageChunk(piece)


async def valid(program):
    return []


def test_subgraph_opens_before_stream_and_repairs_before_ready(repo, graph_module):
    router = FakeModel(graph_module.RouteDecision(action="generate", vendor="공급업체1"))
    model = FakeModel(programs=["bad", "good"])

    async def validator(program):
        return ["invalid program"] if program.endswith("bad") else []

    graph = graph_module.build_graph(router, model, repo, validator)
    thread = str(uuid4())

    async def run():
        return [item async for item in graph.astream(
            {"messages": [HumanMessage("공급업체1 리포트 생성해줘")], "quote": None},
            {"configurable": {"thread_id": thread}}, stream_mode="custom", subgraphs=True)]

    events = asyncio.run(run())
    canvas = [event for namespace, event in events if event["channel"] == "canvas"]
    assert canvas[0]["type"] == "open"
    assert canvas[1]["type"] == "TEXT_MESSAGE_START"
    assert "repairing" in [e["type"] for e in canvas]
    assert canvas[-1]["type"] == "ready"
    assert repo.current(thread)["program"].endswith("good")
    assert any("report_subagent" in str(namespace) for namespace, _ in events)


def test_quote_is_in_llm_context_and_stale_quote_is_rejected(repo, graph_module):
    thread = str(uuid4())
    report = repo.replace(thread, read_vendor("공급업체1"))
    report.update(status="ready", program="current rendered report")
    repo.save(report)
    router = FakeModel(graph_module.RouteDecision(action="answer", vendor=""), ["선택한 수치의 근거입니다."])
    graph = graph_module.build_graph(router, FakeModel(), repo, valid)
    quote = {"reportId": report["id"], "text": "광고 매출 9,000,000원"}
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("이 수치를 설명해줘")], "quote": quote}, {"configurable": {"thread_id": thread}}))
    context = str(router.calls[-1][0].content)
    assert quote["text"] in context and report["program"] in context and report["source_text"][:30] in context
    assert result["quote"] == quote
    calls = len(router.calls)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("설명해줘")], "quote": {**quote, "reportId": str(uuid4())}}, {"configurable": {"thread_id": thread}}))
    assert "다시 선택" in result["messages"][-1].content
    assert len(router.calls) == calls


def test_generation_error_is_persisted_and_not_publishable(repo, graph_module):
    thread = str(uuid4())
    router = FakeModel(graph_module.RouteDecision(action="generate", vendor="공급업체1"))
    graph = graph_module.build_graph(router, FakeModel(fail=True), repo, valid)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("리포트 생성")], "quote": None}, {"configurable": {"thread_id": thread}}))
    assert result["report"]["status"] == "error"
    assert repo.current(thread)["status"] == "error"
    with pytest.raises(ValueError):
        repo.publish(result["report"]["id"])


def test_unknown_supplier_preserves_current_report(repo, graph_module):
    thread = str(uuid4())
    old = repo.replace(thread, read_vendor("공급업체1"))
    router = FakeModel(graph_module.RouteDecision(action="generate", vendor="없는업체"))
    graph = graph_module.build_graph(router, FakeModel(), repo, valid)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("없는업체 리포트")], "quote": None}, {"configurable": {"thread_id": thread}}))
    assert repo.current(thread)["id"] == old["id"]
    assert "찾지 못했습니다" in result["messages"][-1].content


def test_chart_facts_are_literal_source_values_not_narrative_deltas():
    from agent.reports import report_facts
    facts = report_facts(read_vendor("공급업체1")["text"])
    campaign = next(row for row in facts["sourceCampaigns"] if row["id"] == "CAMP_003")
    assert campaign["w1"] == 2000000
    assert campaign["w2"] == 2000000
    assert campaign["claim"] == "+300,000원"
    risk = next(row for row in facts["sourceRisks"] if row["id"] == "VID_0019")
    assert risk["hours"] == 137
    assert risk["risk"] == 2000000
    assert "CAMP_047" in risk["campaign"]
    for vendor in vendor_catalog():
        data = report_facts(read_vendor(vendor["name"])["text"])
        assert len(data["sourceKpis"]) == 9
        assert data["sourceCampaigns"]
        assert data["sourceRisks"]


def test_review_requires_verbatim_evidence_in_generated_view(graph_module, monkeypatch):
    source = "W1 8,000,000원, W2 9,000,000원"
    view = 'report = Text("매출 99,000,000원")'
    audit = graph_module.ReportAudit(issues=[
        graph_module.AuditIssue(category="number", correction="Correct the invented revenue",
                                source_quote="W2 9,000,000원", program_quote=view),
        graph_module.AuditIssue(category="number", correction="Ignore invented evidence",
                                source_quote="W2 9,000,000원", program_quote="not in generated view"),
        graph_module.AuditIssue(category="number", correction="Ignore nonexistent source",
                                source_quote="W2 10,000,000원", program_quote=view),
    ])
    model = FakeModel(decision=audit)
    monkeypatch.setattr(graph_module, "review_model", model)
    result = asyncio.run(graph_module.review_report("root = Col([report])\n// GENERATED VIEW\n" + view, source, {}))
    assert result == ["Correct the invented revenue"]
    assert "<generated-view>\n" + view in model.calls[0][1].content


class FakeUIAgent:
    def __init__(self, programs):
        self.programs = programs
        self.calls = []

    async def astream(self, state, config, stream_mode):
        self.calls.append(state)
        text = self.programs[min(len(self.calls) - 1, len(self.programs) - 1)]
        yield AIMessageChunk(content=text), {"langgraph_node": "model"}


def test_general_ui_streams_on_chat_without_replacing_existing_report(repo, graph_module):
    thread = str(uuid4())
    old = repo.replace(thread, read_vendor("공급업체1"))
    old.update(status="ready", program="supplier report")
    repo.save(old)
    router = FakeModel(graph_module.RouteDecision(action="ui", vendor=""))
    agent = FakeUIAgent(['root = Col([Text("Lisbon")])'])
    graph = graph_module.build_graph(router, FakeModel(), repo, valid, ui_agent=agent, ui_validator=valid)

    async def run():
        return [event async for event in graph.astream(
            {"messages": [HumanMessage("Plan Lisbon with a map")], "quote": None},
            {"configurable": {"thread_id": thread}}, stream_mode="custom")]

    events = asyncio.run(run())
    assert not any(e["channel"] == "canvas" for e in events)
    chat = [e for e in events if e["channel"] == "chat"]
    assert chat[0]["format"] == "openui"
    assert chat[-1]["type"] == "TEXT_MESSAGE_END"
    assert "Lisbon" in chat[1]["delta"]
    assert repo.current(thread)["id"] == old["id"]


def test_general_ui_repairs_same_message_and_reports_terminal_failure(repo, graph_module):
    router = FakeModel(graph_module.RouteDecision(action="ui", vendor=""))
    agent = FakeUIAgent(["invalid"])

    async def invalid(program):
        return ["Unresolved reference"]

    graph = graph_module.build_graph(router, FakeModel(), repo, valid, ui_agent=agent, ui_validator=invalid)

    async def run():
        return [event async for event in graph.astream(
            {"messages": [HumanMessage("Build a calculator")], "quote": None},
            {"configurable": {"thread_id": str(uuid4())}}, stream_mode="custom")]

    events = asyncio.run(run())
    starts = [e for e in events if e["type"] == "TEXT_MESSAGE_START"]
    assert len(starts) == 3
    assert len({e["messageId"] for e in starts}) == 1
    assert events[-1]["type"] == "UI_ERROR"
    assert len(agent.calls) == 3


@pytest.mark.parametrize("requested,previous,expected", [
    ("pdf", None, "pdf"), ("inherit", None, "interactive"),
    ("inherit", "pdf", "pdf"), ("interactive", "pdf", "interactive"),
])
def test_report_mode_routes_validator_and_survives_publication(repo, graph_module, requested, previous, expected):
    thread = str(uuid4())
    if previous:
        repo.replace(thread, read_vendor("공급업체1"), previous)
    router = FakeModel(graph_module.RouteDecision(action="regenerate" if previous else "generate",
                                                  vendor="공급업체1", report_mode=requested))
    validated = []

    async def interactive(program):
        validated.append("interactive")
        return []

    async def pdf(program):
        validated.append("pdf")
        return []

    model = FakeModel(programs=['report = Col([Text("성과")])'])
    graph = graph_module.build_graph(router, model, repo, interactive, pdf_validator=pdf)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("보고서 만들어줘")], "quote": None},
                                     {"configurable": {"thread_id": thread}}))
    assert result["report"]["status"] == "ready"
    assert validated == [expected]
    assert result["report"]["report_mode"] == expected
    assert public_report(repo.publish(result["report"]["id"]))["report_mode"] == expected
    prompt = model.calls[0][0].content
    assert ("REPORT MODE: pdf" in prompt) if expected == "pdf" else ("SegmentedControl" in prompt)


def test_supplier_question_loads_source_without_creating_canvas(repo, graph_module):
    thread = str(uuid4())
    agent = FakeUIAgent(['answer = Col([Text("원문 기반 답변")])'])
    router = FakeModel(graph_module.RouteDecision(action="supplier_ui", vendor="공급업체1"))
    graph = graph_module.build_graph(router, FakeModel(), repo, valid, supplier_agent=agent, ui_validator=valid)

    async def run():
        return [event async for event in graph.astream(
            {"messages": [HumanMessage("공급업체1 매출 비교해줘")], "quote": None},
            {"configurable": {"thread_id": thread}}, stream_mode="custom")]

    events = asyncio.run(run())
    assert not any(event["channel"] == "canvas" for event in events)
    assert repo.current(thread) is None
    assert events[-1]["type"] == "TEXT_MESSAGE_END"
    context = agent.calls[0]["messages"][-1].content
    assert read_vendor("공급업체1")["file"] in context
    assert "8,000,000" in context
    assert "arithmetic_audit" in context
    assert "root = Col([answer])" in context
    assert any("sourceKpis" in event.get("delta", "") for event in events)


def test_supplier_ui_preserves_report_and_quote(repo, graph_module):
    thread = str(uuid4())
    report = repo.replace(thread, read_vendor("공급업체1"), "pdf")
    report.update(status="ready", program="saved report")
    repo.save(report)
    agent = FakeUIAgent(['answer = Col([Text("설명")])'])
    router = FakeModel(graph_module.RouteDecision(action="supplier_ui", vendor=""))
    graph = graph_module.build_graph(router, FakeModel(), repo, valid, supplier_agent=agent, ui_validator=valid)
    quote = {"reportId": report["id"], "text": "광고 매출"}
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("이 부분 설명해줘")], "quote": quote},
                                     {"configurable": {"thread_id": thread}}))
    assert result["quote"] == quote
    assert result["supplier_context"]["name"] == "공급업체1"
    assert repo.current(thread) == report
    assert "saved report" in agent.calls[0]["messages"][-1].content


def test_unknown_supplier_question_does_not_call_ui(repo, graph_module):
    agent = FakeUIAgent(["must not run"])
    router = FakeModel(graph_module.RouteDecision(action="supplier_ui", vendor="없는업체"))
    graph = graph_module.build_graph(router, FakeModel(), repo, valid, supplier_agent=agent, ui_validator=valid)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("없는업체 매출")], "quote": None},
                                     {"configurable": {"thread_id": str(uuid4())}}))
    assert "찾지 못했습니다" in result["messages"][-1].content
    assert agent.calls == []


def test_source_only_supplier_agent_streams_fresh_repair(repo, graph_module):
    from agent.general_ui import create_supplier_agent
    model = FakeModel(programs=['answer = Text("bad")', 'answer = Col([Text("corrected")])'])
    agent = create_supplier_agent(model, "Test catalog")
    router = FakeModel(graph_module.RouteDecision(action="supplier_ui", vendor="공급업체1"))

    async def check(program):
        return ["Repair answer"] if 'Text("bad")' in program else []

    graph = graph_module.build_graph(router, FakeModel(), repo, valid, supplier_agent=agent, ui_validator=check)
    result = asyncio.run(graph.ainvoke({"messages": [HumanMessage("매출 설명")], "quote": None},
                                     {"configurable": {"thread_id": str(uuid4())}}))
    assert len(model.calls) == 2
    assert result["messages"][-1].content.endswith('answer = Col([Text("corrected")])')
    assert "Repair answer" in str(model.calls[1][-1].content)
