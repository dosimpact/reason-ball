"""SEC-A2UI-11: inline history, persistent Canvas, and per-surface actions."""
from copy import deepcopy
from uuid import uuid4

import pytest
from ag_ui.core import RunAgentInput
from ag_ui_langgraph import LangGraphAgent
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from graph.primary_graphs.a2ui_demo.contract import (
    MANIFEST,
    ContractError,
    parse_operations,
)
from graph.primary_graphs.sec_a2ui.agent_tools import surface_update
from graph.primary_graphs.sec_a2ui.surface import validate_action
from server.a2ui.router import prepare_input
from tests.test_sec_a2ui_workflow import CIK, action, graph


def query_state(query):
    return {"query": query, "companies": {"items": [], "pagination": {}}}


def test_inline_allocates_new_surface_while_canvas_and_history_are_preserved():
    first = surface_update({}, query_state("FIRST"))
    first_id = next(iter(first["surfaces"]))
    old_action = action(first, "search-button", query="stale")
    second = surface_update(first, query_state("SECOND"))
    second_id = next(iter(second["surfaces"]))
    assert first_id != second_id and second_id.startswith("sec-inline-")
    assert second["pending_operations"][0]["createSurface"]["surfaceId"] == second_id
    assert first["sec"]["query"] == "FIRST"
    with pytest.raises(ContractError):
        validate_action(old_action, second["surfaces"])
    canvas = surface_update({**second, "output_target": "canvas"}, query_state("CANVAS"))
    canvas_id = canvas["canvas_surface_id"]
    canvas_before = deepcopy(canvas["surfaces"][canvas_id])
    third = surface_update({**canvas, "output_target": "inline"}, query_state("THIRD"))
    assert len(third["surfaces"]) == 2
    assert third["surfaces"][canvas_id] == canvas_before
    assert third["surface_contexts"][canvas_id]["sec"]["query"] == "CANVAS"
    assert second_id not in third["surfaces"]


def test_canvas_reuses_id_and_action_targets_original_surface_despite_selector():
    first = surface_update({"output_target": "canvas"}, query_state("FIRST"))
    second = surface_update({**first, "output_target": "canvas"}, query_state("SECOND"))
    canvas_id = first["canvas_surface_id"]
    assert second["canvas_surface_id"] == canvas_id
    assert all("createSurface" not in operation for operation in second["pending_operations"])
    inline = surface_update({**second, "output_target": "inline"}, query_state("INLINE"))
    canvas_action = action({"surfaces": {canvas_id: inline["surfaces"][canvas_id]}}, "search-button", query="ACTION")
    updated = surface_update({**inline, "output_target": "inline", "a2ui_action": canvas_action}, query_state("ACTION"))
    assert updated["surface_contexts"][canvas_id]["sec"]["query"] == "ACTION"
    inline_id = next(key for key in inline["surfaces"] if key != canvas_id)
    assert updated["surfaces"][inline_id] == inline["surfaces"][inline_id]
    assert all("createSurface" not in operation for operation in updated["pending_operations"])


@pytest.mark.asyncio
async def test_multiple_renders_in_one_run_create_separate_inline_results():
    responses = [
        AIMessage(content="", tool_calls=[{"id": str(uuid4()), "name": name, "args": args}])
        for name, args in [("search_companies", {"query": "DEMO"}), ("render_fixed_ui", {}),
                           ("list_filings", {"cik": CIK}), ("render_fixed_ui", {})]
    ]
    workflow = graph(agent_responses=[*responses, AIMessage(content="표시했습니다.")])
    result = await workflow.ainvoke({"messages": [HumanMessage(content="회사 다음 공시")]}, {"configurable": {"thread_id": "two-renders"}})
    ids = [operation["createSurface"]["surfaceId"] for message in result["messages"]
           for operation in (parse_operations(message.content) or []) if "createSurface" in operation]
    assert len(ids) == len(set(ids)) == 2
    assert list(result["surfaces"]) == [ids[-1]]


@pytest.mark.asyncio
async def test_canvas_button_uses_its_saved_company_context_after_inline_reset():
    workflow = graph()
    config: RunnableConfig = {"configurable": {"thread_id": "contexts"}}
    first = await workflow.ainvoke({"messages": [HumanMessage(content="DEMO")], "output_target": "canvas"}, config)
    canvas_id = first["canvas_surface_id"]
    # Simulate a later validated Inline render with a different/empty selection.
    inline = surface_update({**first, "output_target": "inline"}, query_state("EMPTY"))
    await workflow.aupdate_state(config, {**inline, "output_target": "inline"})
    result = await workflow.ainvoke({"messages": [], "a2ui_action": action(first, "company-select", cik=CIK)}, config)
    assert result["surface_contexts"][canvas_id]["sec"]["company"]["cik"] == CIK
    inline_id = next(key for key in inline["surfaces"] if key != canvas_id)
    assert result["surface_contexts"][inline_id]["sec"]["query"] == "EMPTY"
    assert result["surfaces"][inline_id] == inline["surfaces"][inline_id]


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["other", [], {"surfaceId": "forged"}])
async def test_target_enum_and_client_surface_state_are_not_trusted(target):
    agent = LangGraphAgent(name="a2ui-sec", graph=graph())
    value = RunAgentInput(thread_id="contract", run_id="one", state={"output_target": "canvas"}, messages=[], tools=[], context=[],
                          forwarded_props={"a2uiContract": {"protocolVersion": "v0.9", **MANIFEST["catalogs"]["sec"]}, "a2uiOutputTarget": target})
    with pytest.raises(ContractError, match="a2uiOutputTarget"):
        await prepare_input("sec", value, agent)
    assert isinstance(value.forwarded_props, dict)
    value.forwarded_props.pop("a2uiOutputTarget")
    prepared = await prepare_input("sec", value, agent)
    assert isinstance(prepared.state, dict)
    assert prepared.state["output_target"] == "inline"
