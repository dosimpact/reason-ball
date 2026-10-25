"""SQLite 영속 상태, 낙관적 잠금, 중복 명령 방지. 모든 변경은 이 경계를 통과합니다."""

import copy
import json
import re
from uuid import uuid4

from agent import history
from agent.dashboard.models import DashboardCommand, Layout, Panel, RefreshPolicy


class Conflict(ValueError):
    pass


def initial():
    return {
        "revision": 0,
        "tabs": [{"id": "main", "title": "Overview"}],
        "active_tab_id": "main",
        "panels": [],
        "artifacts": [],
        "selected_panel_id": None,
        "export_request": None,
    }


def prepare(db):
    db.executescript("""CREATE TABLE IF NOT EXISTS dashboards (
        thread_id TEXT PRIMARY KEY, state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS dashboard_operations (
        thread_id TEXT NOT NULL, operation_id TEXT NOT NULL, PRIMARY KEY(thread_id,operation_id));""")


def read(thread_id):
    history.get_messages(thread_id)
    with history.connect() as db:
        prepare(db)
        row = db.execute(
            "SELECT state FROM dashboards WHERE thread_id=?", (thread_id,)
        ).fetchone()
    return json.loads(row[0]) if row else initial()


def overlaps(a, b):
    return (
        a["x"] < b["x"] + b["w"]
        and a["x"] + a["w"] > b["x"]
        and a["y"] < b["y"] + b["h"]
        and a["y"] + a["h"] > b["y"]
    )


def arrange(panels, preferred=None):
    # 위치 고정 패널을 먼저 배치하고 이동 대상의 의도를 보존한 뒤 충돌 패널을 아래로 이동합니다.
    placed = []
    ordered = sorted(panels, key=lambda p: (not p["pinned"], p["id"] != preferred))
    for panel in ordered:
        layout = panel["layout"]
        layout["x"] = min(layout["x"], 24 - layout["w"])
        while any(
            p["tab_id"] == panel["tab_id"] and overlaps(layout, p["layout"])
            for p in placed
        ):
            if panel["pinned"]:
                raise ValueError("Pinned panels cannot overlap")
            layout["y"] += 1
            if layout["y"] > 10000:
                raise ValueError("Dashboard layout exceeds bounds")
        placed.append(panel)


def panel_by_id(state, panel_id):
    found = next((p for p in state["panels"] if p["id"] == panel_id), None)
    if not found:
        raise ValueError("Panel not found; select the intended panel")
    return found


def validate_content(panel):
    result = Panel.model_validate(panel).model_dump()
    if result["kind"] == "openui" and not re.search(
        r"(?m)^\s*root\s*=", result["program"]
    ):
        raise ValueError(
            "An independent OpenUI program with a root assignment is required"
        )
    if result["kind"] == "financial" and not result["data"].get("rows"):
        raise ValueError("Financial panels require sourced observations")
    return result


