"""Business transitions; neither model output nor browser state is authoritative."""
from __future__ import annotations

from copy import deepcopy
from datetime import date

from .contracts import ActionError, UIAction, page_field, require_fields, text_field, validate_action
from .data import FLIGHTS, sales_summary
from .sec import execute_action

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
    allowed = {"sec_search"}
    if data.get("companies", {}).get("items") and not data.get("company"):
        allowed.add("sec_company")
    if data.get("company"):
        allowed.update({"sec_filings_page", "sec_filings_filter"})
        if data.get("filings", {}).get("items"):
            allowed.add("sec_filing")
        if data.get("filing", {}).get("status") == "downloaded":
            allowed.add("sec_report")
    return allowed


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


async def apply_sec_action(data: dict, action: UIAction, revision: int, client, model=None) -> dict:
    context = validate_action(action, revision, allowed_actions("sec", data))
    fields = {
        "sec_search": {"query", "page"}, "sec_company": {"cik"},
        "sec_filings_page": {"page"}, "sec_filings_filter": {"status", "form", "since"},
        "sec_filing": {"accession"}, "sec_report": {"request"},
    }[action.name]
    require_fields(context, fields)
    for field in fields - {"page"}:
        text_field(context, field, 500 if field == "request" else 120)
    if "page" in fields:
        page_field(context)
    if action.name == "sec_filings_filter":
        if context["status"] not in {"", "downloaded", "pending", "failed"}:
            raise ActionError("잘못된 원문 상태입니다.")
        if context["form"] not in {"", "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"}:
            raise ActionError("잘못된 공시 종류입니다.")
        if context["since"]:
            try:
                date.fromisoformat(context["since"])
            except ValueError as error:
                raise ActionError("날짜는 YYYY-MM-DD 형식이어야 합니다.") from error
    return await execute_action(data, action.name, context, client, model)
