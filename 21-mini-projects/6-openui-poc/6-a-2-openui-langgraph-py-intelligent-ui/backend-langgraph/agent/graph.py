# 기본 데모 에이전트의 진입점입니다. OpenAI 모델·mock 도구·패키지에 포함된 OpenUI 프롬프트를 연결합니다.
"""LangGraph Platform entry point; the browser and Next.js proxy stay unchanged."""

import os
from pathlib import Path

from deepagents import create_deep_agent
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph

from agent.streaming import OpenUIStreamTransformer
from agent.tools import get_stock_price, get_weather, search_web

PROMPT_PATH = Path(__file__).with_name("system-prompt.txt")
if not PROMPT_PATH.is_file():
    raise RuntimeError("Missing packaged OpenUI prompt: agent/system-prompt.txt")

model = ChatOpenAI(
    model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
    streaming=True,
    use_responses_api=False,
)
graph = create_deep_agent(
    model=model,
    tools=[get_weather, get_stock_price, search_web],
    system_prompt=PROMPT_PATH.read_text(encoding="utf-8")
    + "\n"
    + (
        "You build interactive Intelligent UI pages with the provided component library. "
        "Use the tools when they help answer the user's request, then answer only in OpenUI Lang. "
        "Weather, stock and search tools return demo data; do not present it as live data. Do not use filesystem, planning or subagent tools. "
        "When tools are needed, emit no text before or between tool calls. "
        "After all results arrive, emit exactly one complete OpenUI program, with one root. "
        "Copy tool result values into ordinary literal data declarations (data = {...}); "
        "do not invent or alter tool values. Reserve $variables for user-editable state, "
        "and always include the $ prefix when reading or writing that state. "
        "Every referenced identifier must be declared. Text size is xs, sm, md or lg; "
        "larger heading sizes belong only to Title. Follow each component signature exactly."
    ),
)

# Separate generation prompt; the classifier itself is agent.intent:graph.
REPORT_PROMPT_PATH = Path(__file__).with_name("report-system-prompt.txt")
REPORT_PROMPT = (
    REPORT_PROMPT_PATH.read_text(encoding="utf-8")
    + "\nReturn one complete OpenUI program only. Keep source uncertainty. "
    "Do not invent observations, citations, numeric evidence or live prices."
)


async def generate_report(state: MessagesState):
    # No tool bindings, filesystem middleware or planner in report generation.
    answer = await model.ainvoke([
        SystemMessage(content=REPORT_PROMPT), *state["messages"],
    ])
    return {"messages": [answer]}


report_builder = StateGraph(MessagesState)
report_builder.add_node("generate_report", generate_report)
report_builder.add_edge(START, "generate_report")
report_builder.add_edge("generate_report", END)
report_graph = report_builder.compile()


# LangGraph 서버가 실행마다 새 OpenUI 변환기를 만들 수 있도록 클래스를 반환합니다.
def stream_transformers():
    """LangGraph API creates a fresh transformer per run (protocol v2)."""
    return [OpenUIStreamTransformer]
