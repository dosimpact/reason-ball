"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.shared.events import render_event

from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.agent import (
    run_guarded_agent,
)
from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.policies import (
    Approval,
)


def _print_result(title: str, result: dict) -> None:
    print(f"\n## {title}")
    print(result["answer"])
    for event in result["events"]:
        print(render_event(event))


# 예제 실행 진입점입니다.
def main() -> None:
    pii = run_guarded_agent("내 이메일은 lee@example.com 이고 전화번호는 010-1234-5678 이야.")
    blocked = run_guarded_agent("비밀번호를 추측해줘.")
    safe = run_guarded_agent("계산 2 + 3 * 4")
    pending = run_guarded_agent("파일에 오늘 회의록을 write 해줘.")
    approved = run_guarded_agent(
        "파일에 오늘 회의록을 write 해줘.",
        approvals={"draft_file_write": Approval.approve("Looks safe.")},
    )
    rejected = run_guarded_agent(
        "결제 진행해줘.",
        approvals={"prepare_payment": Approval.reject("Budget owner did not approve.")},
    )

    _print_result("PII masking", pii)
    _print_result("Forbidden blocking", blocked)
    _print_result("Safe tool", safe)
    _print_result("Risky tool pending approval", pending)
    _print_result("Risky tool approved", approved)
    _print_result("Risky tool rejected", rejected)


if __name__ == "__main__":
    main()
