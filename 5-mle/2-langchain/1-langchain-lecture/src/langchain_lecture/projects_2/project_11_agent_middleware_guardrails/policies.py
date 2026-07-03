"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. 가드레일과 도구 승인에 사용할 정책 규칙을 정의합니다."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from langchain_lecture.shared.safety import ToolPolicy, ToolRisk, requires_approval


class RequestAction(str, Enum):
    ALLOW = "allow"
    BLOCK = "block"


class ApprovalDecision(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    MODIFY = "modify"


@dataclass(frozen=True)
class RequestPolicyResult:
    action: RequestAction
    reason: str = ""

    @property
    def allowed(self) -> bool:
        return self.action == RequestAction.ALLOW


@dataclass(frozen=True)
class Approval:
    decision: ApprovalDecision
    reason: str = ""
    modified_args: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def approve(cls, reason: str = "") -> Approval:
        return cls(ApprovalDecision.APPROVE, reason=reason)

    @classmethod
    def reject(cls, reason: str = "") -> Approval:
        return cls(ApprovalDecision.REJECT, reason=reason)

    @classmethod
    def modify(cls, modified_args: dict[str, Any], reason: str = "") -> Approval:
        return cls(
            ApprovalDecision.MODIFY,
            reason=reason,
            modified_args=dict(modified_args),
        )


DEFAULT_FORBIDDEN_TERMS = (
    "비밀번호",
    "password",
    "guess the password",
    "credential stuffing",
    "delete all",
    "파일 삭제",
)


DEFAULT_TOOL_POLICIES: dict[str, ToolPolicy] = {
    "calculate": ToolPolicy(
        name="calculate",
        risk=ToolRisk.SAFE,
        description="Deterministic arithmetic calculator.",
    ),
    "lookup_weather": ToolPolicy(
        name="lookup_weather",
        risk=ToolRisk.SAFE,
        description="Offline weather lookup over built-in sample data.",
    ),
    "draft_file_write": ToolPolicy(
        name="draft_file_write",
        risk=ToolRisk.RISKY,
        description="Drafts a file write action; requires human approval.",
    ),
    "send_email_draft": ToolPolicy(
        name="send_email_draft",
        risk=ToolRisk.RISKY,
        description="Drafts an email send action; requires human approval.",
    ),
    "prepare_payment": ToolPolicy(
        name="prepare_payment",
        risk=ToolRisk.RISKY,
        description="Prepares a payment action; requires human approval.",
    ),
}


def evaluate_request_policy(
    text: str,
    forbidden_terms: tuple[str, ...] = DEFAULT_FORBIDDEN_TERMS,
) -> RequestPolicyResult:
    lowered = text.lower()
    for term in forbidden_terms:
        if term.lower() in lowered:
            return RequestPolicyResult(
                action=RequestAction.BLOCK,
                reason=f"Forbidden request contains {term!r}.",
            )
    return RequestPolicyResult(action=RequestAction.ALLOW)


def get_tool_policy(tool_name: str) -> ToolPolicy:
    try:
        return DEFAULT_TOOL_POLICIES[tool_name]
    except KeyError as exc:
        raise KeyError(f"No tool policy configured for {tool_name!r}.") from exc


def tool_requires_approval(tool_name: str) -> bool:
    return requires_approval(get_tool_policy(tool_name))


def normalize_approval(value: Approval | str | dict[str, Any]) -> Approval:
    if isinstance(value, Approval):
        return value
    if isinstance(value, str):
        decision = ApprovalDecision(value.lower())
        return Approval(decision=decision)
    decision = ApprovalDecision(str(value.get("decision", "")).lower())
    return Approval(
        decision=decision,
        reason=str(value.get("reason", "")),
        modified_args=dict(value.get("modified_args", {})),
    )
