"""Example 36: CopilotKit AG-UI backend tool rendering graph.

쉽게 이해하기
-------------
Tool rendering은 도구의 결과를 글 외의 화면 요소로 보여주는 것이다.
예: 재고 조회 결과를 카드나 표로 표시한다.
백엔드는 재고 데이터를 반환하고 프런트엔드가 그 데이터를 그린다.

그래프 구조
-----------
요청에 맞는 재고 자료를 도구로 조회하고, 프런트엔드가 결과를 그릴 수 있는 데이터와 모델 응답을 반환한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Search north warehouse inventory for keyboard."
    }
  ]
}
```
관찰할 결과: search_inventory 도구의 query/warehouse 인자와 재고 렌더링 payload를 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
그래프 입력은 messages입니다. React + CopilotKit runtime을 함께 실행해야 프런트 도구/context/UI 표시까지 연습할 수 있습니다. raw graph 호출만으로 화면 렌더링 성공을 판단하지 않습니다.
"""
# 예제 개요: 백엔드 도구 결과를 프런트엔드의 재고 카드로 표시하는 예제입니다.
# 핵심 흐름: 고정 재고 목록을 필터링해 표와 지표를 반환하고, agent가 결과를 설명합니다.

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


INVENTORY_ROWS = [
    {
        "sku": "LG-AX-10",
        "name": "LangGraph Atlas Kit",
        "warehouse": "north",
        "available": 42,
        "reserved": 8,
        "status": "ready",
    },
    {
        "sku": "CP-UI-22",
        "name": "Copilot UI Harness",
        "warehouse": "north",
        "available": 16,
        "reserved": 3,
        "status": "ready",
    },
    {
        "sku": "AG-RN-04",
        "name": "AG-UI Renderer Pack",
        "warehouse": "west",
        "available": 7,
        "reserved": 5,
        "status": "low",
    },
]


@tool("search_inventory")
def search_inventory(query: str, warehouse: str = "north") -> dict[str, Any]:
    """Search deterministic demo inventory for backend tool rendering."""

    normalized_query = query.lower().strip()
    normalized_warehouse = warehouse.lower().strip()
    rows = [
        row
        for row in INVENTORY_ROWS
        if (
            normalized_warehouse in {"all", row["warehouse"]}
            and (
                normalized_query in row["name"].lower()
                or normalized_query in row["sku"].lower()
                or normalized_query in row["status"].lower()
                or normalized_query in {"inventory", "stock", "demo", "available"}
            )
        )
    ]

    total_available = sum(int(row["available"]) for row in rows)
    total_reserved = sum(int(row["reserved"]) for row in rows)
    status = "empty" if not rows else "attention" if any(row["status"] == "low" for row in rows) else "ready"

    return {
        "title": "Inventory lookup",
        "status": status,
        "summary": (
            f"Found {len(rows)} matching item(s) for {query!r} "
            f"in {normalized_warehouse or 'north'} warehouse scope."
        ),
        "metrics": [
            {"label": "Matches", "value": len(rows)},
            {"label": "Available", "value": total_available},
            {"label": "Reserved", "value": total_reserved},
        ],
        "rows": rows,
    }


SYSTEM_PROMPT = (
    "You are the backend tool rendering demo agent. When the user asks about "
    "inventory, stock, availability, warehouses, or demo items, always call "
    "search_inventory. After the tool result, summarize the top match in one "
    "short sentence. For unrelated questions, answer briefly without using a tool."
)


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[search_inventory],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
