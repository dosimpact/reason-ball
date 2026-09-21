import asyncio
import json

import pytest
from ag_ui_langgraph import LangGraphAgent
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from graph.primary_graphs.a2ui_demo.contract import MANIFEST
from graph.primary_graphs.a2ui_demo.workflow import build_graph
from server.a2ui import router as transport
from server.a2ui.gate import StreamGate


class ToolModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def fixed_graph():
    return build_graph("fixed", ToolModel(responses=[
        AIMessage(content="", tool_calls=[{"id": "flight-call", "name": "display_flight", "args": {"flight_id": "demo-icn-nrt"}}]),
        AIMessage(content="항공편을 표시했습니다."),
    ]))


@pytest.mark.asyncio
async def test_graph_generation_action_and_thread_isolation():
    graph = fixed_graph()
    config: RunnableConfig = {"configurable": {"thread_id": "one"}}
    result = await graph.ainvoke({"messages": [HumanMessage(content="도쿄 항공편")], "surfaces": {}}, config)
    surface_id = next(iter(result["surfaces"]))
    updated = await graph.ainvoke({"messages": [], "a2ui_action": {
        "name": "select_flight", "surfaceId": surface_id, "sourceComponentId": "select",
        "context": {"flightId": "demo-icn-nrt"},
    }}, config)
    assert updated["surfaces"][surface_id]["data"]["selected"] is True
    assert updated["a2ui_action"] is None
    assert not (await graph.aget_state({"configurable": {"thread_id": "other"}})).values
    assert any('a2ui_operations' in str(message.content) for message in updated["messages"])


@pytest.mark.asyncio
async def test_gate_reserves_queued_threads_and_releases_on_cancellation():
    gate = StreamGate(active=1, queued=1)
    async with gate.reserve("active"):
        waiting = asyncio.Event()

        async def wait():
            waiting.set()
            async with gate.reserve("queued"):
                pass

        task = asyncio.create_task(wait())
        await waiting.wait()
        for name, status in [("queued", 409), ("overflow", 429)]:
            with pytest.raises(HTTPException) as error:
                async with gate.reserve(name):
                    pass
            assert error.value.status_code == status
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert gate.threads == {"active"}
    assert not gate.threads
    async with gate.reserve("next"):
        pass


def request_body(thread="http-one"):
    return {
        "threadId": thread, "runId": "run-one", "state": {},
        "messages": [{"id": "user-one", "role": "user", "content": "도쿄 항공편"}],
        "tools": [], "context": [],
        "forwardedProps": {"a2uiContract": {"protocolVersion": "v0.9", **MANIFEST["catalogs"]["fixed"]}},
    }


def test_http_sse_contract_rejection_and_surface_tampering(monkeypatch):
    agent = LangGraphAgent(name="a2ui-fixed", graph=fixed_graph())
    monkeypatch.setattr(transport, "get_agent", lambda mode: agent)
    app = FastAPI()
    app.include_router(transport.router)
    with TestClient(app) as client:
        body = request_body()
        body["forwardedProps"]["a2uiContract"]["sha256"] = "stale"
        assert client.post("/ag-ui/a2ui/fixed", json=body).status_code == 422
        body = request_body()
        body["state"] = {"surfaces": {"forged": {"data": {"price": "$0"}}}}
        response = client.post("/ag-ui/a2ui/fixed", json=body)
        assert response.status_code == 200
        events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
        assert any(event["type"] == "RUN_FINISHED" for event in events), events
        assert not any(event["type"] == "RUN_ERROR" for event in events), events
        progress = [event["value"]["stage"] for event in events if event.get("name") == "a2ui.progress"]
        assert progress == ["analyzing", "delivering"]
        assert next(i for i, event in enumerate(events) if event.get("name") == "a2ui.progress") < next(i for i, event in enumerate(events) if event["type"] == "RUN_FINISHED")
        assert "forged" not in response.text
        assert "a2ui_operations" in response.text


@pytest.mark.asyncio
async def test_action_ignores_cancelled_client_tool_fragments():
    from ag_ui.core import RunAgentInput

    agent = LangGraphAgent(name="a2ui-fixed", graph=fixed_graph())
    result = await agent.graph.ainvoke(
        {"messages": [HumanMessage(content="도쿄 항공편")], "surfaces": {}},
        {"configurable": {"thread_id": "cancelled-action"}},
    )
    surface_id = next(iter(result["surfaces"]))
    body = request_body("cancelled-action")
    body["messages"] = [{"id": "partial", "role": "assistant", "toolCalls": [
        {"id": "interrupted", "type": "function", "function": {"name": "FilingReport", "arguments": '{"summary":'}}
    ]}]
    body["forwardedProps"]["a2uiAction"] = {"action": {
        "name": "select_flight", "surfaceId": surface_id, "sourceComponentId": "select",
        "context": {"flightId": "demo-icn-nrt"},
    }}
    prepared = await transport.prepare_input("fixed", RunAgentInput.model_validate(body), agent)
    assert prepared.messages == []
    events = [event async for event in agent.run(prepared)]
    assert any(event.type == "RUN_FINISHED" for event in events)
    assert not any(event.type == "RUN_ERROR" for event in events)


@pytest.mark.asyncio
async def test_fixed_unavailable_route_is_text_only_and_can_recover():
    graph = build_graph("fixed", ToolModel(responses=[
        AIMessage(content="데모 데이터에 해당 노선이 없습니다."),
        AIMessage(content="", tool_calls=[{
            "id": "reverse-call", "name": "display_flight",
            "args": {"flight_id": "demo-nrt-icn"},
        }]),
        AIMessage(content="가상 항공편입니다."),
    ]))
    config: RunnableConfig = {"configurable": {"thread_id": "unsupported-recovery"}}
    result = await graph.ainvoke({
        "messages": [HumanMessage(content="파리에서 뉴욕")], "surfaces": {},
    }, config)
    assert result["surfaces"] == {}
    assert result["messages"][-1].content == "데모 데이터에 해당 노선이 없습니다."
    result = await graph.ainvoke({"messages": [HumanMessage(content="도쿄에서 인천")]}, config)
    data = next(iter(result["surfaces"].values()))["data"]
    assert (data["origin"], data["destination"], data["price"]) == ("NRT", "ICN", "$279")
