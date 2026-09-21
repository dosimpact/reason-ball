import pytest
from copilotkit import a2ui

from graph.primary_graphs.a2ui_demo.contract import (
    MANIFEST,
    ContractError,
    validate_operations,
)
from graph.primary_graphs.a2ui_demo.facts import FACTS, validate_fact_bindings
from graph.primary_graphs.a2ui_demo.surfaces import attach_sales_controls


def operations():
    return [
        a2ui.create_surface("sales", MANIFEST["catalogs"]["dynamic"]["catalogId"]),
        a2ui.update_components("sales", [
            {"id": "root", "component": "Column", "children": ["quota", "chart", "table"]},
            {"id": "quota", "component": "Metric", "label": "총 쿼터", "value": {"path": "/facts/summary/quota"}},
            {"id": "chart", "component": "Chart", "title": "지역별 매출", "kind": "bar", "data": {"path": "/facts/series/regions"}},
            {"id": "table", "component": "Table", "title": "담당자별 실적", "columns": [{"key": "rep", "label": "담당자"}, {"key": "revenue", "label": "매출"}], "rows": {"path": "/facts/tables/team"}},
        ]),
    ]


def test_grounded_layout_receives_server_calculated_data():
    assert FACTS["summary"]["quota"] == "$630,000"
    assert FACTS["summary"]["attainment"] == "107.9%"
    batch = operations()
    validate_fact_bindings(batch)
    state = validate_operations("dynamic", attach_sales_controls(batch))
    assert state["sales"]["data"]["facts"] == FACTS


@pytest.mark.parametrize("mutation", ["invented-metric", "invented-text", "invented-chart", "unknown-path", "wrong-table-column"])
def test_invented_numeric_content_is_rejected(mutation):
    batch = operations()
    components = batch[1]["updateComponents"]["components"]
    if mutation == "invented-metric":
        components[1]["value"] = "$650,000"
    elif mutation == "invented-text":
        components.append({"id": "wrong", "component": "Text", "text": "달성률 104.6%"})
    elif mutation == "invented-chart":
        components[2]["data"] = [{"label": "서울", "value": 1}]
    elif mutation == "unknown-path":
        components[1]["value"] = {"path": "/facts/invented"}
    else:
        components[3]["columns"][0]["key"] = "invented"
    with pytest.raises(ContractError):
        validate_fact_bindings(batch)
