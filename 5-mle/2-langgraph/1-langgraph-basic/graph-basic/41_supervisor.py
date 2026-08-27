"""
Example 41 — Supervisor (multi-worker routing).

`supervisor` 노드가 LLM 으로 다음에 실행할 worker 에이전트를 결정하고,
각 worker 가 답을 만들면 다시 supervisor 로 돌아와 종료 여부를 판단합니다.

이 예제의 researcher/calculator는 ReAct agent가 아닙니다.
LLM structured output으로 tool 인자를 추출한 뒤 Python에서 tool을 한 번
직접 호출하는 결정적 worker입니다.

선행 예제
---------
- 33: LLM structured routing
- 40: 작업을 여러 단계로 분해하는 orchestration

새 개념
-------
- supervisor가 전문 worker를 선택하고 worker 종료 후 다시 제어를 받는 패턴

복습 개념
-------
- structured output routing, cycle, max-iteration guard

worker
------
- researcher : `lookup_info` 툴로 정보 검색
- calculator : `calculate` 툴로 수식 계산
- writer     : 모은 정보를 다듬어 최종 답변 작성

학습 포인트
-----------
- conditional edge 의 mapping 으로 N-way 라우팅
- supervisor 도 LLM (with_structured_output) 으로 결정
- 각 worker = 자기만의 system prompt와 직접 tool 호출 로직을 가진 노드

그래프 구조
-----------
START ─▶ supervisor ─┬─▶ researcher ─┐
                     ├─▶ calculator ─┤
                     ├─▶ writer ─────┤
                     └─▶ FINISH ─────┴─▶ END
                              ▲
                              └────── (worker 끝나면 supervisor 로 복귀)

테스트 메시지 예시 (state = MessagesState + next, recursion_limit 권장 ≥15)
-------------------------------------------------------------------------
researcher = lookup_info, calculator = calculate, writer = 최종 정리.

▶ researcher → writer (단일 정보 조회 + 정리)
   - "LangGraph 가 뭔지 설명해줘."
   - "Bedrock 에 대해 알려줘."

▶ calculator → writer (계산 + 정리)
   - "12 * 7 + 5 를 계산해줘."
   - "(100 - 25) / 3 은 얼마야?"

▶ researcher + calculator → writer (다중 worker 조합 — 가장 추천)
   - "LangGraph 가 뭔지 설명하고, 12 * 7 도 계산해줘."
   - "FastAPI 를 설명하고, 365 * 24 도 알려줘."

▶ smalltalk (writer 만 호출되거나 바로 FINISH)
   - "안녕! 오늘 기분 어때?"

※ Studio 에서 messages 만 입력해도 됨 (next 는 빈 문자열로 자동 시작)
※ recursion_limit 가 너무 작으면 MAX_SUPERVISOR_ITERATIONS=10 전에 끊길 수
   있으므로 25 이상을 권장
"""

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm
from common.tools import calculate, lookup_info

WORKERS = ["researcher", "calculator", "writer"]


class Route(BaseModel):
    """supervisor 의 라우팅 결정."""

    next: Literal["researcher", "calculator", "writer", "FINISH"] = Field(
        description="다음에 실행할 worker. 충분한 정보가 모였으면 FINISH."
    )
    reason: str = Field(description="선택 이유 한 줄")


class State(MessagesState):
    next: str
    iterations: int  # supervisor 가 호출된 횟수 — 무한 루프 방지


MAX_SUPERVISOR_ITERATIONS = 10


