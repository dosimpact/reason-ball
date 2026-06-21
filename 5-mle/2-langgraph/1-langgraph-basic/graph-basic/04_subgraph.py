"""
Example 04 — 서브그래프(subgraph) 2개 + LLM 분류 라우팅 (MessagesState 버전).

부모 그래프가 LLM 으로 사용자 의도를 분류한 뒤, 의도에 맞는 서브그래프로
조건부 라우팅합니다. 매칭되는 의도가 없으면 서브그래프를 건너뛰고
바로 종료합니다.

State 가 `MessagesState` 이므로 각 노드는 자신의 작업 결과를 `AIMessage` 로
누적해 messages 에 push 합니다. 결과적으로 messages 배열만 봐도 그래프가
어떤 단계를 거쳤는지 추적 가능합니다 (classify → 서브그래프 단계들 → 최종).

시나리오
--------
- parent: classify(LLM, AIMessage 출력) ─▶ (translator | summarizer | finalize_other)
- translator subgraph : detect_lang ─▶ translate
- summarizer subgraph : summarize

학습 포인트
-----------
- `MessagesState` 를 확장해 라우팅용 `intent` 필드만 추가
- 각 노드가 작업 진행을 AIMessage 로 남겨 "중간 출력물" 가시화
- `with_structured_output(Pydantic)` 로 분류/언어 감지 결과를 강제 스키마화
- `add_conditional_edges` 로 intent 에 따라 서브그래프 또는 우회 경로 선택

그래프 구조
-----------
parent:
  START ─▶ classify ─┬─▶ translator ─▶ END   (intent=translate)
                     ├─▶ summarizer ─▶ END   (intent=summarize)
                     └─▶ finalize_other ─▶ END  (intent=other, 서브그래프 우회)

translator subgraph:  START ─▶ detect_lang ─▶ translate ─▶ END
summarizer subgraph:  START ─▶ summarize ─▶ END

테스트 입력 예시 (messages 의 마지막 HumanMessage 가 분류 대상)
---------------------------------------------------------------
▶ translate
   - {"messages": [{"role": "user", "content": "Hello, how are you today? (한국어로)"}]}
   - {"messages": [{"role": "user", "content": "이 문장을 영어로 번역해줘: 오늘 회의는 오후 3시입니다."}]}
▶ summarize
   - {"messages": [{"role": "user", "content": "다음 글을 한 문장으로 요약해줘: LangGraph 는 ..."}]}
▶ other (서브그래프 호출 안 함)
   - {"messages": [{"role": "user", "content": "지금 몇 시야?"}]}
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


# ---------------------------------------------------------------------------
# State: MessagesState + 라우팅용 intent 필드 한 개
# ---------------------------------------------------------------------------
class State(MessagesState):
    intent: str   # "translate" | "summarize" | "other"


def _last_user_text(state: State) -> str:
    """messages 끝에서 가장 가까운 HumanMessage 의 content 를 꺼낸다."""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    # 안전장치: HumanMessage 가 없으면 마지막 메시지의 content 를 그대로 사용
    return str(state["messages"][-1].content)


def _extract_text(content) -> str:
    """LLM 응답 content 를 일반 문자열로 정규화.

    LangChain 모델에 따라 문자열 또는 블록 리스트를 돌려줄 수 있어 둘 다 처리한다.

    OpenAI / 대부분 LangChain 모델: response.content 타입 = str
    - "The meeting is at 3 PM."
    일부 provider: response.content 타입 = list[dict] (content blocks)
    - [{"type": "text", "text": "The meeting is at 3 PM.", "index": 0}]
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and "text" in block:
                    parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


# ---------------------------------------------------------------------------
# Classifier (LLM + structured output)
# ---------------------------------------------------------------------------
class Intent(BaseModel):
    """사용자 의도 분류."""

    intent: Literal["translate", "summarize", "other"] = Field(
        description=(
            "translate: 한↔영 번역 요청 또는 다른 언어로 옮겨달라는 요청. "
            "summarize: 긴 텍스트의 요약/핵심 정리 요청. "
            "other: 위 둘 어디에도 해당하지 않는 일반 질의."
        )
    )
    rationale: str = Field(description="판단 근거 한 문장")


_CLASSIFY_SYSTEM = (
    "You classify a user's request into one of: translate, summarize, other. "
    "Pick 'translate' only if the user explicitly wants translation between "
    "Korean and English (or just provides a sentence asking to be translated). "
    "Pick 'summarize' only if the user wants a summary/condensation of text. "
    "Otherwise pick 'other'."
)


def _classify(state: State) -> dict:
    user_text = _last_user_text(state)
    llm = create_llm().with_structured_output(Intent)
    result: Intent = llm.invoke(
        [SystemMessage(content=_CLASSIFY_SYSTEM), HumanMessage(content=user_text)]
    )
    # 분류 결과를 AIMessage 로 남겨 messages 트랜스크립트에 흔적을 남긴다.
    trace = AIMessage(
        content=f"[classify] intent={result.intent} — {result.rationale}",
        name="classifier",
    )
    return {"intent": result.intent, "messages": [trace]}


def _route_by_intent(state: State) -> str:
    return state.get("intent", "other")


