"""
Lecture 01 — Reflection graph.

Reflection graph는 LLM이 초안을 만들고, 스스로 비평한 뒤, 그 피드백을 반영해 다시 생성하는 반복 개선 그래프  

흐름
----
1. generate: 사용자의 요청을 바탕으로 트윗 초안을 작성한다.
2. reflect: 초안을 비평하고 구체적인 개선점을 만든다.
3. generate: 비평 메시지를 사용자 피드백처럼 받아 이전 초안을 수정한다.
4. 메시지가 충분히 쌓이면 종료한다.

LangGraph Studio 테스트 입력 예시
--------------------------------
{
  "messages": [
    {
      "role": "user",
      "content": "Make this tweet better: @LangChainAI newly Tool Calling feature is seriously underrated."
    }
  ]
}
"""

from typing import Annotated, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

load_dotenv()


# ---------------------------------------------------------------------------
# 1. State
# ---------------------------------------------------------------------------
# 이 그래프는 별도 필드를 많이 두지 않고 messages 하나만 누적한다.
# add_messages reducer 덕분에 각 노드가 반환한 메시지가 기존 목록 뒤에 붙는다.
class ReflectionState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ---------------------------------------------------------------------------
# 2. Graph constants
# ---------------------------------------------------------------------------
GENERATE = "generate"
REFLECT = "reflect"
MAX_MESSAGES = 6


# ---------------------------------------------------------------------------
# 3. Chains
# ---------------------------------------------------------------------------
# 원본 `chains.py` 에 있던 두 프롬프트를 이 파일 안으로 가져왔다.
# generation_chain 은 트윗을 작성/수정하고, reflect_chain 은 트윗을 비평한다.
reflection_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a viral social media editor grading a post. "
            "You can work in both English and Korean. "
            "Detect the language of the user's original request and provide critique "
            "in that same language unless the user explicitly asks for another language. "
            "Generate detailed critique and recommendations for the user's post, "
            "including length, virality, style, clarity, hook strength, specificity, "
            "and whether the wording sounds natural in the target language.",
        ),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

generation_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a social media writing assistant tasked with writing excellent "
            "English and Korean posts. Detect the language of the user's original "
            "request and write in that same language unless the user explicitly asks "
            "for another language. Generate the best post possible for the user's "
            "request. If the user provides critique, respond with a revised version "
            "of your previous attempt. Make the result sound natural, concise, and "
            "platform-appropriate in the target language.",
        ),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

# |는 python의 OR비트연산자가 확장되었음.  LangChain의 LCEL 문법입니다. |는 “앞 단계의 출력을 다음 단계의 입력으로 넘긴다”는 뜻
llm = ChatOpenAI(model="gpt-4o-mini") # gpt-3.5-turbo
generate_chain = generation_prompt | llm
reflect_chain = reflection_prompt | llm


# ---------------------------------------------------------------------------
# 4. Nodes
# ---------------------------------------------------------------------------
# generate -> reflect -> generate 형태로 번갈아 실행된다.
# LangGraph 노드는 state 를 받아 state 에 병합할 dict 를 반환한다.
def generation_node(state: ReflectionState) -> dict:
    response = generate_chain.invoke({"messages": state["messages"]})
    return {"messages": [response]}


def reflection_node(state: ReflectionState) -> dict:
    response = reflect_chain.invoke({"messages": state["messages"]})

    # 다음 generate 단계가 critique 를 사용자 피드백처럼 읽도록 HumanMessage 로 변환한다.
    return {"messages": [HumanMessage(content=response.content)]}


# ---------------------------------------------------------------------------
# 5. Routing
# ---------------------------------------------------------------------------
# generate 가 끝날 때마다 메시지 수를 보고 더 비평할지 종료할지 결정한다.
# 원본 강의 코드와 동일하게 len(messages) > 6 이면 종료한다.
def should_continue(state: ReflectionState) -> str:
    if len(state["messages"]) > MAX_MESSAGES:
        return END
    return REFLECT


# ---------------------------------------------------------------------------
# 6. Build graph
# ---------------------------------------------------------------------------
# START 에서 generate 로 진입하고, reflect 는 항상 다시 generate 로 돌아간다.
# 종료 조건은 generate 뒤의 conditional edge 에만 둔다.
def build_graph():
    builder = StateGraph(ReflectionState)

    builder.add_node(GENERATE, generation_node)
    builder.add_node(REFLECT, reflection_node)

    builder.add_edge(START, GENERATE)
    builder.add_conditional_edges(
        GENERATE,
        should_continue,
        {
            REFLECT: REFLECT,
            END: END,
        },
    )
    builder.add_edge(REFLECT, GENERATE)

    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    inputs = {
        "messages": [
            HumanMessage(
                content=(
                    "Make this tweet better:\n"
                    "@LangChainAI newly Tool Calling feature is seriously underrated.\n\n"
                    "After a long wait, it's here - making the implementation "
                    "of agents across different models with function calling super easy.\n\n"
                    "Made a video covering their newest blog post."
                )
            )
        ]
    }

    result = graph.invoke(inputs)
    print(result["messages"][-1].content)
