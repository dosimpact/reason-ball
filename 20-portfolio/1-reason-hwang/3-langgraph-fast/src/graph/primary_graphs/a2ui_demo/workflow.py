"""Independent, in-memory demo graphs; existing chat graphs are unaffected."""
from __future__ import annotations

import json
from dataclasses import replace
from typing import cast
from uuid import uuid4

from ag_ui_langgraph import get_a2ui_tools
from copilotkit import CopilotKitMiddleware, a2ui
from langchain.agents import create_agent
from langchain.agents.middleware import AgentState
from langchain.agents.middleware.types import InputAgentState
from langchain.tools import ToolRuntime, tool
from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import StructuredTool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from .cabin import cabin_operations
from .contract import (
    MANIFEST,
    ContractError,
    Mode,
    load_catalog,
    parse_operations,
    validate_operations,
)
from .data import FLIGHTS, SALES
from .facts import FACTS, validate_fact_bindings
from .surfaces import apply_action, attach_sales_controls, flight_operations


class DemoState(AgentState, total=False):
    surfaces: dict
    a2ui_action: dict | None
    copilotkit: dict


DemoState.__annotations__["ag-ui"] = dict

SALES_INSTRUCTION = (
    "You are Vantage Threads' fictional sales analyst. Call generate_a2ui exactly once "
    "for every business question and then answer in one short Korean sentence. "
    "Use only this dataset, denominated in USD: " + json.dumps(SALES, ensure_ascii=False) + ". "
    "Snapshot: composed KPIs and charts; team: Table; risk: Badge; account: InfoRow; "
    "part-of-whole: pie Chart; trend/comparison: bar Chart. Total revenue is $680,000. "
    "Never ask which chart to use. A separate server-owned region query panel is added automatically."
)


def build_dynamic_tool(model):
    catalog = load_catalog("dynamic")
    planner = get_a2ui_tools({
        "model": model,
        "catalog": catalog,
        "default_catalog_id": MANIFEST["catalogs"]["dynamic"]["catalogId"],
        "guidelines": {"composition_guide": (
            SALES_INSTRUCTION + " Create exactly one surface, with root ID root. "
            "Use one complete updateComponents. Metric.value and InfoRow.value MUST be {path: '/facts/...'} "
            "bindings to server string facts. Chart.data MUST bind to /facts/series/regions, /facts/series/months, "
            "/facts/series/team or /facts/series/risk. Table.rows MUST bind to /facts/tables/team or "
            "/facts/tables/accounts and columns must use the keys in those rows. "
            "NEVER put numeric literals in display text, chart data or table rows. "
            "Bind dates and values rather than embedding them in text. The server injects all facts; "
            "include data.facts with the referenced values below so the toolkit can resolve bindings. "
            "The server replaces that data with its authoritative snapshot before rendering. "
            "These are the authoritative data-model values under /facts: "
            + json.dumps(FACTS, ensure_ascii=False) + ". "
            "Do not use IDs beginning demo-. Do not generate actions or input controls. "
            "Only these component schemas are available: " + json.dumps(catalog["components"])
        )},
    })

    if not isinstance(planner, StructuredTool) or planner.coroutine is None:
        raise TypeError("The installed A2UI toolkit must provide an async structured tool")
    generate_surface = planner.coroutine

    @tool(return_direct=True)
    async def generate_a2ui(runtime: ToolRuntime) -> str:
        """Compose a new sales dashboard from the current conversation. Takes no user arguments."""
        attempt_runtime = runtime
        for attempt in range(2):
            await adispatch_custom_event("a2ui.progress", {"stage": "composing" if attempt == 0 else "retrying"})
            result = await generate_surface(runtime=attempt_runtime)
            await adispatch_custom_event("a2ui.progress", {"stage": "validating"})
            try:
                operations = parse_operations(result)
                if not operations:
                    raise ContractError("A2UI planner did not produce a valid surface")
                validate_operations("dynamic", operations, existing=runtime.state.get("surfaces", {}))
                validate_fact_bindings(operations)
                operations = attach_sales_controls(operations)
                validate_operations("dynamic", operations, existing=runtime.state.get("surfaces", {}))
                return a2ui.render(operations)
            except ContractError as error:
                if attempt == 1:
                    raise
                messages = runtime.state["messages"]
                correction = HumanMessage(content=f"Correct the rejected UI: {error}. Use server /facts/ bindings; do not calculate or write numeric literals.")
                attempt_runtime = replace(runtime, state={**runtime.state, "messages": [*messages[:-1], correction, messages[-1]]})
        raise ContractError("A2UI generation failed")

    return generate_a2ui


