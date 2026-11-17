import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from domains.technical_analysis.presentation import build_program
from graph.primary_graphs.technical_analysis_canvas_agent.state import TechnicalCanvasAgentState
from graph.primary_graphs.technical_analysis_canvas_agent.workflow import build_technical_analysis_canvas_agent
from tests.test_technical_analysis_agent import fixture_fetcher, report_state


def test_canvas_charts_have_independent_queries_and_conditions():
    report = report_state()["analysis_result"]
    program = build_program({"answer": report, "canvas_item_report_id": "saved-1"})
    assert program.count("CanvasItem(") == 4
    assert program.count('Query("technical_analysis_chart"') == 4
    assert 'CanvasItem("saved-1:chart"' in program
    assert 'CanvasItem("saved-1:indicator:0"' in program
    assert '$item0_instances = "[]"' in program
    assert program.count('FinancialChart(') == 4
    for index in range(4):
        assert f'$item{index}_ticker' in program
        assert f'$item{index}_interval' in program
        assert f'$item{index}_count' in program
    assert 'taLayout' not in program


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
