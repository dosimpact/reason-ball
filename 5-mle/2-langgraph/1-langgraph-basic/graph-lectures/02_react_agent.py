"""
Lecture 02 — ReAct agent.

• ReAct agent는 LLM이 추론한 뒤 필요한 도구를 호출하고, 도구 결과를 다시 보고 최종 답변을 만드는 반복형 에이전트 그래프입니다.

큰 흐름
-------
1. agent_reason: LLM 이 답변할지 도구를 호출할지 판단한다.
2. act: ToolNode 가 요청된 도구를 실행한다.
3. 도구 호출이 남아 있으면 다시 agent_reason 으로 돌아간다.
4. 마지막 AIMessage 에 tool_calls 가 없으면 종료한다.
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
# 원본은 TavilySearch + triple 도구를 사용한다.
# Tavily 패키지나 API 키가 없어도 Studio import 가 깨지지 않도록 search 도구는
# 선택적으로 Tavily 를 사용하고, 실패하면 안내 문자열을 반환한다.
@tool
def search(query: str) -> str:
    """Search the web for the query."""
    try:
        from langchain_tavily import TavilySearch

        return str(TavilySearch(max_results=1).invoke({"query": query}))
    except Exception as exc:
        return f"Search tool is unavailable: {exc}"


@tool
def triple(num: float) -> float:
    """Return the input number multiplied by 3."""
    return 3 * float(num)


tools = [search, triple]


# ---------------------------------------------------------------------------
# 2. LLM
# ---------------------------------------------------------------------------
# bind_tools 로 LLM 이 필요한 도구 호출을 AIMessage.tool_calls 에 담게 한다.
llm = ChatOpenAI(model="gpt-4o-mini").bind_tools(tools)


# ---------------------------------------------------------------------------
# 3. Nodes
# ---------------------------------------------------------------------------
AGENT_REASON = "agent_reason"
ACT = "act"
LAST = -1

SYSTEM_MESSAGE = "You are a helpful assistant that can use tools to answer questions."


def run_agent_reasoning_engine(state: MessagesState) -> dict:
    response = llm.invoke(
        [{"role": "system", "content": SYSTEM_MESSAGE}, *state["messages"]]
    )
    return {"messages": [response]}


tool_node = ToolNode(tools)


# ---------------------------------------------------------------------------
# 4. Routing
# ---------------------------------------------------------------------------
# LLM 응답에 tool_calls 가 있으면 act 로 보내고, 없으면 최종 답변으로 본다.
def should_continue(state: MessagesState) -> str:
    if not state["messages"][LAST].tool_calls:
        return END
    return ACT


# ---------------------------------------------------------------------------
# 5. Build graph
# ---------------------------------------------------------------------------
flow = StateGraph(MessagesState)
flow.add_node(AGENT_REASON, run_agent_reasoning_engine)
flow.add_node(ACT, tool_node)
flow.add_edge(START, AGENT_REASON)
flow.add_conditional_edges(AGENT_REASON, should_continue, {END: END, ACT: ACT})
flow.add_edge(ACT, AGENT_REASON)

graph = flow.compile()


if __name__ == "__main__":
    result = graph.invoke(
        {
            "messages": [
                HumanMessage(content="what is the weather in sf? List it and then triple it")
            ]
        }
    )
    print(result["messages"][LAST].content)
