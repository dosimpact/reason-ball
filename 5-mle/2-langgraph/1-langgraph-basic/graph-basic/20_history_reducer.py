"""
Example 20 — State history reducer (그래프 자체가 실행 기록을 들고 다님).

각 노드의 시작 / 종료 시각, 소요 시간, 변경한 state 키를 `history` 필드에
append-only 로 누적합니다. State 자체에 기록이 들어 있으므로:

- 클라이언트 응답에 그대로 포함시키기 쉽고
- Checkpointer 와 함께 쓰면 영속화되며
- 별도 로깅 인프라 없이도 그래프의 실행 trace 를 재구성할 수 있습니다.

학습 포인트
-----------
- `Annotated[list[dict], operator.add]` 로 append-only reducer 를 선언  
- `@with_history("name")` 데코레이터로 모든 노드를 자동 계측  
  · 시작 / 종료 두 entry 를 한 번의 노드 실행에서 함께 push  
  · 변경된 state key 목록 / elapsed_ms / 에러 여부 기록  
- `MessagesState` 를 확장해 `history` 와 `messages` 를 함께 보유  

그래프 구조
-----------
START ─▶ logger ─▶ agent ⇄ tools
                      │
                      ▼
                     END

state.history 예시
------------------
[
  {"event": "start", "node": "agent", "ts": 1712345678.123, "in_keys": ["messages"]},
  {"event": "end",   "node": "agent", "ts": 1712345678.456,
   "elapsed_ms": 333.0, "out_keys": ["messages", "history"]},
  {"event": "start", "node": "tools", ...},
  ...
]

테스트 메시지 예시 (state = MessagesState + history, 03 과 같은 도구셋)
--------------------------------------------------------------------
▶ tool 1회 호출 — history 6개 (logger, agent, tools, agent 각 start/end)
   - "지금 몇 시야?"
   - "12 * 7 계산해줘"
   - "langgraph 가 뭐야?"

▶ tool 미사용 — history 4개 (logger, agent 각 start/end)
   - "안녕!"
   - "네 자기소개를 한 줄로 해줘."

▶ tool 다회 호출 — history 8개 이상 (agent ⇄ tools 사이클 여러 번)
   - "지금 몇 시인지 알려주고, 25 * 4 도 계산해줘"
   - "langgraph 도 설명하고 fastapi 도 설명해줘"

확인 포인트
- Studio: 각 노드 카드는 "이번 스텝에 추가된" history 2개만 표시 (delta).
  최종 state inspector / `out["history"]` 는 누적된 전체.
- 카드별 in_keys / out_keys 변화로 어느 노드가 어떤 키를 처음 만들었는지 추적 가능.
"""

from __future__ import annotations

import time
from functools import wraps
from operator import add
from typing import Annotated, Any, Callable

from langchain_core.messages import AnyMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from common.llm import create_llm
from common.tools import TOOLS
from node.llm_node import make_call_model
from node.routing import should_continue
from node.tool_node import make_tool_node


class State(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    history: Annotated[list[dict[str, Any]], add]   # append-only


def with_history(name: str) -> Callable:
    """노드 함수를 감싸 start/end 기록을 자동으로 history 에 append.

    LangGraph 의 reducer 는 노드가 반환한 dict 에만 적용되므로, 이 데코레이터는
    한 번의 호출에서 두 개의 history entry (start + end) 를 함께 반환합니다.
    """

    def decorator(fn: Callable[..., dict]) -> Callable[..., dict]:
        @wraps(fn)
        def wrapped(state: State, *args, **kwargs) -> dict:
            start_ts = time.time()
            start_entry = {
                "event": "start",
                "node": name,
                "ts": start_ts,
                "in_keys": sorted(k for k in state.keys() if k != "history"),
            }
            try:
                out = fn(state, *args, **kwargs) or {}
            except Exception as e:
                # 에러도 history 에 남기고 그대로 전파 (RetryPolicy 등과 호환)
                err_entry = {
                    "event": "error",
                    "node": name,
                    "ts": time.time(),
                    "elapsed_ms": round((time.time() - start_ts) * 1000, 2),
                    "error": f"{type(e).__name__}: {e}",
                }
                # raise 하기 전에 reducer 를 거치게 할 수 없으므로 로깅 용도로만.
                # 실제 누적은 정상 종료 경로에서 이뤄짐.
                print(f"[history] {err_entry}")
                raise

            # ToolNode 같은 prebuilt 가 list 를 반환하는 경우 dict 로 정규화
            if not isinstance(out, dict):
                out = {"messages": out}

            end_entry = {
                "event": "end",
                "node": name,
                "ts": time.time(),
                "elapsed_ms": round((time.time() - start_ts) * 1000, 2),
                "out_keys": sorted(out.keys()),
            }

            existing = list(out.get("history", []))
            out["history"] = [start_entry, *existing, end_entry]
            return out

        return wrapped

    return decorator


@with_history("logger")
def _dummy_logger(state: State) -> dict:
    """agent 진입 직전에 호출되는 더미 로거. state 는 변경하지 않고 print 만."""
    msgs = state.get("messages", [])
    print(f"[logger] incoming messages={len(msgs)} keys={sorted(state.keys())}")
    return {}


def build_graph():
    llm = create_llm()
    agent_node = with_history("agent")(make_call_model(llm, tools=TOOLS))
    tool_node = with_history("tools")(make_tool_node(TOOLS).invoke)

    builder = StateGraph(State)
    builder.add_node("logger", _dummy_logger)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", tool_node)
    
    builder.add_edge(START, "logger")
    builder.add_edge("logger", "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke({"messages": [HumanMessage(content="123 * 456 을 계산해줘")]})

    print("=== final reply ===")
    print(out["messages"][-1].content)

    print("\n=== execution history ===")
    for i, h in enumerate(out.get("history", [])):
        if h["event"] == "start":
            print(f"{i:2d} ▶ {h['node']:6s} start  in_keys={h['in_keys']}")
        elif h["event"] == "end":
            print(
                f"{i:2d} ✔ {h['node']:6s} end    "
                f"elapsed={h['elapsed_ms']:>7.1f}ms  out_keys={h['out_keys']}"
            )
        else:
            print(f"{i:2d} ✘ {h['node']:6s} {h['event']}  {h.get('error')}")
