import json
from pathlib import Path

from fastapi.routing import APIRoute

from server.server import app

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def _ssot() -> dict:
    root = Path(__file__).resolve().parents[5]
    return json.loads(
        (root / ".apb-workspace/docs/01-plan/langgraph-standard.json").read_text()
    )


def test_all_ssot_method_paths_are_registered() -> None:
    expected = {
        (method.upper(), path)
        for path, path_item in _ssot()["paths"].items()
        if isinstance(path_item, dict)
        for method in path_item
        if method.upper() in HTTP_METHODS
    }
    routes = list(app.routes)
    for route in app.routes:
        included = getattr(route, "original_router", None)
        if included is not None:
            routes.extend(included.routes)
    actual = {
        (method, route.path)
        for route in routes
        if isinstance(route, APIRoute)
        for method in (route.methods or set())
        if method in HTTP_METHODS
    }
    assert expected <= actual
    assert len(expected) == 63


def test_runtime_openapi_is_the_ssot() -> None:
    contract = _ssot()
    assert app.openapi() == contract
    assert len(contract["components"]["schemas"]) == 57
    assert len(contract["tags"]) == 10
