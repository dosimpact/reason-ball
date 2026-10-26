import json

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agent.dashboard.execution import (
    CanvasExecutionGuard,
    CanvasPlan,
    completed_operations,
    context,
)
from agent.dashboard.store import initial


def effect(action, success=True, destination="canvas"):
    name = "publish_ui_panel" if action == "publish" else "modify_dashboard"
    args = {"destination": destination} if action == "publish" else {"action": action}
    return [
        AIMessage(content="", tool_calls=[{"id": "call", "name": name, "args": args}]),
        ToolMessage(content=json.dumps({"success": success}), tool_call_id="call"),
    ]


def test_evidence_ignores_past_turns_failed_tools_and_chat_artifacts():
    messages = [
        HumanMessage("old"),
        *effect("remove"),
        HumanMessage("now"),
        *effect("pin", False),
    ]
    assert completed_operations(messages) == set()
    assert (
        completed_operations(
            [HumanMessage("now"), *effect("publish", destination="chat")]
        )
        == set()
    )
    assert completed_operations([HumanMessage("now"), *effect("publish")]) == {"add"}


@pytest.mark.anyio
async def test_guard_retries_only_missing_effects_then_reports_incomplete():
    guard = CanvasExecutionGuard(
        CanvasPlan(operations=["pin", "layout"], instruction="Pin and resize")
    )
    state = {
        "messages": [
            HumanMessage("Pin and resize"),
            *effect("pin"),
            AIMessage(id="draft", content="done"),
        ]
    }
    for _ in range(2):
        result = await guard.aafter_model(state, None)
        assert result["jump_to"] == "model"
        assert result["messages"][0].type == "remove"
        assert "no successful tool evidence: layout" in result["messages"][1].content
    result = await guard.aafter_model(state, None)
    assert "jump_to" not in result
    assert "분석 결과 저장 미완료" in result["messages"][0].content
    assert result["messages"][0].id == "draft"


@pytest.mark.anyio
async def test_guard_does_not_repeat_successful_operations_or_interrupt_tool_calls():
    guard = CanvasExecutionGuard(
        CanvasPlan(operations=["update"], instruction="Rename")
    )
    assert (
        await guard.aafter_model(
            {
                "messages": [
                    HumanMessage("Rename"),
                    *effect("update"),
                    AIMessage(content="saved"),
                ]
            },
            None,
        )
        is None
    )
    assert (
        await guard.aafter_model(
            {"messages": [HumanMessage("Rename"), effect("update")[0]]}, None
        )
        is None
    )


def test_context_exposes_selection_without_full_program_or_secrets():
    state = initial()
    state["panels"] = [
        {
            "id": "p",
            "title": "Revenue",
            "kind": "openui",
            "tab_id": "main",
            "pinned": False,
            "layout": {},
            "query": {},
            "program": "large program",
        }
    ]
    state["selected_panel_id"] = "p"
    snapshot = context(state)
    assert snapshot["selected_panel_id"] == "p"
    assert "program" not in snapshot["panels"][0]


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_compiled_graph_recovers_skipped_mutation_without_duplicate_tool_calls():
    from langchain.agents import create_agent
    from langchain_core.language_models.fake_chat_models import (
        FakeMessagesListChatModel,
    )
    from langchain_core.tools import tool

    class ScriptedModel(FakeMessagesListChatModel):
        def bind_tools(self, tools, **kwargs):
            return self

    calls = []

    @tool
    async def modify_dashboard(action: str) -> str:
        """Apply a Canvas action."""
        calls.append(action)
        return json.dumps({"success": True})

    graph = create_agent(
        model=ScriptedModel(
            responses=[
                AIMessage(id="skipped", content="I changed it"),
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": "actual",
                            "name": "modify_dashboard",
                            "args": {"action": "update"},
                        }
                    ],
                ),
                AIMessage(content="Confirmed saved"),
            ]
        ),
        tools=[modify_dashboard],
        middleware=[
            CanvasExecutionGuard(
                CanvasPlan(operations=["update"], instruction="Change selected title")
            )
        ],
    )
    result = await graph.ainvoke({"messages": [HumanMessage("Change title")]})
    assert calls == ["update"]
    assert result["messages"][-1].content == "Confirmed saved"
    assert not any(m.id == "skipped" for m in result["messages"])


