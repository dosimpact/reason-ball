"""14 — 파일 쓰기 승인

쉽게 이해하기
-------------
사람 승인은 도구 실행 전에 사람이 내용을 확인하고 결정하는 절차다.
예: 파일 쓰기를 승인하거나 내용을 수정하거나 거절한다.
interrupt_on으로 write_file을 멈추고 같은 thread에서 결정값으로 재개한다.

학습 목표: 내장 write_file에 interrupt_on 적용, 승인/수정/거절 전에는 파일이 없는지 확인.
실행: uv run --extra deep-agents python graphs/deep_agents/5-control_and_reliability/14_human_approval.py
실제 모델: 같은 명령 끝에 --live (OPENAI_API_KEY 필요).
선행 실행 없음. scripted는 모델 판단을 고정하며 실제 harness를 실행한다.

그래프 구조
-----------
파일 쓰기 도구를 실행 전에 멈추고, 사람의 승인·수정·거절 결정에 따라 처리를 재개한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "/approved.txt에 draft를 저장해줘."
    }
  ]
}
```
관찰할 결과: 쓰기 전에 __interrupt__로 멈추며 승인 후 /approved.txt에 draft, 수정 승인 후 reviewed, 거절 시 파일 미생성을 확인합니다.

실행 조건·방법:
기본 scripted 모드는 모델의 결정을 고정하고 실제 harness를 실행합니다. --live는 API 키가 필요하며 도구 선택·결과가 달라질 수 있습니다.
동일 thread에서 Command(resume={"decisions": [{"type": "approve"}]})로 재개합니다. Python standalone은 build_graph의 InMemorySaver를 쓰고 config={"configurable": {"thread_id": "input-demo"}}를 전달합니다. main의 --decision approve/edit/reject도 사용할 수 있습니다.
"""

from __future__ import annotations

import argparse

from deepagents import create_deep_agent
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from common.deep_agents.demo import run
from common.deep_agents.model import call, create_model

PROMPT = "/approved.txt에 draft를 저장해줘."


def build_graph(model=None, checkpointer=True):
    return create_deep_agent(
        model=model
        or create_model([[call("write_file", file_path="/approved.txt", content="draft")]]),
        interrupt_on={"write_file": {"allowed_decisions": ["approve", "edit", "reject"]}},
        checkpointer=InMemorySaver() if checkpointer is True else checkpointer,
        name="human_approval",
    )


def resume_decision(action):
    if action == "edit":
        return {
            "type": "edit",
            "edited_action": {
                "name": "write_file",
                "args": {"file_path": "/approved.txt", "content": "reviewed"},
            },
        }
    if action == "reject":
        return {"type": "reject", "message": "저장을 거절합니다."}
    return {"type": "approve"}


def studio_graph(config):
    """Agent Server가 checkpoint를 관리하므로 로컬 saver를 전달하지 않는다."""
    return build_graph(checkpointer=None)


graph = build_graph()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--decision",
        choices=["approve", "edit", "reject"],
        help="명시하면 대화식 입력 대신 해당 결정을 사용",
    )
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    config = {"configurable": {"thread_id": "approval-demo"}, "recursion_limit": 60}
    paused = run(graph, {"messages": [("user", PROMPT)]}, config)
    if "__interrupt__" in paused:
        decision = args.decision or input("approve / edit / reject: ").strip()
        if decision not in ("approve", "edit", "reject"):
            raise SystemExit("유효하지 않은 결정. 실행을 재개하지 않았습니다.")
        run(graph, Command(resume={"decisions": [resume_decision(decision)]}), config)
