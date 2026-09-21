"""Select one of the allowlisted fixed cabin UIs."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal
from uuid import uuid4

from copilotkit import a2ui

from .contract import MANIFEST, ContractError
from .data import FLIGHTS

CabinUIType = Literal["meal", "seat", "both"]
SCHEMAS = {
    ui_type: json.loads((Path(__file__).parent / "schemas" / filename).read_text())
    for ui_type, filename in {"meal": "meal.json", "seat": "seat.json", "both": "cabin.json"}.items()
}
FIELDS = {"meal": ("meal",), "seat": ("seat",), "both": ("meal", "seat")}
LABELS = {"meal": "기내식", "seat": "좌석", "both": "기내식과 좌석"}
CHOICES = {
    field: {option["value"]: option["label"] for option in next(
        component for component in SCHEMAS[field] if component["id"] == field
    )["options"]}
    for field in ("meal", "seat")
}


def cabin_operations(flight_id: str, ui_type: CabinUIType = "both") -> list[dict]:
    if ui_type not in SCHEMAS:
        raise ContractError("Unknown cabin UI type")
    if flight_id not in FLIGHTS:
        raise ContractError("Unknown demo flight")
    flight = FLIGHTS[flight_id]
    surface_id = f"cabin-{uuid4().hex}"
    return [
        a2ui.create_surface(surface_id, MANIFEST["catalogs"]["fixed"]["catalogId"]),
        a2ui.update_components(surface_id, json.loads(json.dumps(SCHEMAS[ui_type]))),
        a2ui.update_data_model(surface_id, {
            "flightId": flight_id,
            "flightLabel": f'{flight["origin"]} → {flight["destination"]} · {flight["airline"]}',
            "uiType": ui_type, "confirmed": False,
            **{field: {"meal": "standard", "seat": "12A"}[field] for field in FIELDS[ui_type]},
            "status": f"{LABELS[ui_type]}을 선택한 뒤 확정해 주세요.",
            "buttonLabel": "선택 확정",
        }),
    ]


def confirm_cabin(data: dict, context: dict) -> dict:
    fields = FIELDS.get(data.get("uiType", "both"))
    if fields is None:
        raise ContractError("Unknown cabin UI type")
    if set(context) != {"flightId", *fields} or context["flightId"] != data.get("flightId"):
        raise ContractError("Cabin flight does not match this card")
    for field in fields:
        if not isinstance(context[field], str) or context[field] not in CHOICES[field]:
            raise ContractError(f"Unknown cabin {field}")
    if data.get("confirmed") and any(context[field] != data[field] for field in fields):
        raise ContractError("Cabin selection is already confirmed")
    selections = {field: context[field] for field in fields}
    summary = " · ".join(CHOICES[field][context[field]] for field in fields)
    return {
        **data, **selections, "confirmed": True,
        "buttonLabel": "선택 확정 완료",
        "status": f"선택 완료 · {summary} · 실제 예약 아님",
    }
