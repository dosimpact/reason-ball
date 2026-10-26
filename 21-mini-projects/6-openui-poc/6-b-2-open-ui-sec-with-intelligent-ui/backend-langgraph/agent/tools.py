# 외부 API를 호출하지 않는 날씨·주가·검색 데모 도구입니다.
# 반환 JSON의 구조를 보여 주는 예제이며 실제 최신 정보로 사용하면 안 됩니다.
# 문서 비교 그래프에서는 등록하지 않으며, 기본 예제의 참고 코드와 회귀 테스트용으로 남아 있습니다.
"""Demo tools: generated data, not live weather, financial or search APIs."""

import json
import math
import random

from langchain_core.tools import tool


@tool
async def get_weather(location: str) -> str:
    """Get mock current weather for a city."""
    temperatures = {
        "tokyo": 22,
        "san francisco": 18,
        "london": 14,
        "new york": 25,
        "paris": 19,
        "sydney": 27,
        "mumbai": 33,
        "berlin": 16,
    }
    temp = temperatures.get(location.lower(), random.randrange(5, 35))
    return json.dumps(
        {
            "location": location,
            "temperature_celsius": temp,
            "temperature_fahrenheit": math.floor(temp * 1.8 + 32 + 0.5),
            "condition": random.choice(
                ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear Skies"]
            ),
            "humidity_percent": random.randrange(40, 80),
            "wind_speed_kmh": random.randrange(5, 30),
            "forecast": [
                {
                    "day": "Tomorrow",
                    "high": temp + 2,
                    "low": temp - 4,
                    "condition": "Partly Cloudy",
                },
                {
                    "day": "Day After",
                    "high": temp + 1,
                    "low": temp - 3,
                    "condition": "Sunny",
                },
            ],
        }
    )


@tool
async def get_stock_price(symbol: str) -> str:
    """Get a mock stock price for a ticker symbol, e.g. AAPL."""
    symbol = symbol.upper()
    prices = {
        "AAPL": 189.84,
        "GOOGL": 141.8,
        "TSLA": 248.42,
        "MSFT": 378.91,
        "AMZN": 178.25,
        "NVDA": 875.28,
        "META": 485.58,
    }
    price = prices.get(symbol, random.randrange(20, 520))
    change = round(random.uniform(-4, 4), 2)
    return json.dumps(
        {
            "symbol": symbol,
            "price": round(price + change, 2),
            "change": change,
            "change_percent": round(change / price * 100, 2),
            "volume": f"{random.uniform(10, 60):.1f}M",
            "day_high": round(price + abs(change) + 1.5, 2),
            "day_low": round(price - abs(change) - 1.2, 2),
        }
    )


@tool
async def search_web(query: str) -> str:
    """Return mock search results for a general information query."""
    return json.dumps(
        {
            "query": query,
            "results": [
                {
                    "title": f'Top result for "{query}"',
                    "snippet": f"Comprehensive overview of {query} with the latest information.",
                },
                {
                    "title": f"{query} - Latest News",
                    "snippet": f"Recent developments and updates related to {query}.",
                },
                {
                    "title": f"Understanding {query}",
                    "snippet": f"An in-depth guide explaining everything about {query}.",
                },
            ],
        }
    )
