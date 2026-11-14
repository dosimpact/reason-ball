"""SEC agent boundaries: published evidence, durable jobs and native chat state."""

import json

import httpx
import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from domains.sec_modeling_agent.tools import build_sec_modeling_test_tools
from domains.sec_tools.tools import SecBffClient
from domains.tenk.sec_client import SecReadError
from graph.primary_graphs.sec_modeling_agent.state import SecModelingAgentState
from graph.primary_graphs.sec_modeling_agent.workflow import build_sec_modeling_agent


class Client:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    async def request(self, method, path, params=None, body=None):
        self.calls.append((method, path, params, body))
        if self.error:
            raise self.error
        return self.result


def tool(client, name, activity=None):
    return next(
        t for t in build_sec_modeling_test_tools(client, activity) if t.name == name
    )


async def invoke(selected, args):
    return await selected.ainvoke(
        {
            "name": selected.name,
            "args": args,
            "id": "owned-test-call",
            "type": "tool_call",
        }
    )


@pytest.mark.asyncio
async def test_results_preserve_published_fact_provenance_and_nested_values():
    fact = {
        "id": "fact-1",
        "rawValue": "1,000",
        "normalizedValue": "1000000",
        "analysisCategory": "DEPENDENCIES_AND_COMMITMENTS",
        "context": {"instantDate": "2026-09-26"},
        "unit": {"numerator": ["USD"], "denominator": []},
        "dimensions": [],
        "evidenceIds": ["fact-1:evidence"],
    }
    client = Client({"generationId": "published-g1", "items": [fact], "total": 1})
    events = []
    result = await invoke(
        tool(client, "get_sec_modeling_results", events.append),
        {"cik": "320193", "accessionNo": "0000320193-26-000026", "stage": 3},
    )
    assert client.calls == [
        (
            "GET",
            "modeling/filings/0000320193/0000320193-26-000026/results/3",
            {"limit": 20, "offset": 0},
            None,
        )
    ]
    assert result.artifact["result"]["items"] == [fact]
    assert json.loads(result.content)["generationId"] == "published-g1"
    assert [e["status"] for e in events] == ["running", "completed"]


@pytest.mark.asyncio
async def test_empty_publication_remains_empty_without_starting_jobs():
    client = Client({"stages": {}})
    result = await invoke(
        tool(client, "get_sec_modeling_status"),
        {"cik": "320193", "accessionNo": "0000320193-26-000026"},
    )
    assert json.loads(result.content) == {"stages": {}}
    assert all(call[0] == "GET" for call in client.calls)


@pytest.mark.asyncio
async def test_invalid_filing_and_stage_do_not_reach_bff():
    client = Client({})
    selected = tool(client, "get_sec_modeling_results")
    for args in [
        {"cik": "bad", "accessionNo": "0000320193-26-000026", "stage": 3},
        {"cik": "320193", "accessionNo": "0000320193-26-000026", "stage": 4},
    ]:
        with pytest.raises(ValidationError):
            await invoke(selected, args)
    assert client.calls == []


@pytest.mark.asyncio
async def test_provider_errors_do_not_expose_connection_or_credentials():
    client = Client(error=RuntimeError("secret-token at http://private.example"))
    events = []
    with pytest.raises(SecReadError) as error:
        await invoke(
            tool(client, "get_sec_modeling_status", events.append),
            {"cik": "320193", "accessionNo": "0000320193-26-000026"},
        )
    assert "secret-token" not in str(error.value)
    assert "private.example" not in str(error.value)
    assert [e["status"] for e in events] == ["running", "failed"]


@pytest.mark.asyncio
async def test_explicit_model3_job_returns_queued_run_without_claiming_success():
    client = Client(
        {"runId": "11111111-1111-4111-8111-111111111111", "status": "QUEUED"}
    )
    result = await invoke(
        tool(client, "start_sec_modeling"),
        {"cik": "320193", "accessionNo": "0000320193-26-000026", "stage": 3},
    )
    assert client.calls[0][0] == "POST"
    assert client.calls[0][3] == {"extractionModel": "gpt-6-luna"}
    assert json.loads(result.content)["status"] == "QUEUED"


@pytest.mark.asyncio
async def test_native_messages_survive_and_previous_presentation_is_cleared():
    async def respond(state):
        assert state["presentation"] is None
        assert state["messages"][-1].content == "저장된 모델링 상태를 알려줘"
        return {"messages": [AIMessage(content="게시된 근거가 없습니다.")]}

    business = StateGraph(SecModelingAgentState)
    business.add_node("respond", respond)
    business.add_edge(START, "respond")
    business.add_edge("respond", END)
    app = build_sec_modeling_agent(agent=business.compile())
    result = await app.ainvoke(
        {
            "messages": [HumanMessage(content="저장된 모델링 상태를 알려줘")],
            "presentation": {"id": "stale", "program": "old"},
        }
    )
    assert result["presentation"] is None
    assert len(result["messages"]) == 2
    assert result["messages"][-1].content == "게시된 근거가 없습니다."


@pytest.mark.asyncio
async def test_http_accepted_response_preserves_queued_state():
    def respond(request):
        assert request.method == "POST"
        assert request.url.path.endswith("/model-3/runs")
        return httpx.Response(
            202,
            json={"runId": "11111111-1111-4111-8111-111111111111", "status": "QUEUED"},
        )

    client = SecBffClient(
        base_url="http://test-bff", transport=httpx.MockTransport(respond)
    )
    result = await invoke(
        tool(client, "start_sec_modeling"),
        {"cik": "320193", "accessionNo": "0000320193-26-000026", "stage": 3},
    )
    assert json.loads(result.content)["status"] == "QUEUED"
