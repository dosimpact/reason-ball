"""MessagesState chat with three internal LLM calls and progress UI."""
# 예제 개요: 한 대화 턴에서 세 번의 내부 모델 호출과 최종 답변 호출을 진행합니다.
# 핵심 흐름: 고정 샘플 자료를 사용하며, UI와 최종 메시지를 같은 턴의 ID로 연결해 한 응답에 진행 상황을 모읍니다.
from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.ui import AnyUIMessage, push_ui_message, ui_message_reducer

from common.llm import create_llm


# push_ui_message 사용 예제 — 아래 코드는 설명용 주석입니다.
# assistant = AIMessage(id="assistant-1", content="")
# push_ui_message(
#     name="component-name",              # str, 필수: 렌더링할 UI 컴포넌트 이름.
#     props={"content": "Hello world"},    # dict[str, Any], 필수: UI에 전달할 데이터.
#     id="ui-1",                          # str | None, 기본 None: UI 고유 ID. 생략하면 UUID 생성.
#     metadata={"ordinal": 0},            # dict[str, Any] | None, 기본 None: UI의 추가 정보.
#     message=assistant,                  # AnyMessage | None, 기본 None: 연결할 채팅 메시지. 메시지 ID는 UI의 metadata.message_id에 저장됩니다.
#     state_key="ui",                     # str | None, 기본 "ui": UI를 저장할 상태 필드. None이면 상태 저장 없이 스트림 이벤트만 전송합니다.
#     merge=False,                        # bool, 기본 False: 같은 UI ID의 props를 교체합니다. True이면 기존 props에 전달한 필드만 병합합니다.
# )
#
# 같은 UI의 일부 필드만 갱신하는 예제:
# push_ui_message(
#     name="component-name",              # 처음 생성한 UI와 같은 컴포넌트 이름.
#     props={"content": "Updated"},       # 갱신할 필드만 전달합니다.
#     id="ui-1",                          # 처음 생성한 UI와 같은 ID를 지정합니다.
#     message=assistant,                  # 같은 Assistant 턴에 연결합니다.
#     merge=True,                         # 다른 props는 유지하고 content만 갱신합니다.
# )


class PushUIState(MessagesState):
    ui: Annotated[list[AnyUIMessage], ui_message_reducer]
    assistant_message_id: str
    stage_results: list[str]
    final_status: str
    error: str


STAGES = (
    ("데이터 검색중", "더미 검색 결과: 예시 자료 A와 B를 찾았습니다."),
    ("자료 취합중", "더미 취합 결과: 자료 A와 B를 주제별로 정리했습니다."),
    ("자료 완성중", "더미 완성 결과: 답변에 사용할 예시 자료를 준비했습니다."),
)


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block if isinstance(block, str) else str(block.get("text", ""))
            for block in content if isinstance(block, (str, dict))
        )
    return str(content)


# 모델 문맥에서는 UI용 빈 Assistant 메시지를 제외하고 실제 대화 내용만 사용합니다.
def _chat_context(state: PushUIState) -> list:
    # Empty assistant placeholders represent UI turns, not model input.
    return [message for message in state["messages"] if _text(message.content).strip()]


def _push_work_status(state: PushUIState, status: str, summary: str) -> None:
    push_ui_message(
        name="thinking_status",
        props={"status": status, "summary": summary},
        id=f"{state['assistant_message_id']}-work",
        metadata={"schema_version": "v1", "ordinal": 0},
        message=AIMessage(id=state["assistant_message_id"], content=""),
        merge=True,
    )


def _fail_turn(state: PushUIState, error: Exception) -> dict:
    _push_work_status(state, "failed", "작업이 중단되었습니다. 다시 요청해 주세요.")
    return {
        "final_status": "failed", "error": str(error),
        "messages": [AIMessage(id=state["assistant_message_id"], content="",
                               additional_kwargs={"turn_status": "failed"})],
    }


# 이번 실행의 입력과 진행 상태를 준비합니다.
def prepare_prompt(state: PushUIState) -> dict:
    messages = state.get("messages", [])

    if not messages or not isinstance(messages[-1], HumanMessage):
        raise ValueError("Send a user prompt in messages before starting this chat turn.")
    if not str(messages[-1].content).strip():
        raise ValueError("The user prompt must not be empty.")

    assistant_id = f"assistant-{uuid4().hex}"

    assistant = AIMessage(id=assistant_id, content="", additional_kwargs={"turn_status": "running"})

    push_ui_message(
        name="thinking_status",
        props={
            "title": "작업 착수", "stage": 0, "total": 3, "status": "running",
            "summary": "요청을 받았습니다. 자료를 단계별로 처리합니다.", "dummy": True,
        },
        id=f"{assistant_id}-work",
        metadata={"schema_version": "v1", "ordinal": 0},
        message=assistant,
    )

    return {
        "assistant_message_id": assistant_id,
        "messages": [assistant], # 기존 메시지와 합쳐진다.
        "stage_results": [],
        "final_status": "running",
        "error": "",
    }


