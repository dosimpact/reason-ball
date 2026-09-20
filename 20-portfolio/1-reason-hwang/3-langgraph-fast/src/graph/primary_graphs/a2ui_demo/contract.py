from __future__ import annotations

import hashlib
import json
from importlib import metadata
from pathlib import Path
from typing import Any, Literal

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

Mode = Literal["dynamic", "fixed", "sec"]
CONTRACTS = Path(__file__).parent / "contracts"
MANIFEST = json.loads((CONTRACTS / "manifest.json").read_text())
PROTOCOL_VERSION = MANIFEST["protocolVersion"]


class ContractError(ValueError):
    """A version, catalog, component or action contract was violated."""


def load_catalog(mode: str) -> dict[str, Any]:
    entry = MANIFEST["catalogs"][mode]
    raw = (CONTRACTS / f"{mode}.catalog.json").read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != entry["sha256"]:
        raise ContractError(f"Catalog hash mismatch: expected {entry['sha256']}, got {actual}")
    return json.loads(raw)


def verify_versions() -> None:
    for name, expected in MANIFEST["python"].items():
        actual = metadata.version(name)
        if actual != expected:
            raise ContractError(f"{name}: expected {expected}, installed {actual}")


def verify_client_contract(mode: Mode, value: Any) -> None:
    expected = MANIFEST["catalogs"][mode]
    if not isinstance(value, dict):
        raise ContractError("Missing a2uiContract; refresh the client")
    for key, want in {"protocolVersion": PROTOCOL_VERSION, "catalogId": expected["catalogId"], "sha256": expected["sha256"]}.items():
        if value.get(key) != want:
            raise ContractError(f"{key}: expected {want}, received {value.get(key)!r}")


def _validator(mode: Mode) -> Draft202012Validator:
    catalog = load_catalog(mode)
    spec = CONTRACTS / "specification"
    schema = json.loads((spec / "server_to_client.json").read_text())
    common = json.loads((spec / "common_types.json").read_text())
    resource = Resource.from_contents(catalog)
    registry = Registry().with_resources([
        (catalog["$id"], resource),
        ("https://a2ui.org/specification/v0_9/catalog.json", resource),
        (common["$id"], Resource.from_contents(common)),
    ])
    return Draft202012Validator(schema, registry=registry)


def validate_operations(mode: Mode, operations: Any, *, existing: dict[str, dict] | None = None) -> dict[str, dict]:
    """Validate a complete batch against official envelopes, props and graph edges.

    Return the next surface map. The caller commits it only after full validation.
    """
    if not isinstance(operations, list) or not operations:
        raise ContractError("a2ui_operations must be a nonempty array")
    surfaces = json.loads(json.dumps(existing or {}))
    validator = _validator(mode)
    expected_id = MANIFEST["catalogs"][mode]["catalogId"]
    for operation in operations:
        errors = list(validator.iter_errors(operation))
        if errors:
            raise ContractError(errors[0].message)
        kind = next(key for key in operation if key != "version")
        body = operation[kind]
        surface_id = body["surfaceId"]
        if kind == "createSurface":
            if body["catalogId"] != expected_id:
                raise ContractError(f"Expected catalog {expected_id}")
            if surface_id in surfaces:
                raise ContractError(f"Surface already exists: {surface_id}")
            surfaces[surface_id] = {"components": {}, "data": {}}
            continue
        if surface_id not in surfaces:
            raise ContractError(f"Unknown surface: {surface_id}")
        if kind == "deleteSurface":
            del surfaces[surface_id]
        elif kind == "updateComponents":
            batch = body["components"]
            ids = [component["id"] for component in batch]
            if len(ids) != len(set(ids)):
                raise ContractError("Duplicate component IDs in one update")
            surfaces[surface_id]["components"].update({component["id"]: component for component in batch})
        elif kind == "updateDataModel":
            # Application tools deliberately publish root data snapshots.
            if body.get("path", "/") != "/":
                raise ContractError("Demo tools must publish root data snapshots")
            surfaces[surface_id]["data"] = body.get("value", {})
    for surface in surfaces.values():
        validate_component_tree(surface["components"])
    return surfaces


def validate_component_tree(components: dict[str, dict]) -> None:
    if "root" not in components:
        raise ContractError("Surface must contain a root component")
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(component_id: str) -> None:
        if component_id in visiting:
            raise ContractError(f"Component cycle at {component_id}")
        if component_id not in components:
            raise ContractError(f"Missing child component: {component_id}")
        if component_id in visited:
            return
        visiting.add(component_id)
        component = components[component_id]
        descendants = list(component.get("children", []))
        descendants.extend(component[key] for key in ("child", "first", "second") if key in component)
        for child in descendants:
            visit(child)
        if component["component"] == "Table" and isinstance(component["rows"], list):
            keys = {column["key"] for column in component["columns"]}
            if any(set(row) - keys for row in component["rows"]):
                raise ContractError("Table row keys must match declared columns")
        visiting.remove(component_id)
        visited.add(component_id)

    visit("root")
    if visited != set(components):
        raise ContractError("Unreachable components in surface")


def parse_operations(content: Any) -> list[dict] | None:
    if not isinstance(content, str):
        return None
    try:
        value = json.loads(content)
    except ValueError:
        return None
    return value.get("a2ui_operations") if isinstance(value, dict) else None
