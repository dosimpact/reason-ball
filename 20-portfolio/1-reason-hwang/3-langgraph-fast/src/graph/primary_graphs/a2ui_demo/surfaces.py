from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from copilotkit import a2ui

from .cabin import confirm_cabin
from .contract import MANIFEST, ContractError, Mode, validate_operations
from .data import FLIGHTS, sales_summary
from .facts import FACTS

FLIGHT_SCHEMA = a2ui.load_schema(Path(__file__).parent / "schemas/flight.json")


def flight_operations(flight_id: str, surface_id: str | None = None) -> list[dict]:
    if flight_id not in FLIGHTS:
        raise ContractError("Unknown demo flight")
    surface_id = surface_id or f"flight-{uuid4().hex}"
    return [
        a2ui.create_surface(surface_id, MANIFEST["catalogs"]["fixed"]["catalogId"]),
        a2ui.update_components(surface_id, json.loads(json.dumps(FLIGHT_SCHEMA))),
        a2ui.update_data_model(surface_id, {
            **FLIGHTS[flight_id], "flightId": flight_id, "selected": False,
            "status": "항공편을 선택해 주세요", "buttonLabel": "항공편 선택",
        }),
    ]


def sales_controls() -> tuple[list[dict], dict]:
    """A stable query panel alongside the generated analysis, with server-owned results."""
    components = [
        {"id": "demo-query", "component": "Card", "title": "지역별 매출 조회", "description": "아래 조회 결과는 서버에서 집계합니다", "child": "demo-query-body"},
        {"id": "demo-query-body", "component": "Column", "children": ["demo-region", "demo-search", "demo-revenue", "demo-accounts", "demo-status"]},
        {"id": "demo-region", "component": "Select", "label": "지역", "value": {"path": "/demo/filters/region"}, "options": [{"value": "all", "label": "전체"}, {"value": "seoul", "label": "서울"}, {"value": "busan", "label": "부산"}]},
        {"id": "demo-search", "component": "Button", "label": "매출 조회", "action": {"event": {"name": "search_sales", "context": {"region": {"path": "/demo/filters/region"}}}}},
        {"id": "demo-revenue", "component": "Metric", "label": "조회 매출", "value": {"path": "/demo/revenue"}},
        {"id": "demo-accounts", "component": "Metric", "label": "거래처 수", "value": {"path": "/demo/accounts"}},
        {"id": "demo-status", "component": "Text", "text": {"path": "/demo/status"}},
    ]
    return components, sales_summary()


def attach_sales_controls(operations: list[dict]) -> list[dict]:
    """Keep model-composed analysis and deterministic query results visibly separate."""
    result = json.loads(json.dumps(operations))
    creates = [op["createSurface"] for op in result if "createSurface" in op]
    if len(creates) != 1:
        raise ContractError("Generate exactly one sales surface per turn")
    surface_id = creates[0]["surfaceId"]
    component_updates = [op for op in result if "updateComponents" in op]
    if len(component_updates) != 1:
        raise ContractError("Generate one complete component tree per sales surface")
    panel, data = sales_controls()
    for operation in result:
        if "updateComponents" in operation:
            components = operation["updateComponents"]["components"]
            if any(component["id"].startswith("demo-") for component in components):
                raise ContractError("Component IDs beginning demo- are reserved")
            for component in components:
                if component["id"] == "root":
                    component["id"] = "demo-analysis"
            components.extend(panel)
            components.append({"id": "root", "component": "Column", "children": ["demo-analysis", "demo-query"]})
    root_data = next((op["updateDataModel"] for op in result if "updateDataModel" in op and op["updateDataModel"].get("path", "/") == "/"), None)
    if root_data is None:
        result.append(a2ui.update_data_model(surface_id, {"facts": FACTS, "demo": data}))
    else:
        if not isinstance(root_data.get("value", {}), dict):
            raise ContractError("Sales data model must be an object")
        root_data["value"] = {"facts": FACTS, "demo": data}
    return result


def apply_action(mode: Mode, action: dict, surfaces: dict[str, dict]) -> tuple[list[dict], dict[str, dict]]:
    surface_id = action.get("surfaceId")
    if not isinstance(surface_id, str) or surface_id not in surfaces:
        raise ContractError("Action surface does not belong to this thread")
    surface = surfaces[surface_id]
    component_id = action.get("sourceComponentId")
    if not isinstance(component_id, str):
        raise ContractError("sourceComponentId must be a string")
    component = surface["components"].get(component_id)
    declared = (component or {}).get("action", {}).get("event", {}).get("name")
    if action.get("name") != declared:
        raise ContractError("Action is not declared by this component")
    context = action.get("context", {})
    if not isinstance(context, dict):
        raise ContractError("Action context must be an object")
    data = json.loads(json.dumps(surface["data"]))
    if mode == "dynamic" and declared == "search_sales":
        if set(context) != {"region"}:
            raise ContractError("search_sales requires only region")
        if not isinstance(context["region"], str):
            raise ContractError("region must be a string")
        data["demo"] = sales_summary(context["region"])
    elif mode == "fixed" and declared == "confirm_cabin":
        data = confirm_cabin(data, context)
    elif mode == "fixed" and declared == "select_flight":
        if set(context) != {"flightId"} or context["flightId"] != data.get("flightId"):
            raise ContractError("Flight does not match this card")
        data.update({"selected": True, "status": "선택 완료 · 실제 예약 아님", "buttonLabel": "선택 완료"})
    else:
        raise ContractError(f"Unsupported action for {mode}: {declared}")
    operations = [a2ui.update_data_model(surface_id, data)]
    return operations, validate_operations(mode, operations, existing=surfaces)
