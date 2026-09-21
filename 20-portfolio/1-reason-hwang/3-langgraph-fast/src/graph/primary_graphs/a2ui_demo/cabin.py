"""One fixed surface for both meal and seat selection."""
from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from copilotkit import a2ui

from .contract import MANIFEST, ContractError
from .data import FLIGHTS

CABIN_SCHEMA = json.loads((Path(__file__).parent / "schemas/cabin.json").read_text())
CHOICES = {
    component["id"]: {option["value"]: option["label"] for option in component["options"]}
    for component in CABIN_SCHEMA if "options" in component
}


def cabin_operations(flight_id: str) -> list[dict]:
    if flight_id not in FLIGHTS:
        raise ContractError("Unknown demo flight")
    flight = FLIGHTS[flight_id]
    surface_id = f"cabin-{uuid4().hex}"
    return [
        a2ui.create_surface(surface_id, MANIFEST["catalogs"]["fixed"]["catalogId"]),
        a2ui.update_components(surface_id, json.loads(json.dumps(CABIN_SCHEMA))),
        a2ui.update_data_model(surface_id, {
            "flightId": flight_id,
            "flightLabel": f'{flight["origin"]} → {flight["destination"]} · {flight["airline"]}',
            "meal": "standard", "seat": "12A", "confirmed": False,
            "status": "기내식과 좌석을 고른 뒤 선택 확정을 눌러 주세요.",
            "buttonLabel": "선택 확정",
        }),
    ]


def confirm_cabin(data: dict, context: dict) -> dict:
    if set(context) != {"flightId", "meal", "seat"} or context["flightId"] != data.get("flightId"):
        raise ContractError("Cabin flight does not match this card")
    for field in ("meal", "seat"):
        if not isinstance(context[field], str) or context[field] not in CHOICES[field]:
            raise ContractError(f"Unknown cabin {field}")
    if data.get("confirmed") and any(context[field] != data[field] for field in ("meal", "seat")):
        raise ContractError("Cabin selection is already confirmed")
    meal, seat = context["meal"], context["seat"]
    return {
        **data, "meal": meal, "seat": seat, "confirmed": True,
        "buttonLabel": "선택 확정 완료",
        "status": f"선택 완료 · {CHOICES['meal'][meal]} · {CHOICES['seat'][seat]} · 실제 예약 아님",
    }
