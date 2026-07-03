"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. 도구와 모델을 묶어 에이전트 실행 단위를 구성합니다."""

from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.middleware import (
    AgentContext,
    GuardrailMiddleware,
    ToolCall,
    ToolExecution,
)
from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.policies import (
    Approval,
    normalize_approval,
)
from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.tools import (
    invoke_tool,
)


_ARITHMETIC_PATTERN = re.compile(r"[-+*/().\d\s]{3,}")


def _latest_user_text(messages: list[Any]) -> str:
    latest = ""
    for message in messages:
        if isinstance(message, dict):
            if message.get("role") in {"user", "human"}:
                latest = str(message.get("content", ""))
            continue
        if getattr(message, "type", None) == "human":
            latest = str(getattr(message, "content", ""))
    return latest


def _extract_expression(text: str) -> str:
    matches = [match.group(0).strip() for match in _ARITHMETIC_PATTERN.finditer(text)]
    expressions = [match for match in matches if any(char.isdigit() for char in match)]
    return max(expressions, key=len) if expressions else "1 + 1"


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def _plan_tool_call(model_input: str) -> ToolCall | None:
    if _contains_any(model_input, ("calculate", "계산", "compute")):
        return ToolCall("calculate", {"expression": _extract_expression(model_input)})
    if _contains_any(model_input, ("weather", "날씨")):
        city = "Seoul"
        if "busan" in model_input.lower() or "부산" in model_input:
            city = "Busan"
        if "san francisco" in model_input.lower():
            city = "San Francisco"
        return ToolCall("lookup_weather", {"city": city})
    if _contains_any(model_input, ("send email", "email 보내", "메일 보내")):
        return ToolCall(
            "send_email_draft",
            {"to": "[EMAIL]", "body": model_input},
        )
    if _contains_any(model_input, ("payment", "결제", "pay ")):
        return ToolCall(
            "prepare_payment",
            {"payee": "sample-vendor", "amount": "10000 KRW"},
        )
    if _contains_any(model_input, ("file", "파일", "write")):
        return ToolCall(
            "draft_file_write",
            {"filename": "lecture-note.txt", "content": model_input},
        )
    return None


def _normalize_approvals(raw: dict[str, Any] | None) -> dict[str, Approval]:
    return {
        name: normalize_approval(value)
        for name, value in (raw or {}).items()
    }


class GuardedAgent:
    def __init__(self, middleware: GuardrailMiddleware | None = None) -> None:
        self.middleware = middleware or GuardrailMiddleware()

    def invoke(self, input: dict[str, Any] | str) -> dict[str, Any]:
        if isinstance(input, str):
            user_input = input
            approvals = {}
        else:
            user_input = _latest_user_text(input.get("messages", []))
            approvals = _normalize_approvals(input.get("approvals"))

        context = AgentContext(user_input=user_input, approvals=approvals)
        self.middleware.before_agent(context)
        if context.blocked_reason:
            status = "blocked"
            answer = f"BLOCKED: {context.blocked_reason}"
            self.middleware.after_agent(context, status)
            return self._build_result(context, answer, status)

        self.middleware.before_model(context)
        tool_call = _plan_tool_call(context.model_input)
        self.middleware.after_model(context, tool_call)

        tool_execution: ToolExecution | None = None
        if tool_call is None:
            status = "answered"
            answer = f"Processed with masked model input: {context.model_input}"
        else:
            tool_execution = self.middleware.wrap_tool_call(
                context,
                tool_call,
                invoke_tool,
            )
            status = tool_execution.status
            answer = self._answer_from_tool_execution(tool_execution)

        self.middleware.after_agent(context, status)
        return self._build_result(context, answer, status, tool_execution)

    def _answer_from_tool_execution(self, tool_execution: ToolExecution) -> str:
        if tool_execution.status == "executed":
            return tool_execution.result
        if tool_execution.status == "approval_required":
            return (
                f"APPROVAL_REQUIRED: {tool_execution.tool_name} needs human approval."
            )
        if tool_execution.status == "rejected":
            return f"REJECTED: {tool_execution.reason}"
        return f"{tool_execution.status}: {tool_execution.reason}"

    def _build_result(
        self,
        context: AgentContext,
        answer: str,
        status: str,
        tool_execution: ToolExecution | None = None,
    ) -> dict[str, Any]:
        messages = [
            HumanMessage(content=context.model_input or "[blocked before model]"),
            AIMessage(content=answer),
        ]
        return {
            "messages": messages,
            "answer": answer,
            "status": status,
            "sanitized_input": context.model_input,
            "blocked_reason": context.blocked_reason,
            "model_called": context.model_called,
            "tool_called": context.tool_called,
            "tool_execution": tool_execution,
            "events": context.events,
        }


def build_guarded_agent() -> GuardedAgent:
    return GuardedAgent()


def run_guarded_agent(
    message: str,
    approvals: dict[str, Approval | str | dict[str, Any]] | None = None,
) -> dict[str, Any]:
    agent = build_guarded_agent()
    return agent.invoke(
        {
            "messages": [{"role": "user", "content": message}],
            "approvals": approvals or {},
        }
    )
