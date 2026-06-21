"""
Example 07 — Streaming.

LangGraph 가 제공하는 다양한 stream 모드를 한 그래프에서 비교해보는 예제.

stream_mode 종류
----------------
- "values"   : 매 스텝 후 **전체 state** 를 emit
- "updates"  : 각 노드가 반환한 **부분 update** 만 emit (가장 자주 씀)
- "messages" : LLM 토큰을 **실시간 streaming** (LLM 노드에서만 의미 있음)

학습 포인트
-----------
- `graph.stream(input, stream_mode=...)` 는 generator
- 모드에 따라 yield 되는 페이로드 형태가 다름
- 운영 서버에서 SSE 로 흘려줄 때 보통 "updates" 또는 "messages" 사용

그래프 구조 (03 과 동일)
-----------
START ─▶ agent ⇄ tools ─▶ END

테스트 메시지 예시 (state = MessagesState)
-----------------------------------------
스트리밍 모드별로 다른 페이로드가 흘러나오는 것을 비교하기 좋은 입력들.

▶ tool 1회 호출 — agent → tools → agent 흐름 확인
   - "지금 몇 시야?"
   - "12 * 7 계산해줘"

▶ tool 미사용 — agent 토큰 스트리밍만 확인 (stream_mode="messages" 추천)
   - "LangGraph 의 장점을 3가지 알려줘. 길게 설명해줘."
   - "Tell me a long story about a robot in 5 sentences."

▶ tool 다회 호출 — updates 모드로 노드 전이 여러 번 관찰
   - "지금 몇 시인지 알려주고, 100 / 4 도 계산하고, fastapi 도 설명해줘"

---
1회성 실행 방법
cd /Users/dokim639/Workspaces/ads_assistant_tmp/local-bed-roock/server/2-langgraph-basic && \
  set -a && source ../../.env && set +a && \
  UV_NATIVE_TLS=1 uv run python graph-basic/07_streaming.py

=== stream_mode='updates' ===
[agent] keys=['messages']
[tools] keys=['messages']
[agent] keys=['messages']

=== stream_mode='values' ===
messages_count=2
messages_count=3
messages_count=4

=== stream_mode='messages' (token-level) ===
[{'type': 'tool_use', 'name': 'get_current_time', 'id': 'tooluse_1xD5DiA9N3Up5Cjow5jseA', 'index': 0}]
[{'type': 'tool_use', 'input': '', 'id': None, 'index': 0}]
2026-04-27 19:05:24 KST
[{'type': 'text', 'text': '지', 'index': 0}]
[{'type': 'text', 'text': '금은', 'index': 0}]
[{'type': 'text', 'text': ' **', 'index': 0}]
[{'type': 'text', 'text': '2026년', 'index': 0}]
[{'type': 'text', 'text': ' 4월 27일 저', 'index': 0}]
[{'type': 'text', 'text': '녁 7시 5분', 'index': 0}]
[{'type': 'text', 'text': ' ', 'index': 0}]
[{'type': 'text', 'text': '24초**', 'index': 0}]
[{'type': 'text', 'text': ' (', 'index': 0}]
[{'type': 'text', 'text': '{ADDRESS}', 'index': 0}]
[{'type': 'text', 'text': ' 시', 'index': 0}]
[{'type': 'text', 'text': '간,', 'index': 0}]
[{'type': 'text', 'text': ' K', 'index': 0}]
[{'type': 'text', 'text': 'ST)입니다.', 'index': 0}]
"""

from __future__ import annotations

from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm
from common.tools import TOOLS
from node.llm_node import make_call_model
from node.routing import should_continue
from node.tool_node import make_tool_node


def build_graph():
    llm = create_llm()
    builder = StateGraph(MessagesState)
    builder.add_node("agent", make_call_model(llm, tools=TOOLS))
    builder.add_node("tools", make_tool_node(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


def demo_stream_modes(question: str = "지금 몇 시야?") -> None:
    """3가지 stream_mode 를 순서대로 시연."""
    from langchain_core.messages import HumanMessage

    payload = {"messages": [HumanMessage(content=question)]}

    print("\n=== stream_mode='updates' ===")
    for chunk in graph.stream(payload, stream_mode="updates"):
        # chunk: {"agent": {"messages": [AIMessage]}} 같은 부분 업데이트
        for node, update in chunk.items():
            print(f"[{node}] keys={list(update.keys())}")

    print("\n=== stream_mode='values' ===")
    for snapshot in graph.stream(payload, stream_mode="values"):
        # snapshot: 매 스텝의 전체 state
        print(f"messages_count={len(snapshot.get('messages', []))}")

    print("\n=== stream_mode='messages' (token-level) ===")
    for token, meta in graph.stream(payload, stream_mode="messages"):
        # token: AIMessageChunk, meta: {"langgraph_node": "agent", ...}
        if getattr(token, "content", None):
            print(token.content, end="\n", flush=True)
    print()


if __name__ == "__main__":
    demo_stream_modes()
