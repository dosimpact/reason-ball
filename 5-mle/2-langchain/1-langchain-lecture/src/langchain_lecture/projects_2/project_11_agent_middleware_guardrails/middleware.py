"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. 에이전트 실행 전후에 공통 정책을 적용하는 미들웨어입니다."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from langchain_lecture.shared.events import AppEvent, EventType
from langchain_lecture.shared.safety import mask_pii

from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.policies import (
    Approval,
    ApprovalDecision,
    DEFAULT_FORBIDDEN_TERMS,
    evaluate_request_policy,
    get_tool_policy,
    tool_requires_approval,
)


@dataclass(frozen=True)
class ToolCall:
    name: str
    args: dict[str, Any]


@dataclass(frozen=True)
class ToolExecution:
    status: str
    tool_name: str
    args: dict[str, Any]
    result: str = ""
    reason: str = ""


@dataclass
class AgentContext:
    user_input: str
    model_input: str = ""
    blocked_reason: str = ""
    model_called: bool = False
    tool_called: bool = False
    events: list[AppEvent] = field(default_factory=list)
    approvals: dict[str, Approval] = field(default_factory=dict)


class GuardrailMiddleware:
    def __init__(
        self,
        forbidden_terms: tuple[str, ...] = DEFAULT_FORBIDDEN_TERMS,
    ) -> None:
        self.forbidden_terms = forbidden_terms

    def before_agent(self, context: AgentContext) -> None:
        result = evaluate_request_policy(context.user_input, self.forbidden_terms)
        if not result.allowed:
            context.blocked_reason = result.reason
            context.events.append(
                AppEvent(EventType.ERROR, "request_blocked", {"reason": result.reason})
            )

    def before_model(self, context: AgentContext) -> None:
        context.model_input = mask_pii(context.user_input)
        if context.model_input != context.user_input:
            context.events.append(AppEvent(EventType.CUSTOM, "pii_masked"))
        context.events.append(AppEvent(EventType.MESSAGE, "before_model"))

    def after_model(self, context: AgentContext, tool_call: ToolCall | None) -> None:
        context.model_called = True
        content = tool_call.name if tool_call else "direct_response"
        context.events.append(AppEvent(EventType.MESSAGE, "after_model", {"plan": content}))

    def wrap_tool_call(
        self,
        context: AgentContext,
        tool_call: ToolCall,
        execute: Callable[[str, dict[str, Any]], str],
    ) -> ToolExecution:
        policy = get_tool_policy(tool_call.name)
        args = dict(tool_call.args)
        context.events.append(
            AppEvent(
                EventType.TOOL_START,
                tool_call.name,
                {"risk": policy.risk.value},
            )
        )

        if tool_requires_approval(tool_call.name):
            approval = context.approvals.get(tool_call.name)
            if approval is None:
                context.events.append(
                    AppEvent(EventType.CUSTOM, "approval_required", {"tool": tool_call.name})
                )
                return ToolExecution(
                    status="approval_required",
                    tool_name=tool_call.name,
                    args=args,
                    reason="Human approval is required before running this tool.",
                )
            if approval.decision == ApprovalDecision.REJECT:
                context.events.append(
                    AppEvent(
                        EventType.CUSTOM,
                        "approval_rejected",
                        {"tool": tool_call.name, "reason": approval.reason},
                    )
                )
                return ToolExecution(
                    status="rejected",
                    tool_name=tool_call.name,
                    args=args,
                    reason=approval.reason or "Human reviewer rejected the tool call.",
                )
            if approval.decision == ApprovalDecision.MODIFY:
                args.update(approval.modified_args)
                context.events.append(
                    AppEvent(EventType.CUSTOM, "approval_modified", {"tool": tool_call.name})
                )
            else:
                context.events.append(
                    AppEvent(EventType.CUSTOM, "approval_approved", {"tool": tool_call.name})
                )

        result = execute(tool_call.name, args)
        context.tool_called = True
        context.events.append(AppEvent(EventType.TOOL_RESULT, result, {"tool": tool_call.name}))
        return ToolExecution(
            status="executed",
            tool_name=tool_call.name,
            args=args,
            result=result,
        )

    def after_agent(self, context: AgentContext, status: str) -> None:
        context.events.append(AppEvent(EventType.DONE, status))
