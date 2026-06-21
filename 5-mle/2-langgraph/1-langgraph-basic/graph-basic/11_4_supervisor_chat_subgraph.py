"""
Example 11_4 — **Command 분기형 재사용 가능한 chat subgraph** 패턴.

11_3 의 "부모/자식 schema 분리 + messages 만 공유" 패턴을 응용하여,
**하나의 compiled subgraph 를 여러 위치에 재부착**하면서, 각 호출 시점에
**부모가 명령(command)과 payload 를 주입**해 동작을 제어한다.

Note  
Q. ChatState만 api, ui단에  노출시키는게  가능?  
- LangGraph 의 StateGraph 는 state / input / output schema 를 분리해서 줄 수 있다.  

```python
    builder = StateGraph(
        state_schema=ParentState,
        output_schema=ApiOutputState,   # ⭐
    )
```
- 스트리밍 시 namespace 로 chat 노드 이벤트만 출력 가능  

CHAT_NODES = {"chat_after_B", "chat_after_D", "chat_final"}

for ns, update in graph.stream(
    initial_state,
    stream_mode="values",
    subgraphs=True,
):
    # ns 는 ('chat_after_B:<uuid>',) 같은 튜플
    if ns and any(n.split(":", 1)[0] in CHAT_NODES for n in ns):
        # 이 update 만 UI 로 보냄 — ChatState 영역에서 발생한 변경분
        ui_send(update)

- chat 노드에서 get_stream_writer() 로 custom 이벤트 송출 > 완전 커스터 마이징  


chat_graph 의 동작 (입력 contract)
----------------------------------
부모는 chat 노드 직전에 다음 두 키를 반드시 세팅한다:

  - chat_command : "summarize" | "append_message"
  - chat_payload : 처리할 본문 텍스트

내부 분기:

      START
        │
        ▼
   ┌── route ───────────────────────────────┐
   │                                        │
   ▼                                        ▼
  summarize_node                       append_node
  (LLM 으로 payload 를 한 줄 요약)     (payload 를 그대로 messages 에 push)
   │                                        │
   ▼                                        ▼
                       END

출력: 두 경로 모두 `messages` 에 AIMessage(name="ui_sync") 한 개 push.

부모 graph 구조 (같은 chat_graph 를 3 군데 재부착)
--------------------------------------------------
      START
        │
        ▼
       A_intake
        │
        ▼
       B_research                         (chat_command="summarize" 세팅)
        │
        ▼
   chat_after_B   ◀── reused chat_graph (#1) → research 결과 요약 emit
        │
        ▼
       C_analyze
        │
        ▼
       D_draft                            (chat_command="append_message" 세팅)
        │
        ▼
   chat_after_D   ◀── reused chat_graph (#2) → 사전 작성된 안내문 그대로 push
        │
        ▼
     conclusion                           (chat_command="summarize" 세팅)
        │
        ▼
    chat_final    ◀── reused chat_graph (#3) → 최종 결론 한 줄 요약
        │
        ▼
       END

핵심 포인트
-----------
1. compiled subgraph 는 Runnable → 같은 객체를 여러 노드 이름으로 등록 가능.
2. 부모/자식 모두 `chat_command`, `chat_payload` 를 schema 에 두면, LangGraph 가
   키 일치 기반으로 자동 전달한다 (= 11_3 의 messages 공유와 같은 메커니즘).
3. 자식 내부 스크래치 `ui_step_count` 는 자식 schema 에만 → 부모로 누설 X.
4. chat 호출 후에도 parent state 의 chat_command/chat_payload 값은 유지되므로,
   **다음 chat 직전에 해당 필드를 다시 세팅**해야 의도대로 동작한다.

테스트 입력 예시
---------------
- {"messages": [{"role": "user", "content": "지난 분기 매출 데이터를 분석하고, 임원 보고용으로 핵심 인사이트 한 문단으로 정리해줘"}]}
- {"messages": [{"role": "user", "content": "Summarize last quarter sales for the executive team"}]}
- {"messages": [{"role": "user", "content": ""}]}

확인 포인트
-----------
- chat_after_B  : research 결과를 LLM 으로 요약한 한국어 한 줄 (summarize 분기)
- chat_after_D  : draft 단계가 직접 작성한 안내문이 변형 없이 그대로 push (append 분기)
- chat_final    : conclusion 본문을 LLM 으로 짧게 요약 (summarize 분기)
- out 키에 ui_step_count 같은 자식 내부 필드는 보이지 않아야 함.
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm

# ---------------------------------------------------------------------------
# Command 상수
# ---------------------------------------------------------------------------
CMD_SUMMARIZE = "summarize"
CMD_APPEND = "append_message"


# ===========================================================================
# State 정의 — 부모 / 자식 분리 + 공유 control 필드(chat_command/chat_payload)
# ===========================================================================
class ParentState(MessagesState):
    """메인 파이프라인 상태 + chat 호출용 control 필드."""
    stage: str           # intake_done | research_done | analyze_done | draft_done | finalized
    analysis: str        # research/analyze 산출물
    final: str           # conclusion 산출물

    # chat_graph 호출 직전에 세팅 — 자식과 키 이름이 같아 자동 전달됨
    chat_command: str    # "summarize" | "append_message"
    chat_payload: str


class ChatState(MessagesState):
    """chat subgraph 전용 schema — 외부에서 받는 control + 내부 스크래치."""
    chat_command: str    # 부모로부터 자동 매핑 (키 이름 동일)
    chat_payload: str    # 부모로부터 자동 매핑

    ui_step_count: int   # ← 부모로 누설되지 않는 내부 스크래치


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b["text"] for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return str(content)


# ===========================================================================
# Child: chat subgraph (재사용 대상)
# ===========================================================================
_SUMMARIZE_SYSTEM = (
    "You are a UI status narrator. Summarize the given PAYLOAD into a SINGLE "
    "short Korean sentence (<= 60 characters), suitable as a live progress "
    "indicator for the end user. Do NOT add quotes, prefixes, or emojis."
)


def summarize_node(state: ChatState) -> dict:
    """payload 를 LLM 으로 한 줄 요약 → ui_sync 메시지로 push."""
    payload = state.get("chat_payload", "") or "(empty payload)"
    step = state.get("ui_step_count", 0) + 1

    llm = create_llm()
    response = llm.invoke([
        SystemMessage(content=_SUMMARIZE_SYSTEM),
        HumanMessage(content=f"PAYLOAD:\n{payload}"),
    ])
    summary = _extract_text(response.content).strip()

    return {
        "ui_step_count": step,
        "messages": [
            AIMessage(
                content=f"[ui_sync #{step} | summarize] {summary}",
                name="ui_sync",
            )
        ],
    }


def append_node(state: ChatState) -> dict:
    """payload 를 가공 없이 그대로 messages 에 push."""
    payload = state.get("chat_payload", "") or "(empty payload)"
    step = state.get("ui_step_count", 0) + 1
    return {
        "ui_step_count": step,
        "messages": [
            AIMessage(
                content=f"[ui_sync #{step} | append] {payload}",
                name="ui_sync",
            )
        ],
    }


def chat_route(state: ChatState) -> Literal["summarize_node", "append_node"]:
    """chat_command 값으로 진입 분기."""
    cmd = state.get("chat_command", CMD_APPEND)
    return "summarize_node" if cmd == CMD_SUMMARIZE else "append_node"


def build_chat_subgraph():
    sg = StateGraph(ChatState)
    sg.add_node("summarize_node", summarize_node)
    sg.add_node("append_node", append_node)

    sg.add_conditional_edges(
        START,
        chat_route,
        {
            "summarize_node": "summarize_node",
            "append_node": "append_node",
        },
    )
    sg.add_edge("summarize_node", END)
    sg.add_edge("append_node", END)
    return sg.compile()


# 한 번만 컴파일 — 같은 객체를 부모의 여러 노드로 add_node
chat_graph = build_chat_subgraph()


# ===========================================================================
# Parent nodes — 메인 비즈니스 로직 + chat 호출 직전 control 세팅
# ===========================================================================
def intake(state: ParentState) -> dict:
    user_msg = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    body = _extract_text(user_msg.content) if user_msg else "(no user input)"
    return {
        "stage": "intake_done",
        "messages": [
            AIMessage(
                content=f"[intake] 사용자 요청 파싱 완료: {body[:60]}",
                name="intake",
            )
        ],
    }


def research(state: ParentState) -> dict:
    """research 결과를 다음 chat 노드(summarize)로 전달."""
    mock = (
        "2024Q4 매출은 12.4억으로 전분기 대비 +22.7% 성장했고, "
        "수도권 채널 비중이 58%까지 확대되었음."
    )
    return {
        "stage": "research_done",
        "analysis": mock,
        "messages": [
            AIMessage(content=f"[research] 데이터 수집 완료 — {mock}", name="research")
        ],
        # chat_after_B 가 사용할 control
        "chat_command": CMD_SUMMARIZE,
        "chat_payload": mock,
    }


def analyze(state: ParentState) -> dict:
    base = state.get("analysis", "")
    derived = f"성장 드라이버: 수도권 신규 채널 확장. (근거: {base})"
    return {
        "stage": "analyze_done",
        "analysis": derived,
        "messages": [
            AIMessage(content=f"[analyze] 인사이트 도출 — {derived}", name="analyze")
        ],
    }


def draft(state: ParentState) -> dict:
    """초안 단계 — 사용자에게 그대로 보여줄 안내문을 append 분기로 전달."""
    notice = "초안을 작성 중입니다. 곧 임원 보고용 요약이 완성됩니다."
    return {
        "stage": "draft_done",
        "messages": [
            AIMessage(content="[draft] 임원 보고용 초안 작성 완료.", name="draft")
        ],
        # chat_after_D 가 사용할 control: payload 를 그대로 push
        "chat_command": CMD_APPEND,
        "chat_payload": notice,
    }


def conclusion(state: ParentState) -> dict:
    """최종 결론 — chat_final 이 한 줄로 요약하도록 summarize 명령."""
    final = (
        "지난 분기 매출은 12.4억으로 +22.7% 성장했고, "
        "수도권 신규 채널 확장이 핵심 드라이버였습니다. "
        "차분기에는 영남권 확장으로 추가 +10% 성장 여력이 있습니다."
    )
    return {
        "stage": "finalized",
        "final": final,
        "messages": [
            AIMessage(content=f"[conclusion] {final}", name="conclusion")
        ],
        # chat_final 이 사용할 control
        "chat_command": CMD_SUMMARIZE,
        "chat_payload": final,
    }


# ===========================================================================
# Build top graph — 같은 chat_graph 를 3 군데에 재부착
# ===========================================================================
def build_graph():
    builder = StateGraph(ParentState)

    builder.add_node("A_intake", intake)
    builder.add_node("B_research", research)
    builder.add_node("C_analyze", analyze)
    builder.add_node("D_draft", draft)
    builder.add_node("conclusion", conclusion)

    # ⭐ 같은 compiled subgraph 객체를 노드 이름만 바꿔 3번 등록
    builder.add_node("chat_after_B", chat_graph)
    builder.add_node("chat_after_D", chat_graph)
    builder.add_node("chat_final", chat_graph)

    builder.add_edge(START, "A_intake")
    builder.add_edge("A_intake", "B_research")
    builder.add_edge("B_research", "chat_after_B")
    builder.add_edge("chat_after_B", "C_analyze")
    builder.add_edge("C_analyze", "D_draft")
    builder.add_edge("D_draft", "chat_after_D")
    builder.add_edge("chat_after_D", "conclusion")
    builder.add_edge("conclusion", "chat_final")
    builder.add_edge("chat_final", END)

    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content=(
                        "지난 분기 매출 데이터를 분석하고, "
                        "임원 보고용으로 핵심 인사이트 한 문단으로 정리해줘."
                    )
                )
            ],
            "stage": "",
            "analysis": "",
            "final": "",
            "chat_command": "",
            "chat_payload": "",
        },
        config={"recursion_limit": 40},
    )

    print("\n=== transcript (messages — 부모/자식 공유 키) ===")
    for m in out["messages"]:
        tag = getattr(m, "name", None) or type(m).__name__
        body = _extract_text(m.content) if not isinstance(m.content, str) else m.content
        print(f"[{tag}] {body[:200]}")

    print("\n=== parent state keys (자식 내부 필드 누설 여부 확인) ===")
    print(sorted(out.keys()))
    # 기대: chat_command, chat_payload, analysis, final, messages, stage
    # ui_step_count 는 자식 schema 에만 있으므로 누설되지 않음.