@tool(return_direct=True)
def display_flight(flight_id: str = "demo-icn-nrt") -> str:
    """Display a fictional flight by its exact ID from the available flights in the system prompt. Never books a flight."""
    operations = flight_operations(flight_id)
    validate_operations("fixed", operations)
    return a2ui.render(operations)


@tool(return_direct=True)
def display_cabin_options(flight_id: str = "demo-icn-nrt") -> str:
    """Show BOTH meal and seat choices in one fixed UI for a fictional flight. No real booking."""
    operations = cabin_operations(flight_id)
    validate_operations("fixed", operations)
    return a2ui.render(operations)


def build_graph(mode: Mode, model):
    agent = create_agent(
        model=model,
        tools=[build_dynamic_tool(model)] if mode == "dynamic" else [display_flight, display_cabin_options],
        middleware=[CopilotKitMiddleware()],
        state_schema=DemoState,
        system_prompt=SALES_INSTRUCTION if mode == "dynamic" else (
            "Show fictional flights using display_flight, once per requested flight. "
            "For meal or seat selection requests, call ONLY display_cabin_options once; "
            "this single tool shows BOTH selectors together. Use the requested or previously discussed flight ID. "
            "If no flight is specified, use demo-icn-nrt as an explicitly labeled demo. "
            "Do not call display_flight for a cabin selection request. "
            "Never claim to book tickets or report real availability/prices. Reply briefly in Korean. "
            "Map cities to demo airports: 인천/서울=ICN, 도쿄=NRT, 부산=PUS, 오사카=KIX, 방콕=BKK, 싱가포르=SIN. "
            "Respect the requested direction. For a route absent from the data, do not call display_flight; "
            "say '데모 데이터에 해당 노선이 없습니다. 실제 항공편 운항 여부를 조회한 결과는 아닙니다.' "
            "and suggest an available demo route. All prices are fictional. Available flights: "
            + json.dumps(FLIGHTS)
        ),
    )

    async def generate(state: DemoState):
        await adispatch_custom_event("a2ui.progress", {"stage": "analyzing"})
        before_ids = {message.id for message in state["messages"] if message.id}
        result = await agent.ainvoke(cast(InputAgentState, state))
        new_messages = [message for message in result["messages"] if message.id not in before_ids]
        surfaces = state.get("surfaces", {})
        generated = False
        for message in new_messages:
            if isinstance(message, ToolMessage):
                operations = parse_operations(message.content)
                if operations:
                    surfaces = validate_operations(mode, operations, existing=surfaces)
                    generated = True
        if not generated and mode == "fixed" and any(
            isinstance(message, AIMessage) and message.content for message in new_messages
        ) and not any(isinstance(message, ToolMessage) or (
            isinstance(message, AIMessage) and message.tool_calls
        ) for message in new_messages):
            # Unsupported routes and clarification questions are valid text-only turns.
            return {"messages": new_messages, "surfaces": surfaces, "a2ui_action": None}
        if not generated:
            raise ContractError("The model returned no A2UI surface; please retry")
        await adispatch_custom_event("a2ui.progress", {"stage": "delivering"})
        new_messages.append(AIMessage(content="요청한 화면을 준비했습니다."))
        return {"messages": new_messages, "surfaces": surfaces, "a2ui_action": None}

    async def handle_action(state: DemoState):
        action = state.get("a2ui_action")
        if action is None:
            raise ContractError("Missing action")
        await adispatch_custom_event("a2ui.progress", {"stage": "updating"})
        operations, surfaces = apply_action(mode, action, state.get("surfaces", {}))
        call_id = f"action-{uuid4().hex}"
        return {
            "surfaces": surfaces, "a2ui_action": None,
            "messages": [
                AIMessage(content="", tool_calls=[{"id": call_id, "name": "apply_a2ui_action", "args": {}}]),
                ToolMessage(content=a2ui.render(operations), tool_call_id=call_id, name="apply_a2ui_action"),
                AIMessage(content="화면에 반영했습니다."),
            ],
        }

    graph = StateGraph(DemoState)
    graph.add_node("generate", generate)
    graph.add_node("handle_action", handle_action)
    graph.add_conditional_edges(START, lambda state: "handle_action" if state.get("a2ui_action") else "generate")
    graph.add_edge("generate", END)
    graph.add_edge("handle_action", END)
    return graph.compile(checkpointer=InMemorySaver())
