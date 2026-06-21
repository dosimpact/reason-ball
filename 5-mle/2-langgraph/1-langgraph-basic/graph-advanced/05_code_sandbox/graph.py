"""
05 — Code Sandbox (Docker 격리 실행).

LLM 이 생성한 Python 코드를 호스트에서 그대로 `exec()` 하면
파일시스템 / 네트워크 / 프로세스 전체가 위험. Docker 컨테이너로
격리해서 메모리·CPU·네트워크·실행시간을 hard cap 으로 제한한다.

격리 옵션 (run_python tool 에서 적용)
-----------------------------------
- `--rm`            : 종료 즉시 컨테이너 삭제
- `--network=none`  : 네트워크 차단
- `--memory=256m`   : 메모리 상한
- `--cpus=0.5`      : CPU 상한
- `--pids-limit=64` : fork bomb 방지
- `--read-only`     : 루트 fs 읽기 전용 (tmpfs 만 쓰기)
- timeout 10s       : subprocess timeout
- stdout/stderr 8KB : 출력 사이즈 cap

그래프 구조
-----------
START ─▶ agent ⇄ tools(run_python)
            │
            ▼
           END

테스트 시나리오
---------------
▶ "1부터 10까지 합 계산해줘"
▶ "fibonacci(10) 출력해줘"
▶ "import os; os.system('rm -rf /') 를 실행해봐"  → 컨테이너 안에서 격리되어 호스트 영향 없음
"""
from __future__ import annotations

import os
import shutil
import subprocess
from typing import Any

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm

SANDBOX_IMAGE = os.environ.get("SANDBOX_IMAGE", "sandbox-python")
SANDBOX_TIMEOUT_SEC = int(os.environ.get("SANDBOX_TIMEOUT_SEC", "10"))
SANDBOX_OUTPUT_LIMIT = int(os.environ.get("SANDBOX_OUTPUT_LIMIT", "8192"))


def _truncate(s: str, limit: int) -> str:
    if len(s) <= limit:
        return s
    return s[:limit] + f"\n...[truncated, {len(s) - limit} bytes]"


@tool
def run_python(code: str) -> str:
    """주어진 Python 코드를 격리된 Docker 컨테이너에서 실행하고 stdout 을 반환한다.

    - 네트워크 차단, 메모리/CPU/PID 상한, 10초 timeout, 출력 8KB 제한.
    - 코드는 stdin 으로 전달 (argv 길이 제한 회피).
    """
    if shutil.which("docker") is None:
        return "ERROR: docker CLI not found on host"

    cmd = [
        "docker", "run", "--rm", "-i",
        "--network=none",
        "--memory=256m",
        "--cpus=0.5",
        "--pids-limit=64",
        "--read-only",
        "--tmpfs", "/tmp:rw,size=64m",
        SANDBOX_IMAGE,
        "python", "-I", "-",
    ]
    try:
        proc = subprocess.run(
            cmd,
            input=code.encode("utf-8"),
            capture_output=True,
            timeout=SANDBOX_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        return f"ERROR: timeout after {SANDBOX_TIMEOUT_SEC}s"
    except FileNotFoundError:
        return "ERROR: docker not available"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {type(e).__name__}: {e}"

    out = proc.stdout.decode("utf-8", errors="replace")
    err = proc.stderr.decode("utf-8", errors="replace")
    parts: list[str] = []
    if out:
        parts.append("STDOUT:\n" + _truncate(out, SANDBOX_OUTPUT_LIMIT))
    if err:
        parts.append("STDERR:\n" + _truncate(err, 2048))
    parts.append(f"exit={proc.returncode}")
    return "\n".join(parts) if parts else "(no output)"


TOOLS = [run_python]

SYSTEM_PROMPT = (
    "너는 사용자의 요청을 해결하기 위해 짧은 Python 코드를 작성하고 "
    "run_python tool 로 실행해 결과를 확인하는 코드 어시스턴트다. "
    "긴 의존성 설치는 불가능하고, 표준 라이브러리만 쓸 수 있다. "
    "결과는 print() 로 출력해야 tool 응답에 잡힌다."
)


def _agent_node(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    msgs = state["messages"]
    if not msgs or not isinstance(msgs[0], SystemMessage):
        msgs = [SystemMessage(content=SYSTEM_PROMPT), *msgs]
    return {"messages": [llm.invoke(msgs)]}


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
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke(
        {"messages": [HumanMessage(content="1부터 10까지의 합을 계산해서 출력해줘")]}
    )
    print(out["messages"][-1].content)
