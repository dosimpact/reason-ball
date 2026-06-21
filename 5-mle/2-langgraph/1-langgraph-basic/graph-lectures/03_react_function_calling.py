"""
Lecture 03 — ReAct agent with function calling.

`project/ReAct-Agent-Function-Calling` 의 `main.py`, `nodes.py`, `react.py` 를
한 파일로 합친 예제. 구조는 02 번과 같지만, 원본처럼 temperature=0 으로
함수 호출 결과를 더 결정적으로 만들었다.
"""

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

load_dotenv()


# ---------------------------------------------------------------------------
# 1. Tools
# ---------------------------------------------------------------------------
@tool
def search(query: str) -> str:
    """Search the web for current information."""
    try:
        from langchain_tavily import TavilySearch

        return str(TavilySearch(max_results=1).invoke({"query": query}))
    except Exception as exc:
        return f"Search tool is unavailable: {exc}"


@tool
def triple(num: float) -> float:
    """Return the input number multiplied by 3."""
    return float(num) * 3


tools = [search, triple]


# ---------------------------------------------------------------------------
# 2. LLM
# ---------------------------------------------------------------------------
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(tools)


# ---------------------------------------------------------------------------
# 3. Nodes
# ---------------------------------------------------------------------------
AGENT_REASON = "agent_reason"
ACT = "act"
LAST = -1

SYSTEM_MESSAGE = "You are a helpful assistant that can use tools to answer questions."


def run_agent_reasoning(state: MessagesState) -> dict:
    response = llm.invoke(
        [{"role": "system", "content": SYSTEM_MESSAGE}, *state["messages"]]
    )
    return {"messages": [response]}


tool_node = ToolNode(tools)


# ---------------------------------------------------------------------------
# 4. Routing
# ---------------------------------------------------------------------------
def should_continue(state: MessagesState) -> str:
    if not state["messages"][LAST].tool_calls:
        return END
    return ACT


# ---------------------------------------------------------------------------
# 5. Build graph
# ---------------------------------------------------------------------------
flow = StateGraph(MessagesState)
flow.add_node(AGENT_REASON, run_agent_reasoning)
flow.add_node(ACT, tool_node)
flow.add_edge(START, AGENT_REASON)
flow.add_conditional_edges(AGENT_REASON, should_continue, {END: END, ACT: ACT})
flow.add_edge(ACT, AGENT_REASON)

graph = flow.compile()


if __name__ == "__main__":
    result = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content="What is the temperature in Tokyo? List it and then triple it"
                )
            ]
        }
    )
    print(result["messages"][LAST].content)