def apply(state, command):
    state = copy.deepcopy(state)
    action, payload, panel_id = command.action, command.payload, command.panel_id
    tab_ids = {t["id"] for t in state["tabs"]}
    if action in ("add", "artifact_add"):
        panel = validate_content({**payload, "id": panel_id or str(uuid4())})
        if panel["tab_id"] not in tab_ids:
            raise ValueError("Unknown tab")
        collection = state["artifacts"] if action == "artifact_add" else state["panels"]
        if any(p["id"] == panel["id"] for p in collection):
            raise ValueError("Duplicate panel ID")
        if action == "add" and panel["source_artifact_id"]:
            existing = next(
                (
                    p
                    for p in collection
                    if p["source_artifact_id"] == panel["source_artifact_id"]
                ),
                None,
            )
            if existing:
                state["selected_panel_id"] = existing["id"]
                state["active_tab_id"] = existing["tab_id"]
                return state
        if len(collection) >= 100:
            raise ValueError("Maximum 100 panels/artifacts per conversation")
        collection.append(panel)
        if action == "add":
            state["selected_panel_id"] = panel["id"]
            state["active_tab_id"] = panel["tab_id"]
    elif action == "refresh_policy":
        panel = panel_by_id(state, panel_id)
        if panel["kind"] != "financial" or set(payload) - {"mode", "interval_seconds"}:
            raise ValueError("Only financial panels have refresh policies")
        panel["refresh"] = RefreshPolicy.model_validate(
            {**panel.get("refresh", {}), **payload}
        ).model_dump()
    elif action == "refresh_result":
        panel = panel_by_id(state, panel_id)
        policy = RefreshPolicy.model_validate(panel.get("refresh", {}))
        if panel["kind"] != "financial" or policy.mode == "snapshot":
            raise ValueError("Snapshot cannot be refreshed")
        policy.last_attempt_at = payload["attempted_at"]
        policy.error = payload.get("error")
        if "data" in payload:
            updated = validate_content({**panel, "data": payload["data"]})
            panel.update(updated)
            policy.last_success_at = payload["attempted_at"]
        panel["refresh"] = policy.model_dump()
    elif action == "refresh":
        raise ValueError("Refresh must fetch SEC data through the service")
    elif action in ("update", "remove", "pin", "select", "ui_state"):
        panel = panel_by_id(state, panel_id)
        if action == "remove":
            state["panels"].remove(panel)
            if state["selected_panel_id"] == panel_id:
                state["selected_panel_id"] = None
        elif action == "pin":
            if not isinstance(payload.get("pinned"), bool):
                raise ValueError("pinned must be boolean")
            panel["pinned"] = payload["pinned"]
        elif action == "select":
            state["selected_panel_id"] = panel_id
            state["active_tab_id"] = panel["tab_id"]
        elif action == "ui_state":
            panel["ui_state"] = payload
        else:
            if set(payload) - {
                "title",
                "program",
                "query",
                "data",
                "sources",
                "tab_id",
                "kind",
            }:
                raise ValueError("Unsupported panel update")
            if (
                panel["pinned"]
                and "tab_id" in payload
                and payload["tab_id"] != panel["tab_id"]
            ):
                raise ValueError("Unpin panel before moving to another tab")
            if panel.get("refresh", {}).get("mode") == "snapshot" and set(payload) & {
                "query",
                "data",
                "program",
                "kind",
            }:
                raise ValueError("Switch Snapshot to live before changing its content")
            updated = validate_content({**panel, **payload})
            if updated["tab_id"] not in tab_ids:
                raise ValueError("Unknown tab")
            panel.update(updated)
    elif action == "layout":
        for item in payload.get("layouts", []):
            panel = panel_by_id(state, item["id"])
            layout = Layout.model_validate(item["layout"]).model_dump()
            if panel["pinned"] and layout != panel["layout"]:
                raise ValueError("Unpin panel before moving/resizing")
            panel["layout"] = layout
    elif action == "tab_add":
        if len(state["tabs"]) >= 20:
            raise ValueError("Maximum 20 tabs")
        tab_id = str(uuid4())
        state["tabs"].append(
            {"id": tab_id, "title": str(payload.get("title", "Dashboard"))[:100]}
        )
        state["active_tab_id"] = tab_id
    elif action in ("tab_select", "tab_rename", "tab_remove"):
        tab_id = payload.get("id")
        if tab_id not in tab_ids:
            raise ValueError("Unknown tab")
        if action == "tab_select":
            state["active_tab_id"] = tab_id
        elif action == "tab_rename":
            next(t for t in state["tabs"] if t["id"] == tab_id)["title"] = str(
                payload["title"]
            )[:100]
        else:
            if len(state["tabs"]) == 1:
                raise ValueError("Keep at least one tab")
            removed_ids = {p["id"] for p in state["panels"] if p["tab_id"] == tab_id}
            if removed_ids and payload.get("remove_panels") is not True:
                raise ValueError("Confirm removing this tab and its panels")
            state["panels"] = [p for p in state["panels"] if p["id"] not in removed_ids]
            if state["selected_panel_id"] in removed_ids:
                state["selected_panel_id"] = None
            state["tabs"] = [t for t in state["tabs"] if t["id"] != tab_id]
            if state["active_tab_id"] == tab_id:
                state["active_tab_id"] = state["tabs"][0]["id"]
    elif action == "import":
        tabs = payload.get("tabs", [])
        panels = payload.get("panels", [])
        if (
            not tabs
            or len(tabs) + len(state["tabs"]) > 20
            or len(panels) + len(state["panels"]) > 100
        ):
            raise ValueError("Import exceeds dashboard limits")
        if len({t["id"] for t in tabs}) != len(tabs):
            raise ValueError("Duplicate imported tab IDs")
        tab_map = {t["id"]: str(uuid4()) for t in tabs}
        panel_map = {p["id"]: str(uuid4()) for p in panels}
        if len(panel_map) != len(panels):
            raise ValueError("Duplicate imported panel IDs")
        imported = []
        for panel in panels:
            if panel["tab_id"] not in tab_map:
                raise ValueError("Unknown imported tab")
            item = validate_content(
                {
                    **panel,
                    "id": panel_map[panel["id"]],
                    "tab_id": tab_map[panel["tab_id"]],
                    "source_artifact_id": None,
                }
            )
            for old, new in panel_map.items():
                item["program"] = item["program"].replace(
                    json.dumps(old), json.dumps(new)
                )
            imported.append(item)
        state["tabs"].extend(
            {"id": tab_map[t["id"]], "title": str(t["title"])[:100]} for t in tabs
        )
        state["panels"].extend(imported)
        state["active_tab_id"] = tab_map[tabs[0]["id"]]
    elif action == "export":
        format_name = payload.get("format", "json")
        if format_name not in ("json", "csv", "print"):
            raise ValueError("Supported export formats: json, csv, print")
        state["export_request"] = {"id": command.operation_id, "format": format_name}
    arrange(state["panels"], panel_id)
    return state


def execute(thread_id, raw):
    command = DashboardCommand.model_validate(raw)
    history.get_messages(thread_id)
    with history.connect() as db:
        prepare(db)
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            "SELECT state FROM dashboards WHERE thread_id=?", (thread_id,)
        ).fetchone()
        state = json.loads(row[0]) if row else initial()
        if db.execute(
            "SELECT 1 FROM dashboard_operations WHERE thread_id=? AND operation_id=?",
            (thread_id, command.operation_id),
        ).fetchone():
            return state
        if state["revision"] != command.base_revision:
            raise Conflict("Dashboard changed; reload and retry the intended operation")
        state = apply(state, command)
        state["revision"] += 1
        db.execute(
            "INSERT OR REPLACE INTO dashboards VALUES (?,?)",
            (thread_id, json.dumps(state, ensure_ascii=False)),
        )
        db.execute(
            "INSERT INTO dashboard_operations VALUES (?,?)",
            (thread_id, command.operation_id),
        )
    return state
