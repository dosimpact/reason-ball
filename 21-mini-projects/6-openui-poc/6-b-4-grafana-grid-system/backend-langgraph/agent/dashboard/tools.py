"""현재 대화의 Canvas를 조작하는 도구. UI와 동일한 명령 저장 계층을 사용합니다."""

import asyncio
import json
from typing import Literal
from uuid import uuid4

from langchain_core.tools import tool

from agent.dashboard import store
from agent.dashboard.refresh import refresh_panel
from agent.dashboard.validation import validate_program
from agent.sec.service import financials


def build_dashboard_tools(
    thread_id, *, allowed_publications=None, new_panel_limit=None
):
    observed = store.read(thread_id)
    mutation_lock = asyncio.Lock()
    created_panels = {}
    created_tabs = {}

    def publication_destination(destination, panel_id):
        if panel_id:
            destination = "canvas"
        elif not destination:
            if allowed_publications is None:
                destination = "chat"  # Preserve standalone tool callers.
            elif len(allowed_publications) == 1:
                destination = next(iter(allowed_publications))
        if destination not in {"chat", "canvas"}:
            raise ValueError(
                "Specify chat or canvas; this plan has no unambiguous publication destination"
            )
        if allowed_publications is not None and destination not in allowed_publications:
            raise ValueError(
                "Publication destination is not authorized by the current request plan"
            )
        return destination

    async def change(action, panel_id=None, payload=None):
        nonlocal observed
        async with mutation_lock:
            fingerprint = json.dumps(payload or {}, sort_keys=True, ensure_ascii=False)
            if action == "tab_add" and fingerprint in created_tabs:
                tab_id = created_tabs[fingerprint]
                if any(tab["id"] == tab_id for tab in observed["tabs"]):
                    return {
                        "success": True,
                        "tab_id": tab_id,
                        "revision": observed["revision"],
                    }
            if action == "add" and fingerprint in created_panels:
                return {
                    "success": True,
                    "panel_id": created_panels[fingerprint],
                    "revision": observed["revision"],
                }
            if (
                action == "add"
                and new_panel_limit is not None
                and len(set(created_panels.values())) >= new_panel_limit
            ):
                return {
                    "success": False,
                    "error": "Requested new Canvas panel limit reached; no extra panel was created",
                    "created_panel_ids": sorted(set(created_panels.values())),
                    "message": "Use the existing panel_id to revise a saved panel, or finish the response without repeating completed mutations.",
                }
            if action == "artifact_add":
                duplicate = next(
                    (
                        item
                        for item in observed["artifacts"]
                        if all(
                            item.get(key) == (payload or {}).get(key)
                            for key in ("title", "program", "sources")
                        )
                    ),
                    None,
                )
                if duplicate:
                    return {
                        "success": True,
                        "panel_id": duplicate["id"],
                        "revision": observed["revision"],
                    }
            try:
                updated = await asyncio.to_thread(
                    store.execute,
                    thread_id,
                    {
                        "operation_id": str(uuid4()),
                        "base_revision": observed["revision"],
                        "action": action,
                        "panel_id": panel_id,
                        "payload": payload or {},
                    },
                )
                removed_panel_ids = sorted(
                    {panel["id"] for panel in observed["panels"]}
                    - {panel["id"] for panel in updated["panels"]}
                )
                observed = updated
                if action == "add":
                    created_panels[fingerprint] = panel_id
                if action == "tab_add":
                    created_tabs[fingerprint] = updated["active_tab_id"]
                return {
                    "success": True,
                    "panel_id": panel_id,
                    "revision": updated["revision"],
                    **(
                        {"removed_panel_ids": removed_panel_ids}
                        if action == "tab_remove"
                        else {}
                    ),
                    **(
                        {"tab_id": updated["active_tab_id"]}
                        if action in ("tab_add", "tab_select")
                        else {}
                    ),
                }
            except (ValueError, KeyError) as exc:
                observed = await asyncio.to_thread(store.read, thread_id)
                return {"success": False, "error": str(exc), "state": observed}

    @tool
    async def inspect_dashboard() -> str:
        """Read current tabs, panels, selected panel, artifacts and their stable IDs before editing."""
        nonlocal observed
        async with mutation_lock:
            observed = await asyncio.to_thread(store.read, thread_id)
            return json.dumps(observed, ensure_ascii=False)

    @tool
    async def publish_ui_panel(
        title: str,
        program: str,
        destination: str = "",
        panel_id: str = "",
        sources: list[dict] | None = None,
        tab_id: str = "",
    ) -> str:
        """Publish a complete independent OpenUI program (root = Card(...)) as a reusable artifact or Canvas panel.

        destination is chat or canvas; omission uses the unambiguous request plan. For chat, render returned ID with DashboardArtifact(id).
        Use all integrated catalog elements including tables, cards, forms. No DashboardArtifact inside program.
        For editing an existing Canvas panel pass its actual panel_id; preserve its identity and position.
        For a NEW canvas panel, pass tab_id from inspect_dashboard or the tab_add result.
        This avoids relying on active-tab changes during parallel calls. For existing panel tab moves use modify_dashboard update with tab_id.
        Only cite actual retrieved sources. Never fabricate IDs or numerical report values.
        """
        try:
            destination = publication_destination(destination, panel_id)
        except ValueError as exc:
            return json.dumps({"success": False, "error": str(exc)})
        if "DashboardArtifact(" in program:
            return json.dumps({"error": "Invalid destination or nested artifact"})
        try:
            validation = await validate_program(program)
        except Exception as exc:  # noqa: BLE001 - parser boundary rejects unverified programs
            return json.dumps(
                {
                    "success": False,
                    "error": str(exc),
                    "message": "Fix the program using the catalog; existing panel retained",
                }
            )
        # Keep visible citations in export metadata even when the model omits sources.
        rendered_sources = (validation or {}).get("sources", [])
        citations = []
        for source in [*(sources or []), *rendered_sources]:
            if source not in citations:
                citations.append(source)
        payload = {"title": title, "program": program, "sources": citations}
        if panel_id:
            result = await change("update", panel_id, payload)
            return json.dumps(result)
        identifier = str(uuid4())
        result = await change(
            "artifact_add" if destination == "chat" else "add",
            identifier,
            {**payload, "tab_id": tab_id or observed["active_tab_id"]},
        )
        return json.dumps(
            {
                **result,
                "destination": destination,
                "artifact_id": result.get("panel_id")
                if destination == "chat"
                else None,
            }
        )

    @tool
    async def publish_financial_chart(
        cik: str,
        metric: str = "revenue",
        years: int = 3,
        exclude_years: list[int] | None = None,
        destination: str = "",
        panel_id: str = "",
        title: str = "",
    ) -> str:
        """Fetch sourced SEC annual data and create/update a chart. No fabricated numeric inputs.

        For an existing selected/named chart reuse panel_id and its cik/metric from inspect_dashboard.
        destination chat returns an artifact_id to render as DashboardArtifact(id); canvas creates directly.
        Explicit excluded years are period-end calendar years. Ask if 'remove one year' is ambiguous.
        """
        try:
            destination = publication_destination(destination, panel_id)
        except ValueError as exc:
            return json.dumps({"success": False, "error": str(exc)})
        if panel_id:
            existing = store.panel_by_id(observed, panel_id)
            if existing.get("refresh", {}).get("mode") == "snapshot":
                return json.dumps(
                    {
                        "success": False,
                        "error": "Switch Snapshot to live explicitly before fetching new data",
                    }
                )
        try:
            data = await financials(cik, metric, years, exclude_years)
        except Exception as exc:  # noqa: BLE001 - tool boundary returns provider failure without credentials
            return json.dumps(
                {
                    "error": type(exc).__name__,
                    "message": "SEC data unavailable; existing chart retained",
                }
            )
        payload = {
            "title": title or f"{data.get('company', cik)} · {metric}",
            "kind": "financial",
            "query": {
                "cik": cik,
                "metric": metric,
                "years": years,
                "exclude_years": exclude_years or [],
            },
            "data": data,
            "sources": [{"url": data.get("source", ""), "title": "SEC Company Facts"}],
        }
        if panel_id:
            return json.dumps(await change("update", panel_id, payload))
        identifier = str(uuid4())
        result = await change(
            "artifact_add" if destination == "chat" else "add",
            identifier,
            {**payload, "tab_id": observed["active_tab_id"]},
        )
        return json.dumps(
            {
                **result,
                "destination": destination,
                "artifact_id": result.get("panel_id")
                if destination == "chat"
                else None,
            }
        )

    @tool
    async def add_artifact_to_canvas(artifact_id: str) -> str:
        """Add an existing chat artifact to the active Canvas tab; preserve its sources and data."""
        artifact = next(
            (a for a in observed["artifacts"] if a["id"] == artifact_id), None
        )
        if artifact is None:
            return json.dumps({"error": "Unknown artifact. Inspect dashboard first."})
        identifier = str(uuid4())
        return json.dumps(
            await change(
                "add",
                identifier,
                {
                    **artifact,
                    "id": identifier,
                    "source_artifact_id": artifact_id,
                    "tab_id": observed["active_tab_id"],
                },
            )
        )

    @tool
    async def refresh_canvas_panel(panel_id: str) -> str:
        """Refresh the existing live financial panel's stored SEC query without regenerating its UI. Snapshot panels must explicitly be changed to live first."""
        nonlocal observed
        async with mutation_lock:
            try:
                observed = await refresh_panel(
                    thread_id,
                    {
                        "action": "refresh",
                        "panel_id": panel_id,
                        "payload": {},
                        "base_revision": observed["revision"],
                        "operation_id": str(uuid4()),
                    },
                )
                panel = store.panel_by_id(observed, panel_id)
                error = panel.get("refresh", {}).get("error")
                return json.dumps(
                    {
                        "success": not bool(error),
                        "error": error,
                        "revision": observed["revision"],
                    }
                )
            except (ValueError, KeyError) as exc:
                return json.dumps({"success": False, "error": str(exc)})

    @tool
    async def pin_canvas_panel(panel_id: str, pinned: bool) -> str:
        """Set an existing Canvas panel's position lock. True pins, false unpins. Preserve content, inputs and layout. Use this for pin/unpin requests, not publish tools."""
        return json.dumps(await change("pin", panel_id, {"pinned": pinned}))

    @tool
    async def modify_dashboard(
        action: Literal[
            "update",
            "remove",
            "select",
            "pin",
            "layout",
            "tab_add",
            "tab_select",
            "tab_rename",
            "tab_remove",
            "export",
            "refresh_policy",
        ],
        panel_id: str = "",
        payload: dict | None = None,
        tab_id: str = "",
    ) -> str:
        """Modify existing Canvas via common commands. Inspect first and use actual IDs.

        action: update, remove, select, pin, layout, tab_add, tab_select, tab_rename, tab_remove, export, refresh_policy.
        update payload {title: newTitle} renames a PANEL, or {tab_id: targetTabId} moves it to a tab.
        tab_rename renames a TAB only, never a panel.
        pin payload {pinned:true}; layout {layouts:[{id,layout:{x,y,w,h}}]} on a 24-column grid.
        tab_add {title}; tab_select/tab_remove {id}; tab_rename {id,title}.
        For a nonempty tab, tab_remove also needs {remove_panels:true}. Ask the user to confirm deletion of the tab AND its panels unless their request already explicitly includes both. Never silently remove contents.
        export {format:'json'|'csv'|'print'} makes download/print available in frontend.
        refresh_policy {mode:"live"|"snapshot", interval_seconds:0|60|300|900}; change only explicitly requested policy fields.
        select focuses panel. Never move pinned panels without an explicit unpin request.
        """
        if tab_id:
            payload = dict(payload or {})
            if payload.get("id") and payload["id"] != tab_id:
                return json.dumps({"success": False, "error": "Conflicting tab IDs"})
            payload["id"] = tab_id
        if action not in (
            "update",
            "remove",
            "select",
            "pin",
            "layout",
            "tab_add",
            "tab_select",
            "tab_rename",
            "tab_remove",
            "export",
            "refresh_policy",
        ):
            return json.dumps({"error": "Unsupported action"})
        if action == "update" and set(payload or {}) - {"title", "tab_id"}:
            return json.dumps(
                {
                    "success": False,
                    "error": "update accepts title/tab_id only. For pin use pin_canvas_panel(panel_id, pinned). For layout use modify_dashboard(action=layout, payload={layouts:[{id,layout:{x,y,w,h}}]}). Use publish tools ONLY for content/data changes.",
                }
            )
        return json.dumps(
            await change(action, panel_id or None, payload), ensure_ascii=False
        )

    return [
        inspect_dashboard,
        publish_ui_panel,
        publish_financial_chart,
        add_artifact_to_canvas,
        modify_dashboard,
        refresh_canvas_panel,
        pin_canvas_panel,
    ]
