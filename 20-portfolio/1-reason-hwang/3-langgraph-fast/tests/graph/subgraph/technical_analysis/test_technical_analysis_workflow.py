from __future__ import annotations

import asyncio
import json
from collections.abc import Sequence
from typing import Any, cast

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import PrivateAttr

from domains.technical_analysis.models import (
    AnalysisResult,
    IndicatorCategory,
    IndicatorOutcome,
    IndicatorRequest,
)
from graph.shared.value_objects import PriceData
from graph.subgraph.technical_analysis.state import TechnicalAnalysisState
from graph.subgraph.technical_analysis.tools import create_analyze_ohlcv_tool
from graph.subgraph.technical_analysis.workflow import build_technical_analysis_graph
from infrastructure.technical_analysis.talib import TaLibAnalysisEngine
from tests.technical_analysis_fixtures import make_prices


class FakeTechnicalAnalysisEngine:
    def __init__(self) -> None:
        self.calls = 0

    def analyze(
        self,
        prices: Sequence[PriceData],
        interval: str,
        indicators: Sequence[IndicatorRequest],
    ) -> AnalysisResult:
        self.calls += 1
        category_by_name = {
            "SMA": IndicatorCategory.OVERLAP_STUDIES,
            "RSI": IndicatorCategory.MOMENTUM_INDICATORS,
            "MACD": IndicatorCategory.MOMENTUM_INDICATORS,
        }
        outcomes = tuple(
            IndicatorOutcome(
                name=request.name,
                category=category_by_name[request.name.value],
                status="success",
                parameters=request.parameters,
                series={"value": tuple(float(index) for index in range(len(prices)))},
                latest={"value": float(len(prices) - 1)},
            )
            for request in indicators
        )
        return AnalysisResult(
            symbol=prices[0].symbol,
            interval=interval,
            points=len(prices),
            indicators=outcomes,
        )


class ScriptedChatModel(BaseChatModel):
    responses: list[AIMessage]
    _index: int = PrivateAttr(default=0)
    _bound_tools: list[Any] = PrivateAttr(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "scripted-technical-analysis-test"

    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        self._bound_tools = list(tools)
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        response = self.responses[self._index]
        self._index += 1
        return ChatResult(generations=[ChatGeneration(message=response)])


def scripted_model() -> ScriptedChatModel:
    return ScriptedChatModel(
        responses=[
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "analyze_ohlcv_with_talib",
                        "args": {
                            "indicators": [
                                {"name": "SMA", "parameters": {"timeperiod": 20}},
                                {"name": "RSI", "parameters": {"timeperiod": 14}},
                                {
                                    "name": "MACD",
                                    "parameters": {
                                        "fastperiod": 12,
                                        "slowperiod": 26,
                                        "signalperiod": 9,
                                    },
                                },
                            ]
                        },
                        "id": "analysis-call-1",
                        "type": "tool_call",
                    }
                ],
            ),
            AIMessage(content="계산된 지표를 근거로 기술적 분석을 완료했습니다."),
        ]
    )


def test_public_tool_schema_hides_price_state_and_tool_call_id() -> None:
    analysis_tool = create_analyze_ohlcv_tool(TaLibAnalysisEngine())

    assert set(analysis_tool.args) == {"indicators"}


def test_graph_executes_one_batch_tool_call_and_preserves_full_series() -> None:
    graph = build_technical_analysis_graph(
        model=scripted_model(),
        engine=TaLibAnalysisEngine(),
    )
    prices = make_prices()

    result = asyncio.run(
        graph.ainvoke(
            {
                "messages": [HumanMessage(content="SMA, RSI, MACD로 분석해줘")],
                "prices": [price.to_json_dict() for price in prices],
                "interval": "1d",
                "analysis_result": None,
                "validation_errors": [],
            }
        )
    )

    assert result["analysis_result"]["symbol"] == "TEST"
    assert len(result["analysis_result"]["indicators"]) == 3
    assert len(result["analysis_result"]["indicators"][0]["series"]["sma"]) == 80
    tool_messages = [message for message in result["messages"] if isinstance(message, ToolMessage)]
    assert len(tool_messages) == 1
    assert isinstance(tool_messages[0].content, str)
    compact = json.loads(tool_messages[0].content)
    assert len(compact["indicators"][0]["recent"]["sma"]) == 5
    assert "series" not in compact["indicators"][0]
    assert result["messages"][-1].content == "계산된 지표를 근거로 기술적 분석을 완료했습니다."


def test_graph_accepts_engine_port_without_talib_adapter() -> None:
    engine = FakeTechnicalAnalysisEngine()
    graph = build_technical_analysis_graph(model=scripted_model(), engine=engine)

    result = asyncio.run(
        graph.ainvoke(
            {
                "messages": [HumanMessage(content="SMA, RSI, MACD로 분석해줘")],
                "prices": [price.to_json_dict() for price in make_prices()],
                "interval": "1d",
                "analysis_result": None,
                "validation_errors": [],
            }
        )
    )

    assert engine.calls == 1
    assert len(result["analysis_result"]["indicators"]) == 3
    assert result["analysis_result"]["indicators"][0]["latest"]["value"] == 79.0


def test_invalid_price_routes_to_deterministic_error_without_calling_model() -> None:
    model = scripted_model()
    graph = build_technical_analysis_graph(model=model, engine=TaLibAnalysisEngine())
    invalid_prices = [price.to_json_dict() for price in make_prices(5)]
    invalid_prices[1]["symbol"] = "OTHER"

    result = asyncio.run(
        graph.ainvoke(
            cast(
                TechnicalAnalysisState,
                {
                "messages": [HumanMessage(content="분석해줘")],
                "prices": invalid_prices,
                "interval": "1d",
                "analysis_result": None,
                "validation_errors": [],
                },
            )
        )
    )

    assert model._index == 0
    assert result["analysis_result"] is None
    assert result["validation_errors"]
    assert "기술적 분석을 실행하지 않았습니다" in result["messages"][-1].content
