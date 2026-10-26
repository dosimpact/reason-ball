# 데모 도구의 입력 검증과 반환 형식을 확인합니다. 실시간 외부 데이터의 정확도를 검사하는 테스트는 아닙니다.
import asyncio
import json

import pytest
from pydantic import ValidationError

from agent.tools import get_stock_price, get_weather, search_web


def test_weather_preserves_known_city_and_forecast_contract():
    data = json.loads(asyncio.run(get_weather.ainvoke({"location": "Tokyo"})))
    assert data["temperature_celsius"] == 22
    assert data["temperature_fahrenheit"] == 72
    assert len(data["forecast"]) == 2


def test_stock_normalizes_symbol():
    data = json.loads(asyncio.run(get_stock_price.ainvoke({"symbol": "aapl"})))
    assert data["symbol"] == "AAPL"
    assert data["day_low"] <= data["price"] <= data["day_high"]


def test_search_preserves_query():
    data = json.loads(asyncio.run(search_web.ainvoke({"query": "space telescope"})))
    assert data["query"] == "space telescope"
    assert len(data["results"]) == 3


def test_missing_tool_argument_is_rejected():
    with pytest.raises(ValidationError):
        asyncio.run(get_weather.ainvoke({}))