def supervisor_node(state: State) -> dict:
    iters = state.get("iterations", 0) + 1

    # 안전망: 너무 많이 반복되면 강제로 FINISH
    if iters > MAX_SUPERVISOR_ITERATIONS:
        return {
            "next": "FINISH",
            "iterations": iters,
            "messages": [
                AIMessage(content="[supervisor → FINISH] max iterations reached")
            ],
        }

    llm = create_llm()
    routed: Route = llm.with_structured_output(Route).invoke(
        [
            SystemMessage(
                content=(
                    "You are a supervisor coordinating workers:\n"
                    "- researcher: looks up facts about a topic (call when user asks about a concept)\n"
                    "- calculator: does math (call when user asks for arithmetic)\n"
                    "- writer: composes the final user-facing answer (call ONCE at the end "
                    "to summarize results into a polished reply)\n\n"
                    "Workflow:\n"
                    "1) Inspect the latest user request.\n"
                    "2) Dispatch researcher / calculator as needed (each at most once per topic).\n"
                    "3) When all required facts/results are present in the conversation, "
                    "dispatch writer.\n"
                    "4) After writer has produced a final answer, respond FINISH.\n\n"
                    "Hard rules:\n"
                    "- If a [supervisor → writer] entry already exists in the conversation, "
                    "you MUST respond FINISH.\n"
                    f"- This is iteration {iters}/{MAX_SUPERVISOR_ITERATIONS}; "
                    "do not loop."
                )
            ),
            *state["messages"],
        ]
    )
    return {
        "next": routed.next,
        "iterations": iters,
        "messages": [
            AIMessage(content=f"[supervisor → {routed.next}] {routed.reason}")
        ],
    }


def _worker_node(system_prompt: str, tool_fn=None, extract_arg: str = "query"):
    """워커 노드 팩토리.

    워커는 LLM 의 tool-use 프로토콜을 사용하지 않고, 다음 두 단계로 단순화합니다:
      1) tool_fn 이 있으면 LLM 으로 적절한 인자를 추출
      2) 직접 tool_fn 을 호출해 결과를 AIMessage 로 추가

    이렇게 하면 메시지 히스토리에 tool call/tool result 페어링이 필요 없어
    provider의 tool-message 순서 검증과 무관하게 동작합니다.
    """

    def node(state: State) -> dict:
        llm = create_llm()
        if tool_fn is None:
            # writer: 그냥 LLM 답변
            response = llm.invoke(
                [SystemMessage(content=system_prompt), *state["messages"]]
            )
            return {"messages": [response]}

        # tool 이 있는 워커: 인자 추출용 structured_output
        class ArgExtract(BaseModel):
            value: str = Field(description=f"The {extract_arg} to pass to the tool")

        extracted: ArgExtract = llm.with_structured_output(ArgExtract).invoke(
            [SystemMessage(content=system_prompt), *state["messages"]]
        )
        try:
            result = tool_fn.invoke({extract_arg: extracted.value})
        except Exception as e:  # noqa: BLE001 - tools may raise provider-specific errors
            result = f"(tool error: {e})"
        return {
            "messages": [
                AIMessage(
                    content=f"[{tool_fn.name}({extract_arg}={extracted.value!r})] → {result}"
                )
            ]
        }

    return node


researcher = _worker_node(
    "You are a researcher. Extract the topic to look up from the conversation.",
    tool_fn=lookup_info,
    extract_arg="topic",
)
calculator = _worker_node(
    "You are a calculator agent. Extract the math expression to calculate "
    "(only digits and + - * / ( ) allowed).",
    tool_fn=calculate,
    extract_arg="expression",
)
writer = _worker_node(
    "You are the final writer. Synthesize the conversation into a clear answer for the user.",
    tool_fn=None,
)


def route(state: State) -> str:
    """supervisor.next 값을 그대로 다음 노드 이름으로 사용."""
    nxt = state.get("next", "FINISH")
    return "__end__" if nxt == "FINISH" else nxt


def build_graph():
    builder = StateGraph(State)
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher)
    builder.add_node("calculator", calculator)
    builder.add_node("writer", writer)

    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges(
        "supervisor",
        route,
        {
            "researcher": "researcher",
            "calculator": "calculator",
            "writer": "writer",
            "__end__": END,
        },
    )
    # worker 들은 항상 supervisor 로 복귀
    for w in WORKERS:
        builder.add_edge(w, "supervisor")

    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {
            "messages": [
                HumanMessage(content="LangGraph 가 뭔지 설명하고, 12 * 7 도 계산해줘."),
            ],
            "next": "",
        },
        config={"recursion_limit": 15},
    )
    for m in out["messages"]:
        print(f"[{type(m).__name__}] {m.content[:200]}")