# ---------------------------------------------------------------------------
# Subgraph 1: translator (영↔한)
# ---------------------------------------------------------------------------
class LangDetect(BaseModel):
    src_lang: Literal["ko", "en"] = Field(description="입력 텍스트의 주요 언어")


def _detect_lang(state: State) -> dict:
    user_text = _last_user_text(state)
    llm = create_llm().with_structured_output(LangDetect)
    result: LangDetect = llm.invoke(
        [
            SystemMessage(
                content="Detect whether the user's text is mainly Korean (ko) or English (en)."
            ),
            HumanMessage(content=user_text),
        ]
    )
    tgt = "en" if result.src_lang == "ko" else "ko"
    trace = AIMessage(
        content=f"[detect_lang] src={result.src_lang}, tgt={tgt}",
        name="detect_lang",
        # 라우팅에 필요한 값은 additional_kwargs 에 같이 흘려보내 다음 노드에서 사용.
        additional_kwargs={"src_lang": result.src_lang, "tgt_lang": tgt},
    )
    return {"messages": [trace]}


def _find_detect_trace(state: State) -> AIMessage | None:
    for msg in reversed(state["messages"]):
        if isinstance(msg, AIMessage) and msg.name == "detect_lang":
            return msg
    return None


def _translate(state: State) -> dict:
    detect = _find_detect_trace(state)
    src = (detect.additional_kwargs.get("src_lang") if detect else None) or "ko"
    tgt = (detect.additional_kwargs.get("tgt_lang") if detect else None) or "en"
    direction = "Korean to English" if src == "ko" else "English to Korean"

    user_text = _last_user_text(state)
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Translate the user text from {direction}. "
                    "Return ONLY the translated text without any explanation."
                )
            ),
            HumanMessage(content=user_text),
        ]
    )
    body = _extract_text(response.content)
    return {
        "messages": [
            AIMessage(content=f"[translate {src}→{tgt}] {body}", name="translator")
        ]
    }


def _build_translator_subgraph():
    sg = StateGraph(State)
    sg.add_node("detect_lang", _detect_lang)
    sg.add_node("translate", _translate)
    sg.add_edge(START, "detect_lang")
    sg.add_edge("detect_lang", "translate")
    sg.add_edge("translate", END)
    return sg.compile()


# ---------------------------------------------------------------------------
# Subgraph 2: summarizer
# ---------------------------------------------------------------------------
def _summarize(state: State) -> dict:
    user_text = _last_user_text(state)
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Summarize the user's text in ONE concise sentence. "
                    "Match the language of the input."
                )
            ),
            HumanMessage(content=user_text),
        ]
    )
    body = _extract_text(response.content)
    return {"messages": [AIMessage(content=f"[summary] {body}", name="summarizer")]}


def _build_summarizer_subgraph():
    sg = StateGraph(State)
    sg.add_node("summarize", _summarize)
    sg.add_edge(START, "summarize")
    sg.add_edge("summarize", END)
    return sg.compile()


# ---------------------------------------------------------------------------
# Parent graph
# ---------------------------------------------------------------------------
def _finalize_other(state: State) -> dict:
    """intent=other 일 때 서브그래프 없이 종결 메시지만 추가."""
    return {
        "messages": [
            AIMessage(
                content="[other] 이 요청은 번역/요약이 아닙니다.",
                name="finalize_other",
            )
        ]
    }


def build_graph():
    translator = _build_translator_subgraph()
    summarizer = _build_summarizer_subgraph()

    builder = StateGraph(State)
    builder.add_node("classify", _classify)
    builder.add_node("translator", translator)       # 컴파일된 subgraph 부착
    builder.add_node("summarizer", summarizer)       # 컴파일된 subgraph 부착
    builder.add_node("finalize_other", _finalize_other)

    builder.add_edge(START, "classify")
    builder.add_conditional_edges(
        "classify",
        _route_by_intent,
        {
            "translate": "translator",
            "summarize": "summarizer",
            "other": "finalize_other",
        },
    )
    builder.add_edge("translator", END)
    builder.add_edge("summarizer", END)
    builder.add_edge("finalize_other", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    samples = [
        "Hello, how are you today?",
        "이 문장을 영어로 번역해줘: 오늘 회의는 오후 3시입니다.",
        (
            "다음 글을 한 문장으로 요약해줘: "
            "LangGraph 는 LangChain 위에서 동작하는 그래프 기반 에이전트 프레임워크로, "
            "노드와 엣지로 LLM 호출 흐름을 명시적으로 정의하고 체크포인터로 상태를 영속화하며 "
            "휴먼-인-더-루프 / 스트리밍 / 서브그래프 / 멀티 에이전트 패턴을 표준 API 로 지원한다."
        ),
        "지금 몇 시야?",
    ]
    for s in samples:
        out = graph.invoke({"messages": [HumanMessage(content=s)]})
        print(f"\n▶ user input : {s}")
        print(f"  intent     : {out.get('intent')}")
        print("  ── transcript ──")
        for m in out["messages"]:
            if isinstance(m, HumanMessage):
                print(f"    [user]        {m.content}")
            elif isinstance(m, AIMessage):
                tag = m.name or "ai"
                print(f"    [{tag}] {m.content}")
