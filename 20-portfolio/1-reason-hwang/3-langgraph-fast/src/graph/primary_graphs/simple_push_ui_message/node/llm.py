from langchain_core.messages import SystemMessage

from graph.primary_graphs.a2ui_demo.model import ModelSettings
from graph.primary_graphs.simple_push_ui_message.progress import progress
from graph.primary_graphs.simple_push_ui_message.tools.demo import TOOLS

SYSTEM_PROMPT = """You are a concise assistant answering in the user's language.
Use research_notes for reference research and query_sales for sales figures when needed.
These tools use local demonstration data, not the internet or a production database.
Use both when asked to research sales criteria and query sales. Do not invent tool results.
Do not reveal private reasoning. Give the answer and brief source descriptions only."""


async def call_llm(state, model=None):
    step = progress(state["turn_id"], "도구 선택 및 답변 준비")
    try:
        model = model or ModelSettings.from_env().build()
        response = await model.bind_tools(TOOLS).ainvoke(
            [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
        )
        if not response.tool_calls:
            response.id = state["turn_id"]
        progress(state["turn_id"], "도구 선택 및 답변 준비", "completed", step_id=step["id"])
        return {"messages": [response], "model_calls": state.get("model_calls", 0) + 1}
    except Exception:
        progress(state["turn_id"], "모델 요청 실패", "failed", step_id=step["id"])
        raise