def test_final_answer_accepts_text_blocks_without_tool_arguments():
    from agent.dashboard.execution import final_answer

    assert (
        final_answer(
            [
                {
                    "role": "assistant",
                    "content": [{"type": "text", "text": "root = Card([])"}],
                }
            ]
        )
        == "root = Card([])"
    )
    assert (
        final_answer(
            [
                {
                    "role": "assistant",
                    "content": "tool input",
                    "tool_calls": [{"id": "tool"}],
                }
            ]
        )
        == ""
    )


def test_chat_publication_requires_server_artifact_id_and_is_not_canvas_add():
    messages = [
        HumanMessage("Make an addable chat calculator"),
        *effect("publish", destination="chat"),
    ]
    messages[-1].content = json.dumps(
        {"success": True, "artifact_id": "stored-artifact"}
    )
    assert completed_operations(messages) == {"artifact_publish"}


@pytest.mark.anyio
async def test_guard_requires_publication_for_addable_chat_output():
    guard = CanvasExecutionGuard(
        CanvasPlan(
            operations=["artifact_publish"],
            instruction="Addable chat calculator, no Canvas panel",
        )
    )
    result = await guard.aafter_model(
        {
            "messages": [
                HumanMessage("Make it addable"),
                AIMessage(id="draft", content="root = Card([])"),
            ]
        },
        None,
    )
    assert result["jump_to"] == "model"
    assert "destination=chat" in result["messages"][-1].content


def targeted_call(action, panel_id, payload=None, success=True):
    call_id = f"{action}-{panel_id}"
    return [
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": call_id,
                    "name": "modify_dashboard",
                    "args": {
                        "action": action,
                        "panel_id": panel_id,
                        "payload": payload or {},
                    },
                }
            ],
        ),
        ToolMessage(content=json.dumps({"success": success}), tool_call_id=call_id),
    ]


@pytest.mark.anyio
async def test_guard_retries_missing_panel_even_if_same_operation_succeeded():
    plan = CanvasPlan(
        operations=["update"],
        instruction="Rename both panels",
        targets=[
            {"operation": "update", "target_id": "p1"},
            {"operation": "update", "target_id": "p2"},
        ],
    )
    guard = CanvasExecutionGuard(plan)
    messages = [
        HumanMessage("Rename both"),
        *targeted_call("update", "p1"),
        AIMessage(id="draft", content="Done"),
    ]
    retry = await guard.aafter_model({"messages": messages}, None)
    assert retry["jump_to"] == "model"
    evidence = retry["messages"][-1].content.split(". Request:")[0]
    assert "update target=p2" in evidence and "target=p1" not in evidence
    messages = (
        messages[:-1] + targeted_call("update", "p2") + [AIMessage(content="Done")]
    )
    assert await guard.aafter_model({"messages": messages}, None) is None


def test_batched_layout_requires_each_requested_target_and_success():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        operations=[],
        instruction="Resize both",
        targets=[
            {"operation": "layout", "target_id": "p1"},
            {"operation": "layout", "target_id": "p2"},
        ],
    )
    assert plan.operations == ["layout"]
    messages = [
        HumanMessage("Resize both"),
        *targeted_call("layout", "", {"layouts": [{"id": "p1", "layout": {"w": 12}}]}),
    ]
    assert missing_effects(plan, messages) == {"layout target=p2"}
    messages += targeted_call(
        "layout", "", {"layouts": [{"id": "p2", "layout": {"w": 12}}]}, False
    )
    assert missing_effects(plan, messages) == {"layout target=p2"}
    messages += targeted_call(
        "layout", "", {"layouts": [{"id": "p2", "layout": {"w": 12}}]}
    )
    assert missing_effects(plan, messages) == set()