# 공통 단계 처리: 실행 중 UI를 먼저 보내고 모델 결과로 같은 UI ID를 갱신합니다. 실패하면 턴을 중단합니다.
def _llm_call_with_push_ui_message(state: PushUIState, stage: int) -> dict:
    title, dummy_data = STAGES[stage - 1]

    # assistant_message_id 은 이번 턴에 사용할 공용 id이다. AIMessage로 만들어서 push_ui_message에 메타 정보만 주입하고 버린다.
    assistant_message_id = state['assistant_message_id']

    ui_id = f"{assistant_message_id}-stage-{stage}"
    assistant = AIMessage(id=assistant_message_id, content="")
    metadata = {"schema_version": "v1", "ordinal": stage}

    push_ui_message(
        name="thinking_status",
        props={
            "title": title, "stage": stage, "total": 3, "status": "running",
            "dummy": True, "summary": "더미 자료를 처리하고 있습니다.",
        },
        id=ui_id, # ui 라는 메시지의 유니크한 아이디 값, messsage처럼 id가 고유하다.
        metadata=metadata,
        message=assistant,
    )

    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(content=(
                    "Return one short Korean progress summary (at most 120 characters) "
                    "describing the supplied dummy data and the result of this stage. "
                    "This summary will be displayed in the UI. Do not include private reasoning. "
                    "Do not invent real searches or sources."
                )),
                *_chat_context(state),
                HumanMessage(content=(
                    f"Stage {stage}/3: {title}\n{dummy_data}\n"
                    f"Previous summaries: {state.get('stage_results', [])}"
                )),
            ],
            config={"tags": ["internal_stage", "langsmith:nostream"]},
        )
    except Exception as error:
        push_ui_message(
            name="thinking_status",
            props={"status": "failed", "summary": "이 단계의 처리를 완료하지 못했습니다."},
            id=ui_id,
            metadata=metadata,
            message=assistant,
            merge=True,
        )
        return _fail_turn(state, error)
    summary = _text(response.content).strip() or dummy_data
    push_ui_message(
        name="thinking_status",
        props={"status": "completed", "summary": summary[:120]},
        id=ui_id,
        metadata=metadata,
        message=assistant,
        merge=True,
    )
    # Internal responses are separate from the public chat message history.
    return {
        "stage_results": [*state.get("stage_results", []), summary],
    }


# 1단계: 더미 검색 자료를 모델에 전달하고 데이터 검색중 UI를 갱신합니다.
def search_data_llm_call_with_push_ui_message(state: PushUIState) -> dict:
    return _llm_call_with_push_ui_message(state, 1)


# 2단계: 앞 단계의 결과와 더미 취합 자료로 자료 취합중 UI를 갱신합니다.
def collect_data_llm_call_with_push_ui_message(state: PushUIState) -> dict:
    return _llm_call_with_push_ui_message(state, 2)


# 3단계: 단계 결과를 정리하고 자료 완성중 UI를 갱신합니다.
def complete_data_llm_call_with_push_ui_message(state: PushUIState) -> dict:
    return _llm_call_with_push_ui_message(state, 3)


# 세 단계의 결과로 최종 답변을 만들고 기존 Assistant 메시지의 ID를 유지해 내용을 교체합니다.
def generate_final_answer(state: PushUIState) -> dict:

    _push_work_status(state, "running", "3단계 자료 처리를 마쳤습니다. 최종 응답을 작성하고 있습니다.")

    try:
        response = create_llm("fast").invoke([
            SystemMessage(content=(
                "Answer the latest user request concisely in the user's language, using chat "
                "history where relevant. Three preparation stages used dummy data, not real "
                "search results. Clearly identify any demonstration data you mention. "
                f"Preparation summaries: {state.get('stage_results', [])}"
            )),
            *_chat_context(state),
        ])
    except Exception as error:
        return _fail_turn(state, error)
    response.id = state["assistant_message_id"]
    answer = _text(response.content).strip()
    if not answer:
        return _fail_turn(state, ValueError("최종 응답이 비어 있습니다."))
    _push_work_status(state, "completed", "자료 처리와 최종 응답 작성을 완료했습니다.")
    return {
        "messages": [response],
        "final_status": "completed",
    }


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def route_after_stage(state: PushUIState) -> str:
    return "stop" if state.get("final_status") == "failed" else "continue"


def build_graph():
    builder = StateGraph(PushUIState)
    builder.add_node("prepare_prompt", prepare_prompt)
    builder.add_node("search_data_llm_call_with_push_ui_message", search_data_llm_call_with_push_ui_message)
    builder.add_node("collect_data_llm_call_with_push_ui_message", collect_data_llm_call_with_push_ui_message)
    builder.add_node("complete_data_llm_call_with_push_ui_message", complete_data_llm_call_with_push_ui_message)
    builder.add_node("generate_final_answer", generate_final_answer)

    builder.add_edge(START, "prepare_prompt")
    builder.add_edge("prepare_prompt", "search_data_llm_call_with_push_ui_message")
    builder.add_conditional_edges(
        "search_data_llm_call_with_push_ui_message",
        route_after_stage,
        {"stop": END, "continue": "collect_data_llm_call_with_push_ui_message"},
    )
    builder.add_conditional_edges(
        "collect_data_llm_call_with_push_ui_message",
        route_after_stage,
        {"stop": END, "continue": "complete_data_llm_call_with_push_ui_message"},
    )
    builder.add_conditional_edges(
        "complete_data_llm_call_with_push_ui_message",
        route_after_stage,
        {"stop": END, "continue": "generate_final_answer"},
    )
    builder.add_edge("generate_final_answer", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()
