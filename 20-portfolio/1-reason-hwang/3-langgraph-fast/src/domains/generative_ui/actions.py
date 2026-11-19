"""Business transitions; neither model output nor browser state is authoritative."""
from __future__ import annotations

from copy import deepcopy

from .contracts import ActionError, UIAction, require_fields, text_field, validate_action
from .data import FLIGHTS, sales_summary

MEALS = {"standard": "일반식", "vegetarian": "채식", "kids": "어린이식", "none": "기내식 없음"}
SEATS = {"12A": "12A · 창가", "12B": "12B · 가운데", "12C": "12C · 통로", "14A": "14A · 창가", "14C": "14C · 통로"}
CABIN_FIELDS = {"meal": {"meal"}, "seat": {"seat"}, "both": {"meal", "seat"}}


def allowed_actions(mode: str, data: dict) -> set[str]:
    if mode == "dynamic":
        return {"search_sales"}
    if mode == "fixed":
        if not data.get("flightId"):
            return set()
        if data.get("uiType") in CABIN_FIELDS:
            return set() if data.get("confirmed") else {"confirm_cabin"}
        return set() if data.get("selected") else {"select_flight"}
    return set()


def fixed_data(flight_id: str, ui_type: str = "flight") -> dict:
    if flight_id not in FLIGHTS or ui_type not in {"flight", *CABIN_FIELDS}:
        raise ActionError("지원하지 않는 데모 항공편 또는 화면입니다.")
    return {
        **FLIGHTS[flight_id], "flightId": flight_id, "uiType": ui_type,
        "selected": False, "confirmed": False,
        **{field: {"meal": "standard", "seat": "12A"}[field] for field in CABIN_FIELDS.get(ui_type, set())},
        "notice": "가상 선택 데모 · 실제 예약이 아닙니다.",
    }


def apply_demo_action(mode: str, data: dict, action: UIAction, revision: int) -> dict:
    context = validate_action(action, revision, allowed_actions(mode, data))
    if mode == "dynamic":
        require_fields(context, {"region"})
        region = text_field(context, "region")
        if region not in {"all", "seoul", "busan"}:
            raise ActionError("지원하지 않는 지역입니다.")
        return sales_summary(region)
    if mode != "fixed":
        raise ActionError("데모 action 모드가 아닙니다.")
    fields = CABIN_FIELDS.get(data.get("uiType"), set()) if action.name == "confirm_cabin" else set()
    require_fields(context, {"flightId", *fields})
    if text_field(context, "flightId") != data.get("flightId"):
        raise ActionError("현재 항공편과 일치하지 않습니다.")
    result = deepcopy(data)
    for field in fields:
        value = text_field(context, field)
        if value not in (MEALS if field == "meal" else SEATS):
            raise ActionError(f"지원하지 않는 선택: {field}")
        result[field] = value
    result["confirmed" if fields else "selected"] = True
    result["notice"] = "선택 완료 · 실제 예약 아님"
    return result
