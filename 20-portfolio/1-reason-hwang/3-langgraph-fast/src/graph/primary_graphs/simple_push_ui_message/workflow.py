from langchain_core.messages import ToolMessage
from langgraph.graph import END, START, StateGraph

from graph.primary_graphs.simple_push_ui_message.node.llm import call_llm
from graph.primary_graphs.simple_push_ui_message.progress import progress
from graph.primary_graphs.simple_push_ui_message.state import PushUIState
from graph.primary_graphs.simple_push_ui_message.tools.demo import TOOLS

TOOL_TITLES = {"research_notes": "자료 조사 · 로컬 예제 자료", "query_sales": "데이터 조회 · 예제 매출 집계"}


async def execute_tools(state):
    results = []
    tools = {tool.name: tool for tool in TOOLS}
    for call in state["messages"][-1].tool_calls:
        name = call["name"]
        step = progress(state["turn_id"], TOOL_TITLES.get(name, "지원하지 않는 도구"))
        try:
            result = await tools[name].ainvoke(call["args"])
            progress(state["turn_id"], TOOL_TITLES[name], "completed", step_id=step["id"])
            results.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
        except Exception:
            progress(state["turn_id"], "도구 실행 실패", "failed", step_id=step["id"])
            raise
    return {"messages": results}


def route(state):
    if not state["messages"][-1].tool_calls:
        return END
    if state.get("model_calls", 0) >= 6:
        raise ValueError("Tool iteration limit exceeded")
    return "tools"


def build_graph(model=None):
    async def model_node(state):
        return await call_llm(state, model)

    graph = StateGraph(PushUIState)
    graph.add_node("model", model_node)
    graph.add_node("tools", execute_tools)
    graph.add_edge(START, "model")
    graph.add_conditional_edges("model", route)
    graph.add_edge("tools", "model")
    return graph.compile()


simple_push_ui_message = build_graph()
