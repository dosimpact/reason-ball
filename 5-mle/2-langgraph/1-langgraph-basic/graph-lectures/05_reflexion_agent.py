"""
Lecture 05 — Reflexion agent.

`project/reflexion-agent` 의 `main.py`, `chains.py`, `schemas.py`,
`tool_executor.py` 를 한 파일로 합친 예제.

큰 흐름
-------
1. draft: 질문에 대한 초안, 자기비평, 검색 쿼리를 도구 호출 형식으로 만든다.
2. execute_tools: 생성된 검색 쿼리를 실행한다.
3. revise: 검색 결과와 이전 비평을 반영해 답변을 수정한다.
4. 도구 실행 횟수가 MAX_ITERATIONS 를 넘으면 종료한다.
"""

import datetime
from typing import Literal

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

load_dotenv()

MAX_ITERATIONS = 2


# ---------------------------------------------------------------------------
# 1. Tool-call schemas
# ---------------------------------------------------------------------------
# LLM 이 일반 텍스트가 아니라 AnswerQuestion / ReviseAnswer 도구 호출 형식으로
# 답하도록 강제한다. 이 구조 안에 answer, reflection, search_queries 가 들어간다.
class Reflection(BaseModel):
    missing: str = Field(description="Critique of what is missing.")
    superfluous: str = Field(description="Critique of what is superfluous.")


class AnswerQuestion(BaseModel):
    """Answer the question."""

    answer: str = Field(description="~250 word detailed answer to the question.")
    reflection: Reflection = Field(description="Reflection on the current answer.")
    search_queries: list[str] = Field(
        description="1-3 search queries for researching improvements."
    )


class ReviseAnswer(AnswerQuestion):
    """Revise the original answer."""

    references: list[str] = Field(description="Citations motivating the updated answer.")


# ---------------------------------------------------------------------------
# 2. Chains
# ---------------------------------------------------------------------------
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

actor_prompt_template = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are expert researcher.
Current time: {time}

1. {first_instruction}
2. Reflect and critique your answer. Be severe to maximize improvement.
3. Recommend search queries to research information and improve your answer.""",
        ),
        MessagesPlaceholder(variable_name="messages"),
        ("system", "Answer the user's question above using the required format."),
    ]
).partial(time=lambda: datetime.datetime.now().isoformat())

first_responder = actor_prompt_template.partial(
    first_instruction="Provide a detailed ~250 word answer."
) | llm.bind_tools(tools=[AnswerQuestion], tool_choice="AnswerQuestion")

revise_instructions = """Revise your previous answer using the new information.
- Use the previous critique to add important missing information.
- Include numerical citations in the revised answer.
- Add a References section at the bottom.
- Remove superfluous information and keep the answer under 250 words."""

revisor = actor_prompt_template.partial(
    first_instruction=revise_instructions
) | llm.bind_tools(tools=[ReviseAnswer], tool_choice="ReviseAnswer")


# ---------------------------------------------------------------------------
# 3. Tool executor
# ---------------------------------------------------------------------------
# AnswerQuestion / ReviseAnswer 의 search_queries 인자를 받아 Tavily 검색을 batch 실행한다.
# Tavily 의존성이나 API 키가 없을 때는 그래프 실행이 실패하지 않도록 안내 결과를 반환한다.
def run_queries(search_queries: list[str], **kwargs) -> list[str]:
    """Run generated search queries."""
    try:
        from langchain_tavily import TavilySearch

        tavily_tool = TavilySearch(max_results=5)
        return tavily_tool.batch([{"query": query} for query in search_queries])
    except Exception as exc:
        return [f"Search unavailable for {query!r}: {exc}" for query in search_queries]


execute_tools = ToolNode(
    [
        StructuredTool.from_function(run_queries, name=AnswerQuestion.__name__),
        StructuredTool.from_function(run_queries, name=ReviseAnswer.__name__),
    ]
)


# ---------------------------------------------------------------------------
# 4. Nodes
# ---------------------------------------------------------------------------
def draft_node(state: MessagesState) -> dict:
    response = first_responder.invoke({"messages": state["messages"]})
    return {"messages": [response]}


def revise_node(state: MessagesState) -> dict:
    response = revisor.invoke({"messages": state["messages"]})
    return {"messages": [response]}


# ---------------------------------------------------------------------------
# 5. Routing
# ---------------------------------------------------------------------------
# ToolMessage 개수를 iteration 으로 보고, 일정 횟수 이상 검색/수정을 반복하면 종료한다.
def event_loop(state: MessagesState) -> Literal["execute_tools", "__end__"]:
    count_tool_visits = sum(isinstance(item, ToolMessage) for item in state["messages"])
    if count_tool_visits > MAX_ITERATIONS:
        return "__end__"
    return "execute_tools"


# ---------------------------------------------------------------------------
# 6. Build graph
# ---------------------------------------------------------------------------
builder = StateGraph(MessagesState)
builder.add_node("draft", draft_node)
builder.add_node("execute_tools", execute_tools)
builder.add_node("revise", revise_node)
builder.add_edge(START, "draft")
builder.add_edge("draft", "execute_tools")
builder.add_edge("execute_tools", "revise")
builder.add_conditional_edges(
    "revise", event_loop, {"execute_tools": "execute_tools", "__end__": END}
)

graph = builder.compile()


if __name__ == "__main__":
    result = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content=(
                        "Write about AI-Powered SOC / autonomous SOC problem domain, "
                        "list startups that do that and raised capital."
                    )
                )
            ]
        }
    )
    last_message = result["messages"][-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        print(last_message.tool_calls[0]["args"].get("answer"))
    else:
        print(last_message.content)
