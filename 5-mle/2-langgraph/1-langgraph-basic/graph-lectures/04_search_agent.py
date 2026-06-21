"""
Lecture 04 — Search agent.

`project/search-agent/main.py` 를 LangGraph Studio 에 등록 가능한 그래프로
다시 쓴 단일 파일 예제.

큰 흐름
-------
1. agent: LLM 이 검색 도구 호출 여부를 결정한다.
2. tools: 검색 도구를 실행한다.
3. 검색 결과를 받은 뒤 agent 가 최종 답변을 만든다.
"""

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

load_dotenv()

LAST = -1


# ---------------------------------------------------------------------------
# 1. Tool
# ---------------------------------------------------------------------------
# 원본은 tavily.TavilyClient 를 직접 사용한다. 여기서는 Studio import 안정성을 위해
# 패키지/API 키가 있을 때만 실제 검색하고, 없으면 이유를 메시지로 돌려준다.
@tool
def search(query: str) -> str:
    """Search the internet for the query."""
    try:
        from tavily import TavilyClient

        return str(TavilyClient().search(query=query))
    except Exception as exc:
        return f"Search tool is unavailable: {exc}"


tools = [search]


# ---------------------------------------------------------------------------
# 2. LLM and Nodes
# ---------------------------------------------------------------------------
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(tools)
tool_node = ToolNode(tools)


def agent_node(state: MessagesState) -> dict:
    response = llm.invoke(
        [
            {
                "role": "system",
                "content": "You are a search assistant. Use search for current facts.",
            },
            *state["messages"],
        ]
    )
    return {"messages": [response]}


# ---------------------------------------------------------------------------
# 3. Routing
# ---------------------------------------------------------------------------
def should_continue(state: MessagesState) -> str:
    if state["messages"][LAST].tool_calls:
        return "tools"
    return END


# ---------------------------------------------------------------------------
# 4. Build graph
# ---------------------------------------------------------------------------
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")

graph = builder.compile()


if __name__ == "__main__":
    result = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content=(
                        "search for 3 job postings for an ai engineer using "
                        "langchain in the bay area and list their details"
                    )
                )
            ]
        }
    )
    print(result["messages"][LAST].content)
