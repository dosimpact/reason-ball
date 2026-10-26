"""같은 명령을 UI/Agent가 사용하며, 상태 충돌·중복·고정을 검사합니다."""

from uuid import uuid4

import pytest

from agent import history
from agent.dashboard import store


@pytest.fixture
def thread(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    return history.create_thread("Dashboard tests")["id"]


def command(action, revision=0, panel_id=None, payload=None, operation_id=None):
    return {
        "action": action,
        "base_revision": revision,
        "panel_id": panel_id,
        "payload": payload or {},
        "operation_id": operation_id or str(uuid4()),
    }


def test_idempotence_revision_and_thread_isolation(thread):
    add = command(
        "add", panel_id="p1", payload={"title": "First", "program": "root = Card([])"}
    )
    result = store.execute(thread, add)
    assert result["revision"] == 1
    assert store.execute(thread, add) == result
    with pytest.raises(store.Conflict):
        store.execute(thread, command("remove", panel_id="p1"))
    other = history.create_thread("Other")["id"]
    assert store.read(other)["panels"] == []
    assert store.read(thread)["panels"][0]["id"] == "p1"


def test_pin_and_collision(thread):
    state = store.execute(
        thread,
        command(
            "add",
            panel_id="p1",
            payload={"title": "First", "program": "root = Card([])"},
        ),
    )
    state = store.execute(
        thread, command("pin", state["revision"], "p1", {"pinned": True})
    )
    with pytest.raises(ValueError, match="Unpin"):
        store.execute(
            thread,
            command(
                "layout",
                state["revision"],
                payload={
                    "layouts": [
                        {"id": "p1", "layout": {"x": 0, "y": 5, "w": 12, "h": 12}}
                    ]
                },
            ),
        )
    state = store.execute(
        thread,
        command(
            "add",
            state["revision"],
            "p2",
            {"title": "Second", "program": "root = Card([])"},
        ),
    )
    assert state["panels"][0]["layout"]["y"] == 0
    assert state["panels"][1]["layout"]["y"] == 12


def test_remove_does_not_delete_chat_or_artifact(thread):
    history.save_messages(thread, [{"role": "user", "content": "Keep this history"}])
    panel = {"title": "Original", "program": "root = Card([])"}
    state = store.execute(thread, command("artifact_add", panel_id="a1", payload=panel))
    state = store.execute(
        thread,
        command("add", state["revision"], "p1", {**panel, "source_artifact_id": "a1"}),
    )
    state = store.execute(thread, command("remove", state["revision"], "p1"))
    assert state["panels"] == [] and len(state["artifacts"]) == 1
    assert history.get_messages(thread)[0]["content"] == "Keep this history"


def test_reject_empty_financial_and_invalid_tab(thread):
    with pytest.raises(ValueError, match="sourced"):
        store.execute(
            thread,
            command(
                "add", panel_id="p1", payload={"title": "No data", "kind": "financial"}
            ),
        )
    with pytest.raises(ValueError, match="Unknown tab"):
        store.execute(
            thread,
            command(
                "add",
                panel_id="p2",
                payload={
                    "title": "Bad tab",
                    "program": "root = Card([])",
                    "tab_id": "missing",
                },
            ),
        )
    assert store.read(thread)["revision"] == 0


def test_import_is_atomic_and_preserves_existing(thread):
    state = store.execute(
        thread,
        command(
            "add",
            panel_id="first",
            payload={"title": "Existing", "program": "root = Card([])"},
        ),
    )
    exported = state["panels"][0]
    incoming = {"tabs": [{"id": "main", "title": "Imported"}], "panels": [exported]}
    state = store.execute(
        thread, command("import", state["revision"], payload=incoming)
    )
    assert len(state["panels"]) == 2
    assert state["panels"][0]["id"] == "first"
    assert state["panels"][1]["id"] != "first"
    assert state["panels"][1]["tab_id"] != "main"
    with pytest.raises(ValueError, match="Unknown imported tab"):
        store.execute(
            thread,
            command(
                "import",
                state["revision"],
                payload={**incoming, "panels": [{**exported, "tab_id": "bad"}]},
            ),
        )
    assert len(store.read(thread)["panels"]) == 2


def test_root_can_follow_variable_declarations(thread):
    program = "$current = 120\n$prior = 100\nroot=Card([IuiText(@YearOverYear($current, $prior))])"
    result = store.execute(
        thread,
        command(
            "add", panel_id="calculator", payload={"title": "Demo", "program": program}
        ),
    )
    assert result["panels"][0]["program"] == program
    with pytest.raises(ValueError, match="root assignment"):
        store.execute(
            thread,
            command(
                "add",
                revision=1,
                panel_id="invalid",
                payload={"title": "Invalid", "program": 'label = "root = Card([])"'},
            ),
        )


def test_pinned_tab_move_is_atomic_and_unpin_allows_move(thread):
    state = store.execute(
        thread,
        command(
            "add",
            panel_id="p1",
            payload={
                "title": "Pinned",
                "program": "root = Card([])",
                "ui_state": {"value": 150},
            },
        ),
    )
    state = store.execute(
        thread, command("tab_add", state["revision"], payload={"title": "Target"})
    )
    target = state["active_tab_id"]
    state = store.execute(
        thread, command("pin", state["revision"], "p1", {"pinned": True})
    )
    with pytest.raises(ValueError, match="Unpin"):
        store.execute(
            thread, command("update", state["revision"], "p1", {"tab_id": target})
        )
    assert store.read(thread) == state
    state = store.execute(
        thread, command("pin", state["revision"], "p1", {"pinned": False})
    )
    state = store.execute(
        thread, command("update", state["revision"], "p1", {"tab_id": target})
    )
    assert state["panels"][0]["tab_id"] == target
    assert state["panels"][0]["ui_state"] == {"value": 150}


def test_parallel_agent_commands_serialize_without_hiding_external_conflicts(thread):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    state = store.execute(
        thread,
        command(
            "add", panel_id="p1", payload={"title": "One", "program": "root=Card([])"}
        ),
    )
    state = store.execute(
        thread,
        command(
            "add", state["revision"], "p2", {"title": "Two", "program": "root=Card([])"}
        ),
    )

    async def run():
        tools = {tool.name: tool for tool in build_dashboard_tools(thread)}
        results = await asyncio.gather(
            *[
                tools["modify_dashboard"].ainvoke(
                    {"action": "update", "panel_id": pid, "payload": {"title": title}}
                )
                for pid, title in [("p1", "First"), ("p2", "Second")]
            ]
        )
        assert all(json.loads(result)["success"] for result in results)
        before_pin = store.read(thread)["panels"][0]
        pinned = json.loads(
            await tools["pin_canvas_panel"].ainvoke({"panel_id": "p1", "pinned": True})
        )
        assert pinned["success"] is True
        after_pin = store.read(thread)["panels"][0]
        assert after_pin == {**before_pin, "pinned": True}
        current = store.read(thread)
        assert [p["title"] for p in current["panels"]] == ["First", "Second"]
        store.execute(
            thread, command("pin", current["revision"], "p1", {"pinned": True})
        )
        result = json.loads(
            await tools["modify_dashboard"].ainvoke(
                {"action": "update", "panel_id": "p2", "payload": {"title": "Stale"}}
            )
        )
        assert result["success"] is False
        assert store.read(thread)["panels"][1]["title"] == "Second"

    asyncio.run(run())


def test_nonempty_tab_removal_requires_confirmation_and_preserves_other_data(thread):
    history.save_messages(thread, [{"role": "user", "content": "Keep analysis"}])
    panel = {"title": "Source", "program": "root = Card([])"}
    state = store.execute(thread, command("artifact_add", panel_id="a1", payload=panel))
    state = store.execute(thread, command("add", state["revision"], "keep", panel))
    kept_panel = state["panels"][0]
    state = store.execute(
        thread, command("tab_add", state["revision"], payload={"title": "Remove"})
    )
    tab_id = state["active_tab_id"]
    state = store.execute(
        thread,
        command(
            "add",
            state["revision"],
            "remove",
            {**panel, "tab_id": tab_id, "source_artifact_id": "a1"},
        ),
    )
    for confirmation in (None, False, "true"):
        with pytest.raises(ValueError, match="Confirm"):
            store.execute(
                thread,
                command(
                    "tab_remove",
                    state["revision"],
                    payload={"id": tab_id, "remove_panels": confirmation},
                ),
            )
        assert store.read(thread) == state
    delete = command(
        "tab_remove", state["revision"], payload={"id": tab_id, "remove_panels": True}
    )
    result = store.execute(thread, delete)
    assert result["panels"] == [kept_panel]
    assert result["artifacts"] == state["artifacts"]
    assert result["selected_panel_id"] is None
    assert result["active_tab_id"] == "main"
    assert store.execute(thread, delete) == result
    assert history.get_messages(thread)[0]["content"] == "Keep analysis"
    with pytest.raises(ValueError, match="at least one"):
        store.execute(
            thread,
            command(
                "tab_remove",
                result["revision"],
                payload={"id": "main", "remove_panels": True},
            ),
        )
    assert store.read(thread) == result


def test_repeated_chat_publication_reuses_artifact_id(thread, monkeypatch):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(*args, **kwargs):
        return None

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        publish = next(
            t for t in build_dashboard_tools(thread) if t.name == "publish_ui_panel"
        )
        args = {"title": "Form", "program": "root = Card([])", "destination": "chat"}
        results = await asyncio.gather(publish.ainvoke(args), publish.ainvoke(args))
        a, b = [json.loads(r) for r in results]
        assert a["artifact_id"] == b["artifact_id"]
        assert len(store.read(thread)["artifacts"]) == 1
        assert store.read(thread)["revision"] == 1

    asyncio.run(run())


def test_retrying_same_canvas_publication_does_not_duplicate(thread, monkeypatch):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(*args, **kwargs):
        return None

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        publish = next(
            t for t in build_dashboard_tools(thread) if t.name == "publish_ui_panel"
        )
        args = {"title": "Memo", "program": "root = Card([])", "destination": "canvas"}
        results = await asyncio.gather(publish.ainvoke(args), publish.ainvoke(args))
        a, b = [json.loads(r) for r in results]
        assert a["panel_id"] == b["panel_id"]
        assert len(store.read(thread)["panels"]) == 1

    asyncio.run(run())


def test_publication_saves_rendered_sources_and_replaces_old_citations(
    thread, monkeypatch
):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    first = {
        "title": "First",
        "sourceName": "Company",
        "url": "https://example.com/first",
    }
    second = {
        "title": "Second",
        "sourceName": "Company",
        "url": "https://example.com/second",
    }

    async def validate(program):
        return {"sources": [first] if "First" in program else [second]}

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        publish = next(
            t for t in build_dashboard_tools(thread) if t.name == "publish_ui_panel"
        )
        added = json.loads(
            await publish.ainvoke(
                {
                    "title": "Report",
                    "program": 'root = Card([TextContent("First")])',
                    "destination": "canvas",
                    "sources": [first],
                }
            )
        )
        assert store.read(thread)["panels"][0]["sources"] == [first]
        await publish.ainvoke(
            {
                "title": "Report",
                "program": 'root = Card([TextContent("Second")])',
                "panel_id": added["panel_id"],
            }
        )
        panel = store.read(thread)["panels"][0]
        assert panel["sources"] == [second]
        assert panel["id"] == added["panel_id"]

    asyncio.run(run())


def test_created_tab_id_can_target_parallel_publications(thread, monkeypatch):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(program):
        return {"sources": []}

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        tools = {t.name: t for t in build_dashboard_tools(thread)}
        tab = json.loads(
            await tools["modify_dashboard"].ainvoke(
                {"action": "tab_add", "payload": {"title": "Temporary"}}
            )
        )
        assert tab["tab_id"] != "main"
        repeated = json.loads(
            await tools["modify_dashboard"].ainvoke(
                {"action": "tab_add", "payload": {"title": "Temporary"}}
            )
        )
        assert repeated["tab_id"] == tab["tab_id"]
        assert len(store.read(thread)["tabs"]) == 2
        await asyncio.gather(
            *[
                tools["publish_ui_panel"].ainvoke(
                    {
                        "title": title,
                        "program": 'root = Card([TextContent("Memo")])',
                        "destination": "canvas",
                        "tab_id": target,
                    }
                )
                for title, target in [("Keep", "main"), ("Delete", tab["tab_id"])]
            ]
        )
        panels = store.read(thread)["panels"]
        assert {p["title"]: p["tab_id"] for p in panels} == {
            "Keep": "main",
            "Delete": tab["tab_id"],
        }
        denied = json.loads(
            await tools["modify_dashboard"].ainvoke(
                {"action": "tab_remove", "tab_id": tab["tab_id"]}
            )
        )
        assert not denied["success"]
        removed = json.loads(
            await tools["modify_dashboard"].ainvoke(
                {
                    "action": "tab_remove",
                    "tab_id": tab["tab_id"],
                    "payload": {"remove_panels": True},
                }
            )
        )
        assert removed["success"]
        assert removed["removed_panel_ids"] == [
            next(p["id"] for p in panels if p["title"] == "Delete")
        ]
        assert [p["title"] for p in store.read(thread)["panels"]] == ["Keep"]

    asyncio.run(run())


def test_plan_destination_and_new_panel_limit_survive_parallel_retries(
    thread, monkeypatch
):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(program):
        if program == "invalid":
            raise ValueError("Invalid program")
        return {"sources": []}

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        tools = {
            t.name: t
            for t in build_dashboard_tools(
                thread, allowed_publications={"canvas"}, new_panel_limit=1
            )
        }
        publish = tools["publish_ui_panel"]
        bad = json.loads(
            await publish.ainvoke({"title": "Quarterly", "program": "invalid"})
        )
        assert bad["success"] is False
        wrong = json.loads(
            await publish.ainvoke(
                {
                    "title": "Quarterly",
                    "program": "root = Card([])",
                    "destination": "chat",
                }
            )
        )
        assert wrong["success"] is False and not store.read(thread)["artifacts"]
        args = [
            {
                "title": "Quarterly",
                "program": f'root = Card([TextContent("Version {i}")])',
            }
            for i in range(2)
        ]
        results = [
            json.loads(r)
            for r in await asyncio.gather(*(publish.ainvoke(a) for a in args))
        ]
        assert sum(r["success"] for r in results) == 1
        state = store.read(thread)
        assert len(state["panels"]) == 1 and not state["artifacts"]
        winner = next(i for i, r in enumerate(results) if r["success"])
        identifier = results[winner]["panel_id"]
        repeated = json.loads(await publish.ainvoke(args[winner]))
        assert repeated["panel_id"] == identifier
        assert store.read(thread)["revision"] == state["revision"]
        edited = json.loads(
            await publish.ainvoke({**args[1 - winner], "panel_id": identifier})
        )
        assert edited["success"] is True
        assert len(store.read(thread)["panels"]) == 1
        assert store.read(thread)["panels"][0]["program"] == args[1 - winner]["program"]
        # A new user run has its own creation allowance.
        next_publish = next(
            t
            for t in build_dashboard_tools(
                thread, allowed_publications={"canvas"}, new_panel_limit=1
            )
            if t.name == "publish_ui_panel"
        )
        assert json.loads(
            await next_publish.ainvoke(
                {"title": "Next request", "program": "root = Card([])"}
            )
        )["success"]
        assert len(store.read(thread)["panels"]) == 2

    asyncio.run(run())


def test_chat_only_publication_policy_cannot_add_canvas(thread, monkeypatch):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(program):
        return {"sources": []}

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        publish = next(
            t
            for t in build_dashboard_tools(
                thread, allowed_publications={"chat"}, new_panel_limit=0
            )
            if t.name == "publish_ui_panel"
        )
        args = {"title": "Reusable chart", "program": "root = Card([])"}
        assert json.loads(await publish.ainvoke(args))["success"]
        assert not store.read(thread)["panels"]
        assert (
            json.loads(await publish.ainvoke({**args, "destination": "canvas"}))[
                "success"
            ]
            is False
        )
        mixed = next(
            t
            for t in build_dashboard_tools(
                thread, allowed_publications={"chat", "canvas"}
            )
            if t.name == "publish_ui_panel"
        )
        assert json.loads(await mixed.ainvoke(args))["success"] is False
        assert len(store.read(thread)["artifacts"]) == 1

    asyncio.run(run())


def test_two_panel_limit_allows_two_distinct_items_and_rejects_third(
    thread, monkeypatch
):
    import asyncio
    import json

    from agent.dashboard.tools import build_dashboard_tools

    async def validate(program):
        return {"sources": []}

    monkeypatch.setattr("agent.dashboard.tools.validate_program", validate)

    async def run():
        publish = next(
            t
            for t in build_dashboard_tools(
                thread, allowed_publications={"canvas"}, new_panel_limit=2
            )
            if t.name == "publish_ui_panel"
        )
        results = [
            json.loads(r)
            for r in await asyncio.gather(
                *(
                    publish.ainvoke(
                        {"title": f"Panel {i}", "program": "root = Card([])"}
                    )
                    for i in range(3)
                )
            )
        ]
        assert sum(r["success"] for r in results) == 2
        assert len(store.read(thread)["panels"]) == 2

    asyncio.run(run())
