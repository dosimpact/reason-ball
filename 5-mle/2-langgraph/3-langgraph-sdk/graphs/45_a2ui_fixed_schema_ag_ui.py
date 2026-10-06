"""Example 45: CopilotKit AG-UI fixed-schema A2UI graph."""
# 예제 개요: 고정 스키마의 항공편 검색 결과를 A2UI 화면으로 전달합니다.
# 핵심 흐름: 항공편·필터·액션은 샘플 데이터이며 실제 항공편 조회나 예약은 수행하지 않습니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("search_flights_fixed_schema")
def search_flights_fixed_schema(origin: str = "SFO", destination: str = "JFK", date: str = "2026-07-14") -> dict[str, Any]:
    """Return a deterministic fixed-schema flight search payload."""
    return {
        "schema_version": "fixed-flight-search-v1",
        "route": {
            "origin": (origin or "SFO").upper(),
            "destination": (destination or "JFK").upper(),
            "date": date or "2026-07-14",
        },
        "travelers": {"adults": 1, "children": 0, "cabin": "Economy"},
        "filters": [
            {"id": "nonstop", "label": "Nonstop", "enabled": True},
            {"id": "carry-on", "label": "Carry-on included", "enabled": True},
            {"id": "morning", "label": "Morning departure", "enabled": False},
        ],
        "options": [
            {
                "id": "aurora-102",
                "airline": "Aurora Air",
                "flight_number": "AU 102",
                "departure": "08:15",
                "arrival": "16:35",
                "duration": "5h 20m",
                "stops": 0,
                "price": 328,
                "score": "Best value",
            },
            {
                "id": "northstar-418",
                "airline": "Northstar",
                "flight_number": "NS 418",
                "departure": "11:40",
                "arrival": "20:25",
                "duration": "5h 45m",
                "stops": 0,
                "price": 376,
                "score": "Flexible fare",
            },
            {
                "id": "pacific-77",
                "airline": "Pacific Loop",
                "flight_number": "PL 77",
                "departure": "15:05",
                "arrival": "00:10",
                "duration": "6h 05m",
                "stops": 1,
                "price": 294,
                "score": "Lowest price",
            },
        ],
        "summary": "Three fixture-backed flight options match the fixed schema.",
    }


SYSTEM_PROMPT = (
    "You are the A2UI fixed schema flight-search demo agent. Always call "
    "search_flights_fixed_schema for flight, travel, or booking requests. Explain that "
    "the rendered cards come from a stable backend schema, not parsed prose."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[search_flights_fixed_schema],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
