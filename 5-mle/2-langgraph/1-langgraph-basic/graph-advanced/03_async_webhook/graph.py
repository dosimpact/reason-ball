"""
03 — 비동기 / Webhook Callback 패턴.

장시간 실행 tool (영상 인코딩, 외부 배치 잡, human approval 등) 은
동기 응답을 기다릴 수 없습니다. 그래프 안에서 그냥 `time.sleep` 으로
폴링하면 워커가 점유되고, 클라이언트 connection 도 끊어집니다.

해법: tool 안에서 외부 시스템에 job 을 제출한 뒤 `interrupt()` 로 그래프를
일시 정지 → 외부 시스템이 webhook 으로 결과를 보내오면 서버가
`Command(resume=결과)` 로 그래프를 재개.

그래프 구조
-----------
START ─▶ agent ⇄ tools(long_running_job ⛔ interrupt)
            │
            ▼
           END

테스트 시나리오
---------------
▶ POST /chat  {"thread_id": "t1", "message": "비디오 인코딩 잡 돌려줘"}
   → tool 이 mock_external 에 job 제출 후 interrupt → 응답에 {status: "waiting", job_id, callback_url}
▶ mock_external 이 N초 뒤 POST /webhook/t1 호출 → 서버가 Command(resume=...) 로 재개
▶ GET /chat/{thread_id} 로 최종 메시지 확인
"""
from __future__ import annotations

import os
import uuid
from typing import Any

import httpx
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt

from common.llm import create_llm

SERVER_BASE_URL = os.environ.get("SERVER_BASE_URL", "http://localhost:8000")
MOCK_EXTERNAL_URL = os.environ.get(
    "MOCK_EXTERNAL_URL",
    f"http://localhost:{os.environ.get('MOCK_EXTERNAL_PORT', '9000')}/jobs",
)


@tool
def long_running_job(task: str) -> str:
    """장시간 걸리는 외부 잡 (예: 비디오 인코딩, 배치 분석) 을 제출한다.

    내부적으로 외부 시스템에 job 을 등록하고, 그래프를 interrupt() 로 멈춘 뒤
    webhook 으로 결과가 들어오면 Command(resume=...) 로 재개되어 그 값을 반환한다.
    """
    job_id = uuid.uuid4().hex[:12]
    callback_url = f"{SERVER_BASE_URL}/webhook/{{thread_id}}"  # 서버가 thread 단위로 라우팅

    # 외부 시스템에 job 등록 (mock_external.py 가 받음).
    # 실패해도 interrupt 자체는 진행 — 운영에서는 재시도 / DLQ 고려 필요.
    try:
        httpx.post(
            MOCK_EXTERNAL_URL,
            json={"job_id": job_id, "task": task, "callback_url": callback_url},
            timeout=5.0,
        )
    except Exception as e:  # noqa: BLE001
        # TODO(prod): 외부 시스템 장애 시 graceful degradation (재시도 / fallback)
        print(f"[long_running_job] failed to submit job: {e}")

    # 여기서 그래프가 멈춘다. 클라이언트(서버) 가 webhook 수신 → Command(resume=결과) 로 재개.
    result: Any = interrupt(
        {
            "type": "external_job",
            "job_id": job_id,
            "task": task,
            "callback_url_template": callback_url,
        }
    )
    # resume 으로 들어온 결과를 그대로 tool 결과로 반환 → agent 가 후속 응답 생성.
    if isinstance(result, dict):
        return result.get("result", str(result))
    return str(result)


TOOLS = [long_running_job]


def _agent_node(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    msg = llm.invoke(state["messages"])
    return {"messages": [msg]}


def _should_continue(state: MessagesState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    # langgraph dev 는 checkpointer 자동 주입.
    # server.py 에서는 build_graph_with_checkpointer(saver) 로 명시적 부착.
    return builder.compile()


def build_graph_with_checkpointer(checkpointer):
    """외부에서 주입한 checkpointer 로 그래프를 컴파일해 반환.

    server.py 가 PostgresSaver 를 lifespan 에서 만들어 이 함수에 넘긴다.
    server.py 가 graph.py 의 내부 함수(_agent_node 등) 를 직접 import 하지
    않도록 공개 인터페이스로 분리.
    """
    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


__all__ = ["graph", "build_graph", "build_graph_with_checkpointer", "TOOLS"]


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    builder = StateGraph(MessagesState)
    builder.add_node("agent", _agent_node)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", _should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    standalone = builder.compile(checkpointer=MemorySaver())

    cfg = {"configurable": {"thread_id": "demo-webhook-1"}}
    out = standalone.invoke(
        {"messages": [HumanMessage(content="비디오 인코딩 잡 돌려줘")]}, config=cfg
    )
    print("interrupted:", out)
    final = standalone.invoke(
        Command(resume={"result": "encoded ok (mock)"}), config=cfg
    )
    print("resumed:", final["messages"][-1].content)
