"""Explicitly opt-in real-model checks. Run serially, never with pytest-xdist."""
import os
from uuid import uuid4

import pytest
from langchain_core.messages import HumanMessage

from graph.primary_graphs.a2ui_demo.facts import FACTS
from graph.primary_graphs.a2ui_demo.model import ModelSettings
from graph.primary_graphs.a2ui_demo.workflow import build_graph

pytestmark = pytest.mark.skipif(os.getenv("A2UI_LIVE_TESTS") != "1", reason="Requires an explicitly configured live model")


@pytest.mark.asyncio
@pytest.mark.parametrize("category,prompt", [
    ("snapshot", "전체 매출 현황을 KPI 대시보드와 차트로 보여줘"),
    ("team", "담당자별 매출과 쿼터, 거래처 수를 표로 보여줘"),
    ("risk", "주의가 필요한 거래처를 상태 배지와 함께 보여줘"),
    ("account", "Han River Retail 거래처의 상세 정보를 보여줘"),
    ("pie", "서울과 부산의 매출 비중을 보여줘"),
    ("trend", "월별 매출 추이를 보여줘"),
])
async def test_dynamic_question_shapes_are_grounded(category, prompt):
    graph = build_graph("dynamic", ModelSettings.from_env().build())
    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=prompt)], "surfaces": {}},
        {"configurable": {"thread_id": f"live-{category}-{uuid4().hex}"}, "recursion_limit": 12},
    )
    assert len(result["surfaces"]) == 1
    surface = next(iter(result["surfaces"].values()))
    assert surface["data"]["facts"] == FACTS
    components = [value for key, value in surface["components"].items() if not key.startswith("demo-")]
    kinds = [component["component"] for component in components]
    if category == "snapshot":
        assert kinds.count("Metric") >= 2
        assert "Chart" in kinds
    elif category == "team":
        assert any(c["component"] == "Table" and c["rows"] == {"path": "/facts/tables/team"} for c in components)
    elif category == "risk":
        assert "Badge" in kinds
    elif category == "account":
        assert any(c["component"] == "InfoRow" and c["value"]["path"].startswith("/facts/accounts/account0/") for c in components)
    else:
        expected_kind, expected_data = ("pie", "regions") if category == "pie" else ("bar", "months")
        assert any(c["component"] == "Chart" and c["kind"] == expected_kind and c["data"] == {"path": f"/facts/series/{expected_data}"} for c in components)
