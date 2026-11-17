import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from domains.technical_analysis.presentation import (
    canvas_item_errors,
    presentation_input,
)
from graph.primary_graphs.technical_analysis_canvas_agent.state import (
    TechnicalCanvasAgentState,
)
from graph.primary_graphs.technical_analysis_canvas_agent.workflow import (
    build_technical_analysis_canvas_agent,
)
from tests.test_technical_analysis_agent import fixture_fetcher, report_state


def test_canvas_context_has_independent_server_owned_items():
    data = presentation_input(report_state(), "saved-1")
    items = data["presentation_context"]["canvasItems"]
    assert [item["id"] for item in items] == ["saved-1:chart", "saved-1:indicator:0", "saved-1:indicator:1", "saved-1:indicator:2"]
    assert items[0]["instances"] == []
    assert all(len(item["instances"]) == 1 for item in items[1:])


def test_canvas_id_guard_ignores_prose_and_rejects_missing_duplicate_and_foreign_ids():
    valid = 'root = Col([Text("CanvasItem(fake)"), CanvasItem("saved:chart", "Price", [])], 2)'
    assert canvas_item_errors(valid, {"saved:chart"}) == []
    assert canvas_item_errors('root = Text("CanvasItem(\\"saved:chart\\", x, [])")', {"saved:chart"})
    assert canvas_item_errors(valid, {"saved:chart", "saved:indicator:0"})
    assert canvas_item_errors(valid + '\nother = CanvasItem("foreign", "", [])', {"saved:chart"})
    assert canvas_item_errors(valid + '\nother = CanvasItem("saved:chart", "", [])', {"saved:chart"})


@pytest.mark.asyncio
async def test_quote_explanation_uses_saved_element_without_new_presentation():
    report = report_state()["analysis_result"]
    element = {"title": "TEST · RSI 차트", "signal": report["indicators"][0]["signal"]}
    model = FakeMessagesListChatModel(responses=[AIMessage(content="TEST RSI는 저장된 근거로 설명합니다.")])
    dummy = StateGraph(TechnicalCanvasAgentState)
    dummy.add_node("unused", lambda state: {})
    dummy.add_edge(START, "unused")
    dummy.add_edge("unused", END)
    graph = build_technical_analysis_canvas_agent(model=model, agent=dummy.compile(), fetcher=fixture_fetcher)
    saved = {"saved-1": {"title": "TEST · 기술적 분석", "request": {"ticker": "TEST", "interval": "1d"}, "analysis": report, "summary": "RSI", "elements": {"saved-1:indicator:0": element}}}
    state = await graph.ainvoke({"messages": [HumanMessage(content="이 문장을 설명해줘")], "canvas_context": {"reportId": "saved-1", "elementId": "saved-1:indicator:0", "quote": "RSI는 중립입니다"}, "canvas_reports": saved})
    assert state["presentation"] is None
    assert state["canvas_reports"] == saved
    assert "TEST RSI" in state["messages"][-1].content


@pytest.mark.asyncio
async def test_quote_rejects_element_from_other_report():
    model = FakeMessagesListChatModel(responses=[])
    dummy = StateGraph(TechnicalCanvasAgentState)
    dummy.add_node("unused", lambda state: {})
    dummy.add_edge(START, "unused")
    dummy.add_edge("unused", END)
    graph = build_technical_analysis_canvas_agent(model=model, agent=dummy.compile(), fetcher=fixture_fetcher)
    state = await graph.ainvoke({"messages": [HumanMessage(content="설명")], "canvas_context": {"reportId": "saved-1", "elementId": "saved-2:indicator:0", "quote": "RSI"}, "canvas_reports": {"saved-1": {"elements": {"saved-1:indicator:0": {}}}}})
    assert state["canvas_route"] == "invalid"
    assert "Unknown selected element" in state["analysis_error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["valid", "invalid", "provider"])
async def test_canvas_model_generation_preserves_evidence_and_validates_ids(mode):
    import json

    class Model:
        attempts = 0

        def with_structured_output(self, schema):
            return self

        async def ainvoke(self, messages):
            self.attempts += 1
            if mode == "provider":
                raise RuntimeError("provider unavailable")
            payload = json.loads(messages[1].content)
            assert payload["question"] == "TEST RSI 분석"
            assert "분석" in payload["answer"]["explanation"]
            items = payload["presentationContext"]["canvasItems"]
            if mode == "invalid":
                return {"program": 'root = CanvasItem("foreign:chart", "Price", [])'}
            return {"program": "root = Col([" + ",".join('CanvasItem(' + json.dumps(item["id"]) + ', "Chart", [FinancialChart(chart)])' for item in items) + '], 2)\nchart = Query("technical_analysis_chart", {}, {"bars":[],"indicators":[]})'}

    async def business(state):
        return {**report_state(), "messages": [AIMessage(content="검증된 설명")]}

    dummy = StateGraph(TechnicalCanvasAgentState)
    dummy.add_node("business", business)
    dummy.add_edge(START, "business")
    dummy.add_edge("business", END)

    async def validator(program):
        return []

    model = Model()
    graph = build_technical_analysis_canvas_agent(model=model, agent=dummy.compile(), validator=validator, fetcher=fixture_fetcher)
    state = await graph.ainvoke({"messages": [HumanMessage(content="TEST RSI 분석")], "canvas_context": {"request": {"ticker": "TEST", "interval": "1d", "count": 120, "indicators": [{"name": "RSI", "parameters": {"timeperiod": 14}}]}}})
    saved = state["canvas_reports"][state["canvas_report_id"]]
    assert saved["analysis"]
    if mode == "valid":
        assert saved["status"] == "ready"
        assert len(saved["elements"]) == 2
        assert model.attempts == 1
    else:
        assert saved["status"] == "error"
        assert state["presentation"] is None
        assert model.attempts == (2 if mode == "invalid" else 1)


def test_legacy_snapshot_uses_requested_indicator_parameters_without_series():
    state = report_state()
    state["analysis_result"]["chart_snapshot"] = {"schemaVersion": 1, "indicators": ["RSI", "SMA", "MACD"], "bars": []}
    data = presentation_input(state, "saved-1")
    import json
    instances = json.loads(data["presentation_context"]["chartQuery"]["instances"])
    assert [item["name"] for item in instances] == [item["name"] for item in state["analysis_result"]["indicators"]]
    assert data["presentation_context"]["canvasItems"][2]["instances"] == [instances[1]]
