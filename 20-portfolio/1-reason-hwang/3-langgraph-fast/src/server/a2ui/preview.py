"""Ephemeral, server-validated previews from complete streamed components."""
from __future__ import annotations

import json
from copy import deepcopy

from ag_ui.core import CustomEvent, EventType
from copilotkit import a2ui

from graph.primary_graphs.a2ui_demo.contract import (
    MANIFEST,
    ContractError,
    validate_operations,
)
from graph.primary_graphs.a2ui_demo.facts import FACTS, validate_fact_bindings

PREVIEW_EVENT = "a2ui.preview"
MAX_ARGUMENT_BYTES = 1_000_000


def complete_components(arguments: str) -> list[dict]:
    """Read only complete array members, without repairing incomplete JSON."""
    decoder = json.JSONDecoder()
    text = arguments.lstrip()
    if not text.startswith("{"):
        return []
    position = 1
    try:
        while position < len(text):
            position += len(text[position:]) - len(text[position:].lstrip())
            key, position = decoder.raw_decode(text, position)
            position += len(text[position:]) - len(text[position:].lstrip())
            if text[position:position + 1] != ":":
                return []
            position += 1
            position += len(text[position:]) - len(text[position:].lstrip())
            if key == "components":
                if text[position:position + 1] != "[":
                    return []
                result = []
                position += 1
                while position < len(text):
                    position += len(text[position:]) - len(text[position:].lstrip())
                    try:
                        value, end = decoder.raw_decode(text, position)
                    except ValueError:
                        break
                    if not isinstance(value, dict):
                        return []
                    result.append(value)
                    position = end
                    position += len(text[position:]) - len(text[position:].lstrip())
                    if text[position:position + 1] != ",":
                        break
                    position += 1
                return result
            _, position = decoder.raw_decode(text, position)
            position += len(text[position:]) - len(text[position:].lstrip())
            if text[position:position + 1] != ",":
                return []
            position += 1
    except (ValueError, IndexError):
        pass
    return []


def preview_operations(components: list[dict], surface_id: str) -> list[dict] | None:
    """Keep complete root branches; only root Row/Column may omit pending children."""
    if not components or any(not isinstance(item.get("id"), str) for item in components):
        return None
    by_id = {item["id"]: item for item in components}
    if len(by_id) != len(components) or "root" not in by_id:
        return None
    selected: dict[str, dict] = {}

    def collect(component_id: str, visiting: set[str]) -> bool:
        if not isinstance(component_id, str) or component_id in visiting or component_id not in by_id:
            return False
        item = by_id[component_id]
        children = item.get("children", [])
        if not isinstance(children, list):
            return False
        descendants = [*children, *(item[key] for key in ("child", "first", "second") if key in item)]
        for child in descendants:
            if not collect(child, visiting | {component_id}):
                return False
        selected[component_id] = deepcopy(item)
        return True

    root = by_id["root"]
    if root.get("component") in ("Row", "Column"):
        children = root.get("children")
        if not isinstance(children, list):
            return None
        ready = []
        for child in children:
            before = dict(selected)
            if collect(child, {"root"}):
                ready.append(child)
            else:
                selected.clear()
                selected.update(before)
        if not ready:
            return None
        selected["root"] = {**deepcopy(root), "children": ready}
    elif not collect("root", set()):
        return None
    # Input/action controls are server-owned and only available after final commit.
    if any(item.get("component") in ("Button", "Select", "Input", "Checkbox", "Slider", "Switch")
           or "action" in item for item in selected.values()):
        return None
    operations = [
        a2ui.create_surface(surface_id, MANIFEST["catalogs"]["dynamic"]["catalogId"]),
        a2ui.update_components(surface_id, list(selected.values())),
        a2ui.update_data_model(surface_id, {"facts": FACTS}),
    ]
    try:
        validate_operations("dynamic", operations)
        validate_fact_bindings(operations)
    except (ContractError, KeyError, TypeError, ValueError):
        return None
    return operations


class PreviewStream:
    """Observe AG-UI events without modifying final tool results or graph state."""

    def __init__(self, run_id: str):
        self.surface_id = f"preview-{run_id}"
        self.call_id: str | None = None
        self.arguments = ""
        self.last_components: list[dict] = []
        self.last_operations: list[dict] | None = None

    def clear(self) -> CustomEvent:
        self.call_id = None
        self.arguments = ""
        self.last_components = []
        self.last_operations = None
        return CustomEvent(name=PREVIEW_EVENT, value={"operations": []})

    def observe(self, event) -> CustomEvent | None:
        if event.type == EventType.TOOL_CALL_START and event.tool_call_name == "render_a2ui":
            cleared = self.clear()
            self.call_id = event.tool_call_id
            return cleared
        if event.type in {EventType.RUN_ERROR, EventType.RUN_FINISHED, EventType.TOOL_CALL_RESULT}:
            return self.clear()
        if event.type == EventType.CUSTOM and event.name == "a2ui.progress" and event.value.get("stage") == "retrying":
            return self.clear()
        if event.type != EventType.TOOL_CALL_ARGS or event.tool_call_id != self.call_id:
            return None
        self.arguments += event.delta
        if len(self.arguments) > MAX_ARGUMENT_BYTES:
            return self.clear()
        try:
            components = complete_components(self.arguments)
        except RecursionError:
            return self.clear()
        if components == self.last_components:
            return None
        self.last_components = components
        try:
            operations = preview_operations(components, self.surface_id)
        except (RecursionError, TypeError, ValueError):
            return self.clear()
        if operations is None or operations == self.last_operations:
            return None
        self.last_operations = operations
        return CustomEvent(name=PREVIEW_EVENT, value={"operations": operations})