def test_tab_and_artifact_targets_do_not_match_unrelated_ids():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        operations=["tab_rename"],
        instruction="Rename tab",
        targets=[{"operation": "tab_rename", "target_id": "tab-2"}],
    )
    messages = [
        HumanMessage("Rename"),
        *targeted_call("tab_rename", "", {"id": "tab-1", "title": "Renamed"}),
    ]
    assert missing_effects(plan, messages) == {"tab_rename target=tab-2"}


def test_dedicated_pin_tool_counts_only_its_target():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        operations=["pin"],
        instruction="Pin both",
        targets=[
            {"operation": "pin", "target_id": "p1"},
            {"operation": "pin", "target_id": "p2"},
        ],
    )
    messages = [
        HumanMessage("Pin both"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "pin1",
                    "name": "pin_canvas_panel",
                    "args": {"panel_id": "p1", "pinned": True},
                }
            ],
        ),
        ToolMessage(content='{"success": true}', tool_call_id="pin1"),
    ]
    assert missing_effects(plan, messages) == {"pin target=p2"}


def test_metadata_only_plan_cannot_publish_replacement_content():
    from types import SimpleNamespace

    from agent.dashboard.execution import tools_for_plan

    tools = [
        SimpleNamespace(name=name)
        for name in [
            "inspect_dashboard",
            "pin_canvas_panel",
            "modify_dashboard",
            "publish_ui_panel",
            "publish_financial_chart",
            "add_artifact_to_canvas",
        ]
    ]
    pin = CanvasPlan(operations=["pin"], instruction="Pin both")
    assert [tool.name for tool in tools_for_plan(tools, pin)] == [
        "inspect_dashboard",
        "pin_canvas_panel",
        "modify_dashboard",
    ]
    assert (
        tools_for_plan(
            tools, CanvasPlan(operations=["update"], instruction="Update chart")
        )
        == tools
    )
    assert tools_for_plan(tools, CanvasPlan(operations=[], instruction="Analysis")) == [
        tools[0]
    ]


def test_clarification_discards_mutations_and_exposes_only_inspection():
    from types import SimpleNamespace

    from agent.dashboard.execution import tools_for_plan

    plan = CanvasPlan(
        clarification="어느 탭의 패널인가요?",
        operations=["update", "remove"],
        targets=[{"operation": "remove", "target_id": "p1"}],
        instruction="Clarify duplicate titles",
    )
    assert plan.operations == []
    assert plan.targets == []
    tools = [
        SimpleNamespace(name=name)
        for name in (
            "inspect_dashboard",
            "modify_dashboard",
            "pin_canvas_panel",
            "publish_ui_panel",
            "publish_financial_chart",
            "add_artifact_to_canvas",
            "refresh_canvas_panel",
        )
    ]
    assert [t.name for t in tools_for_plan(tools, plan)] == ["inspect_dashboard"]


def test_analysis_only_plan_exposes_no_dashboard_writes():
    from types import SimpleNamespace

    from agent.dashboard.execution import tools_for_plan

    plan = CanvasPlan(
        operations=[], instruction="Compare reports without changing Canvas"
    )
    tools = [
        SimpleNamespace(name=n)
        for n in (
            "inspect_dashboard",
            "publish_ui_panel",
            "modify_dashboard",
            "refresh_canvas_panel",
        )
    ]
    assert [t.name for t in tools_for_plan(tools, plan)] == ["inspect_dashboard"]


