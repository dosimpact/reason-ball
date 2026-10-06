import pytest
from langchain_core.messages import AIMessage, HumanMessage
from graph.primary_graphs.simple_push_ui_message.workflow import build_graph

class ToolModel:
    def bind_tools(self, tools):
        return self
    async def ainvoke(self, messages):
        if isinstance(messages[-1], HumanMessage):
            return AIMessage(content="", tool_calls=[
                {"name": "research_notes", "args": {"query": "매출"}, "id": "research", "type": "tool_call"},
                {"name": "query_sales", "args": {"region": "서울"}, "id": "query", "type": "tool_call"},
            ])
        return AIMessage(content="서울 데모 매출은 200000입니다.")

@pytest.mark.asyncio
async def test_tools_emit_linked_progress_without_duplicates():
    events = []
    final = None
    async for mode, value in build_graph(ToolModel()).astream(
        {"messages": [HumanMessage(content="서울 매출 조사")], "ui": [], "turn_id": "answer-1", "model_calls": 0},
        stream_mode=["custom", "values"],
    ):
        if mode == "custom":
            events.append(value)
        else:
            final = value
    assert len(events) == 8
    assert len(final["ui"]) == 4
    assert all(e["metadata"]["message_id"] == "answer-1" for e in events)
    assert all(e["props"]["status"] == "completed" for e in final["ui"])
    assert final["messages"][-1].id == "answer-1"
    assert "200000" in final["messages"][-2].content

class FailedModel(ToolModel):
    async def ainvoke(self, messages):
        raise RuntimeError("fixture failure")

@pytest.mark.asyncio
async def test_failure_emits_failed_progress():
    events = []
    with pytest.raises(RuntimeError):
        async for event in build_graph(FailedModel()).astream(
            {"messages": [HumanMessage(content="hello")], "ui": [], "turn_id": "failed", "model_calls": 0}, stream_mode="custom",
        ):
            events.append(event)
    assert events[-1]["props"]["status"] == "failed"
    assert events[-1]["id"] == events[0]["id"]