def test_plan_rejects_chat_artifact_as_panel_target():
    from agent.dashboard.execution import plan_target_errors

    state = initial()
    state["artifacts"] = [{"id": "chat-card"}]
    invalid = CanvasPlan(
        operations=["update"],
        instruction="Wrong target",
        targets=[{"operation": "update", "target_id": "chat-card"}],
    )
    assert plan_target_errors(invalid, state)
    assert plan_target_errors(
        CanvasPlan(operations=["update"], instruction="Missing target"), state
    )
    assert (
        plan_target_errors(CanvasPlan(operations=[], instruction="SEC research"), state)
        == []
    )
    state["panels"] = [{"id": "real-panel"}]
    valid = CanvasPlan(
        operations=["pin"],
        instruction="Pin",
        targets=[{"operation": "pin", "target_id": "real-panel"}],
    )
    assert plan_target_errors(valid, state) == []


def test_multiple_new_panels_require_distinct_successful_ids():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        operations=[], minimum_new_panels=2, instruction="Memo and checklist"
    )
    assert plan.operations == ["add"]
    one = effect("publish")
    one[-1].content = '{"success":true,"panel_id":"p1"}'
    assert any(
        "1 more" in item
        for item in missing_effects(plan, [HumanMessage("Create two"), *one, *one])
    )
    two = effect("publish")
    two[-1].content = '{"success":true,"panel_id":"p2"}'
    assert missing_effects(plan, [HumanMessage("Create two"), *one, *two]) == set()


def test_new_panel_placeholder_targets_do_not_report_false_incomplete():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        minimum_new_panels=2,
        operations=["add"],
        instruction="Memo and checklist",
        targets=[
            {"operation": "add", "target_id": ""},
            {"operation": "add", "target_id": " "},
        ],
    )
    assert plan.targets == []
    messages = [HumanMessage("Create two")]
    for index in range(2):
        messages.extend(
            [
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": f"call{index}",
                            "name": "publish_ui_panel",
                            "args": {"destination": "canvas"},
                        }
                    ],
                ),
                ToolMessage(
                    content=json.dumps({"success": True, "panel_id": f"p{index}"}),
                    tool_call_id=f"call{index}",
                ),
            ]
        )
    assert missing_effects(plan, messages) == set()
    assert missing_effects(plan, messages[:-2])


def test_nonempty_tab_removal_requires_explicit_contents_confirmation():
    from agent.dashboard.execution import confirm_tab_contents

    state = {
        "tabs": [{"id": "temp", "title": "Temporary"}],
        "panels": [{"id": "p", "tab_id": "temp"}],
    }
    plan = CanvasPlan(
        operations=["tab_remove"],
        instruction="Delete tab",
        targets=[{"operation": "tab_remove", "target_id": "temp"}],
    )
    guarded = confirm_tab_contents(plan, state)
    assert guarded.operations == [] and guarded.targets == []
    assert "1개" in guarded.clarification
    confirmed = plan.model_copy(update={"remove_tab_contents_confirmed": True})
    assert confirm_tab_contents(confirmed, state).operations == ["tab_remove"]
    assert confirm_tab_contents(plan, {**state, "panels": []}).operations == [
        "tab_remove"
    ]


def test_creation_targets_reject_destination_tabs_and_fabricated_ids():
    from agent.dashboard.execution import plan_target_errors

    state = initial()
    plan = CanvasPlan(
        operations=["add"],
        minimum_new_panels=2,
        instruction="Create in main",
        targets=[{"operation": "add", "target_id": "main"}],
    )
    assert "destination tab" in plan_target_errors(plan, state)[0]
    state["artifacts"] = [{"id": "artifact-1"}]
    plan.targets[0].target_id = "artifact-1"
    assert plan_target_errors(plan, state) == []
    plan.targets[0].operation = "tab_add"
    assert "no target entry" in plan_target_errors(plan, state)[0]


def test_tab_deletion_accounts_for_actual_cascaded_panel_removals():
    from agent.dashboard.execution import missing_effects

    plan = CanvasPlan(
        operations=["tab_remove", "remove"],
        instruction="Delete both",
        targets=[
            {"operation": "tab_remove", "target_id": "tab1"},
            {"operation": "remove", "target_id": "p1"},
        ],
    )
    messages = [
        HumanMessage("Delete both"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "c",
                    "name": "modify_dashboard",
                    "args": {
                        "action": "tab_remove",
                        "tab_id": "tab1",
                        "payload": {"remove_panels": True},
                    },
                }
            ],
        ),
        ToolMessage(
            tool_call_id="c",
            content=json.dumps({"success": True, "removed_panel_ids": ["p1"]}),
        ),
    ]
    assert missing_effects(plan, messages) == set()
    messages[-1].content = json.dumps({"success": True, "removed_panel_ids": []})
    assert "remove target=p1" in missing_effects(plan, messages)


@pytest.mark.anyio
async def test_planning_uses_private_model_without_changing_streaming_chat(monkeypatch):
    from langchain_openai import ChatOpenAI

    from agent.dashboard.execution import OutputScope, plan_request

    captured = []

    class Planner:
        def __init__(self, schema):
            self.schema = schema

        async def ainvoke(self, messages, config):
            if self.schema is OutputScope:
                return OutputScope(reason="Explain in chat", destination="chat")
            return CanvasPlan(operations=[], instruction="Explain in chat")

    def structured(self, schema, **kwargs):
        captured.append(self)
        return Planner(schema)

    monkeypatch.setattr(ChatOpenAI, "with_structured_output", structured)
    model = ChatOpenAI(api_key="test-not-a-real-key", streaming=True, temperature=0.7)
    plan = await plan_request(
        model, [{"role": "user", "content": "Explain"}], initial()
    )
    assert plan.operations == []
    assert captured[0] is not model
    assert captured[0].streaming is False
    assert captured[0].temperature == 0
    assert model.streaming is True and model.temperature == 0.7


@pytest.mark.parametrize(
    "destination,operations", [("chat", []), ("chat_artifact", ["artifact_publish"])]
)
def test_output_scope_removes_unrequested_canvas_effects_but_keeps_research(
    destination, operations
):
    from agent.dashboard.execution import OutputScope, constrain_output_scope

    original = CanvasPlan(
        operations=["add", "remove"],
        minimum_new_panels=2,
        source_read="overview",
        instruction="Incorrect Canvas plan",
        targets=[{"operation": "remove", "target_id": "p1"}],
    )
    constrained = constrain_output_scope(
        original,
        OutputScope(destination=destination, reason="User requested chat output"),
    )
    assert constrained.operations == operations
    assert constrained.targets == [] and constrained.minimum_new_panels == 0
    assert constrained.source_read == "overview"
    assert (
        constrain_output_scope(
            original,
            OutputScope(destination="canvas", reason="Explicit Canvas request"),
        )
        is original
    )


def test_completed_effects_use_resolved_server_publication_destination():
    from agent.dashboard.execution import completed_effects

    messages = [
        HumanMessage("Add this to Canvas"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "c",
                    "name": "publish_ui_panel",
                    "args": {"title": "Revenue", "program": "root=Card([])"},
                }
            ],
        ),
        ToolMessage(
            tool_call_id="c",
            content=json.dumps(
                {
                    "success": True,
                    "panel_id": "p1",
                    "destination": "canvas",
                    "artifact_id": None,
                }
            ),
        ),
    ]
    assert completed_effects(messages) == {("add", "p1")}
    messages[-1].content = json.dumps(
        {"success": True, "panel_id": "a1", "destination": "chat", "artifact_id": "a1"}
    )
    assert completed_effects(messages) == {("artifact_publish", "a1")}


def test_explicit_upper_bound_is_optional_and_cannot_conflict_with_minimum():
    from pydantic import ValidationError

    plan = CanvasPlan(
        operations=["add"], instruction="At least two", minimum_new_panels=2
    )
    assert plan.maximum_new_panels is None
    with pytest.raises(ValidationError, match="exceeds maximum"):
        CanvasPlan(
            operations=["add"],
            instruction="Contradiction",
            minimum_new_panels=2,
            maximum_new_panels=1,
        )
