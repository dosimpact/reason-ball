from __future__ import annotations

import ast
import json
import operator
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_05_tool_use.prompts import (
    TOOL_DECISION_SYSTEM_PROMPT,
    TOOL_DECISION_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_05_tool_use.state import (
    ToolCall,
    ToolError,
    ToolResult,
    ToolUseState,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_TOOL_CALLS = 3
MAX_INPUT_CHARS = 6000
TOOL_REGISTRY_VERSION = "chapter-05-local-v1"


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    required_arguments: dict[str, type]
    handler: Callable[[dict[str, Any]], Any]
    requires_confirmation: bool = False


def search_information(query: str) -> str:
    normalized_query = _normalize_text(query).lower()
    facts = {
        "capital of france": "Paris is the capital of France.",
        "france capital": "Paris is the capital of France.",
        "langgraph": (
            "LangGraph is a framework for building stateful, graph-based "
            "LLM applications."
        ),
        "tool use": (
            "Tool use lets an agent invoke registered external capabilities "
            "and incorporate their observations before answering."
        ),
    }

    for key, result in facts.items():
        if key in normalized_query:
            return result

    return f"No simulated search result is available for query: {query}."


def get_stock_price(ticker: str) -> float:
    prices = {
        "AAPL": 178.15,
        "MSFT": 421.55,
        "GOOGL": 175.80,
    }
    normalized_ticker = _normalize_text(ticker).upper()
    if normalized_ticker not in prices:
        raise ValueError(f"Unknown simulated ticker: {normalized_ticker}.")
    return prices[normalized_ticker]


def calculate_expression(expression: str) -> float:
    evaluator = _SafeArithmeticEvaluator()
    value = evaluator.evaluate(expression)
    return round(float(value), 10)


def _search_handler(arguments: dict[str, Any]) -> str:
    return search_information(query=arguments["query"])


def _stock_handler(arguments: dict[str, Any]) -> float:
    return get_stock_price(ticker=arguments["ticker"])


def _calculator_handler(arguments: dict[str, Any]) -> float:
    return calculate_expression(expression=arguments["expression"])


TOOL_REGISTRY: dict[str, ToolSpec] = {
    "search_information": ToolSpec(
        name="search_information",
        description="Simulated factual lookup for short natural-language queries.",
        required_arguments={"query": str},
        handler=_search_handler,
    ),
    "get_stock_price": ToolSpec(
        name="get_stock_price",
        description="Simulated stock price lookup for supported ticker symbols.",
        required_arguments={"ticker": str},
        handler=_stock_handler,
    ),
    "calculate_expression": ToolSpec(
        name="calculate_expression",
        description="Safe arithmetic calculator for numeric expressions.",
        required_arguments={"expression": str},
        handler=_calculator_handler,
    ),
}


def prepare_input(state: ToolUseState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    normalized_input = _normalize_text("" if raw_input is None else str(raw_input))
    if len(normalized_input) > MAX_INPUT_CHARS:
        normalized_input = normalized_input[:MAX_INPUT_CHARS].rstrip()

    max_tool_calls = _coerce_non_negative_int(
        state.get("max_tool_calls", DEFAULT_MAX_TOOL_CALLS),
        DEFAULT_MAX_TOOL_CALLS,
    )
    metadata = dict(state.get("metadata", {}))
    metadata.update(
        {
            "pattern": "tool_use",
            "tool_registry_version": TOOL_REGISTRY_VERSION,
        }
    )
    messages = list(state.get("messages", []))
    if normalized_input:
        messages.append({"role": "user", "content": normalized_input})

    updates: dict[str, Any] = {
        "normalized_input": normalized_input,
        "messages": messages,
        "available_tools": sorted(TOOL_REGISTRY),
        "raw_model_decision": None,
        "action": None,
        "pending_tool_call": None,
        "current_tool_result": None,
        "current_tool_error": None,
        "direct_answer": None,
        "tool_results": list(state.get("tool_results", [])),
        "tool_errors": list(state.get("tool_errors", [])),
        "tool_call_count": _coerce_non_negative_int(
            state.get("tool_call_count", 0),
            0,
        ),
        "max_tool_calls": max_tool_calls,
        "requires_confirmation": False,
        "requires_human_review": False,
        "status": "ok",
        "failure_reason": None,
        "metadata": metadata,
    }

    if not normalized_input:
        updates.update(
            {
                "status": "failed",
                "failure_reason": "Input is empty.",
                "final_output": "Input is empty.",
            }
        )

    return updates


def decide_next_action(state: ToolUseState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            TOOL_DECISION_SYSTEM_PROMPT,
            TOOL_DECISION_USER_PROMPT.format(
                normalized_input=state.get("normalized_input", ""),
                tool_definitions=_format_tool_definitions(state),
                tool_results=_to_json_text(state.get("tool_results", [])),
                tool_errors=_to_json_text(state.get("tool_errors", [])),
                tool_call_count=state.get("tool_call_count", 0),
                max_tool_calls=state.get("max_tool_calls", DEFAULT_MAX_TOOL_CALLS),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider errors vary.
        return {
            "status": "failed",
            "action": "failure",
            "failure_reason": f"decide_next_action model invocation failed: {exc}",
            "current_tool_error": _tool_error(
                name=None,
                arguments={},
                message=f"decide_next_action model invocation failed: {exc}",
                error_type="model_invocation",
                attempted=False,
            ),
        }

    return {
        "raw_model_decision": content,
        "action": None,
        "pending_tool_call": None,
        "current_tool_result": None,
        "current_tool_error": None,
        "direct_answer": None,
    }


def normalize_model_decision(state: ToolUseState) -> dict[str, Any]:
    if state.get("action") == "failure" or state.get("status") == "failed":
        return _model_decision_failure(
            state,
            state.get("failure_reason") or "The model decision failed.",
        )

    parsed, parse_error = _parse_model_decision(state.get("raw_model_decision"))
    if parse_error:
        return _model_decision_failure(state, parse_error)

    action = _normalize_text(str(parsed.get("action", ""))).lower()
    if not action:
        if "tool_call" in parsed or "function_call" in parsed:
            action = "tool_call"
        elif "answer" in parsed or "final_answer" in parsed:
            action = "answer"

    if action == "answer":
        answer = _string_or_none(
            parsed.get("answer")
            if "answer" in parsed
            else parsed.get("final_answer", parsed.get("content"))
        )
        if not answer:
            return _model_decision_failure(
                state,
                "Model answer decisions must include a non-empty answer.",
            )
        return {
            "action": "answer",
            "direct_answer": answer,
            "pending_tool_call": None,
            "current_tool_error": None,
            "status": "ok",
            "messages": _append_message(
                state,
                "assistant",
                answer,
                kind="model_decision",
            ),
        }

    if action == "tool_call":
        tool_call, call_error = _extract_tool_call(parsed)
        if call_error:
            return _model_decision_failure(state, call_error)
        return {
            "action": "tool_call",
            "pending_tool_call": tool_call,
            "direct_answer": None,
            "current_tool_error": None,
            "status": "needs_tool",
            "messages": _append_message(
                state,
                "assistant",
                _to_json_text({"action": "tool_call", "tool_call": tool_call}),
                kind="model_decision",
            ),
        }

    return _model_decision_failure(
        state,
        "Model decision must use action 'answer' or 'tool_call'.",
    )


def validate_tool_call(state: ToolUseState) -> dict[str, Any]:
    pending_tool_call = state.get("pending_tool_call")
    if not pending_tool_call:
        return {
            "status": "failed",
            "current_tool_error": _tool_error(
                name=None,
                arguments={},
                message="No pending tool call was available to validate.",
                error_type="missing_tool_call",
                attempted=False,
            ),
        }

    name = _string_or_none(pending_tool_call.get("name"))
    arguments = pending_tool_call.get("arguments")
    if not isinstance(arguments, dict):
        arguments = {}

    if state.get("tool_call_count", 0) >= state.get(
        "max_tool_calls",
        DEFAULT_MAX_TOOL_CALLS,
    ):
        return {
            "status": "failed",
            "requires_human_review": True,
            "current_tool_error": _tool_error(
                name=name,
                arguments=arguments,
                message="Maximum tool call count has been reached.",
                error_type="tool_call_limit",
                attempted=False,
            ),
        }

    if name not in TOOL_REGISTRY:
        return {
            "status": "failed",
            "current_tool_error": _tool_error(
                name=name,
                arguments=arguments,
                message=f"Unknown tool requested: {name!r}.",
                error_type="unknown_tool",
                attempted=False,
            ),
        }

    spec = TOOL_REGISTRY[name]
    argument_error = _validate_arguments(spec, arguments)
    if argument_error:
        return {
            "status": "failed",
            "current_tool_error": _tool_error(
                name=name,
                arguments=arguments,
                message=argument_error,
                error_type="schema_validation",
                attempted=False,
            ),
        }

    if spec.requires_confirmation:
        return {
            "status": "needs_confirmation",
            "requires_confirmation": True,
            "current_tool_error": None,
        }

    return {
        "status": "needs_tool",
        "requires_confirmation": False,
        "current_tool_error": None,
    }


def execute_tool(state: ToolUseState) -> dict[str, Any]:
    pending_tool_call = state.get("pending_tool_call") or {}
    name = _string_or_none(pending_tool_call.get("name"))
    arguments = pending_tool_call.get("arguments")
    if not isinstance(arguments, dict):
        arguments = {}

    if name not in TOOL_REGISTRY:
        return {
            "status": "failed",
            "current_tool_error": _tool_error(
                name=name,
                arguments=arguments,
                message=f"Unknown tool requested during execution: {name!r}.",
                error_type="unknown_tool",
                attempted=False,
            ),
        }

    try:
        result = TOOL_REGISTRY[name].handler(dict(arguments))
    except Exception as exc:
        return {
            "status": "failed",
            "current_tool_result": None,
            "current_tool_error": _tool_error(
                name=name,
                arguments=arguments,
                message=f"{name} failed: {exc}",
                error_type="tool_execution",
                attempted=True,
            ),
        }

    observation: ToolResult = {
        "name": name,
        "arguments": dict(arguments),
        "result": result,
        "status": "ok",
    }
    return {
        "status": "ok",
        "current_tool_result": observation,
        "current_tool_error": None,
    }


def record_observation(state: ToolUseState) -> dict[str, Any]:
    current_tool_result = state.get("current_tool_result")
    if not current_tool_result:
        return {
            "status": "failed",
            "current_tool_error": _tool_error(
                name=None,
                arguments={},
                message="Tool execution did not produce an observation.",
                error_type="missing_observation",
                attempted=False,
            ),
        }

    tool_results = [*state.get("tool_results", []), current_tool_result]
    return {
        "tool_results": tool_results,
        "tool_call_count": state.get("tool_call_count", 0) + 1,
        "pending_tool_call": None,
        "current_tool_result": None,
        "current_tool_error": None,
        "action": None,
        "status": "ok",
        "messages": _append_message(
            state,
            "tool",
            _to_json_text(current_tool_result["result"]),
            name=current_tool_result["name"],
            kind="observation",
        ),
    }


def synthesize_response(state: ToolUseState) -> dict[str, Any]:
    direct_answer = _string_or_none(state.get("direct_answer"))
    tool_results = state.get("tool_results", [])
    tool_errors = state.get("tool_errors", [])

    if direct_answer:
        final_output = direct_answer
        status = "ok"
    elif tool_errors:
        last_error = tool_errors[-1]
        final_output = (
            "I could not complete the request with the available tools. "
            f"Reason: {last_error.get('message', 'tool use failed')}"
        )
        status = "failed"
    elif tool_results:
        final_output = _format_observation_summary(tool_results)
        status = "ok"
    else:
        final_output = (
            "I could not complete the request because no answer or tool "
            "observation was available."
        )
        status = "failed"

    return {
        "status": status,
        "final_output": final_output,
        "messages": _append_message(
            state,
            "assistant",
            final_output,
            kind="final_answer",
        ),
    }


def request_confirmation(state: ToolUseState) -> dict[str, Any]:
    pending_tool_call = state.get("pending_tool_call") or {}
    name = pending_tool_call.get("name", "unknown tool")
    arguments = pending_tool_call.get("arguments", {})
    final_output = (
        f"Confirmation required before executing {name} with arguments "
        f"{_to_json_text(arguments)}."
    )
    return {
        "status": "needs_confirmation",
        "requires_confirmation": True,
        "final_output": final_output,
        "messages": _append_message(
            state,
            "assistant",
            final_output,
            kind="confirmation_request",
        ),
    }


def handle_tool_error(state: ToolUseState) -> dict[str, Any]:
    current_tool_error = state.get("current_tool_error")
    if current_tool_error is None:
        current_tool_error = _tool_error(
            name=None,
            arguments={},
            message="Tool use failed without a structured error.",
            error_type="unknown_tool_error",
            attempted=False,
        )

    tool_errors = [*state.get("tool_errors", []), current_tool_error]
    updates: dict[str, Any] = {
        "tool_errors": tool_errors,
        "current_tool_error": None,
        "current_tool_result": None,
        "pending_tool_call": None,
        "status": "failed",
        "failure_reason": current_tool_error["message"],
        "requires_human_review": (
            state.get("requires_human_review", False)
            or current_tool_error.get("error_type") == "tool_call_limit"
        ),
        "messages": _append_message(
            state,
            "tool",
            current_tool_error["message"],
            name=current_tool_error.get("name"),
            kind="error",
        ),
    }

    if current_tool_error.get("attempted"):
        updates["tool_call_count"] = state.get("tool_call_count", 0) + 1

    return updates


def handle_failure(state: ToolUseState) -> dict[str, Any]:
    reason = state.get("failure_reason") or "Tool-use workflow failed."
    final_output = state.get("final_output") or f"Tool-use workflow failed: {reason}"
    return {
        "status": "failed",
        "final_output": final_output,
        "messages": _append_message(
            state,
            "assistant",
            final_output,
            kind="failure",
        ),
    }


def should_attempt_tool_error_recovery(state: ToolUseState) -> bool:
    metadata = state.get("metadata", {})
    max_recoveries = _coerce_non_negative_int(
        metadata.get("max_tool_error_recoveries", 0),
        0,
    )
    if not metadata.get("allow_tool_error_recovery", False):
        return False
    if state.get("requires_human_review", False):
        return False
    if len(state.get("tool_errors", [])) > max_recoveries:
        return False
    return state.get("tool_call_count", 0) < state.get(
        "max_tool_calls",
        DEFAULT_MAX_TOOL_CALLS,
    )


def _invoke_model(system_prompt: str, user_prompt: str) -> str:
    response = get_chat_model().invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    content = getattr(response, "content", response)
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content)


def _parse_model_decision(
    raw_decision: dict[str, Any] | str | None,
) -> tuple[dict[str, Any], str | None]:
    if isinstance(raw_decision, dict):
        return raw_decision, None

    if raw_decision is None:
        return {}, "Model did not return a decision."

    candidate = _strip_code_fence(str(raw_decision))
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return {}, f"Model decision must be JSON: {exc.msg}."

    if not isinstance(parsed, dict):
        return {}, "Model decision must be a JSON object."

    return parsed, None


def _extract_tool_call(parsed: dict[str, Any]) -> tuple[ToolCall, str | None]:
    raw_call = (
        parsed.get("tool_call")
        or parsed.get("function_call")
        or parsed.get("call")
    )
    if raw_call is None and "name" in parsed:
        raw_call = parsed

    if not isinstance(raw_call, dict):
        return {}, "Tool-call decisions must include a structured tool_call object."

    name = _string_or_none(
        raw_call.get("name")
        if "name" in raw_call
        else raw_call.get("tool_name", raw_call.get("tool"))
    )
    if not name:
        return {}, "Tool-call decisions must include a tool name."

    arguments = raw_call.get("arguments", raw_call.get("args", {}))
    if isinstance(arguments, str):
        try:
            parsed_arguments = json.loads(arguments)
        except json.JSONDecodeError:
            return {}, "Tool-call arguments must be a JSON object."
        arguments = parsed_arguments

    if arguments is None:
        arguments = {}

    if not isinstance(arguments, dict):
        return {}, "Tool-call arguments must be a JSON object."

    return {"name": name, "arguments": dict(arguments)}, None


def _model_decision_failure(state: ToolUseState, message: str) -> dict[str, Any]:
    return {
        "status": "failed",
        "action": "failure",
        "failure_reason": message,
        "current_tool_error": _tool_error(
            name=None,
            arguments={},
            message=message,
            error_type="model_decision",
            attempted=False,
        ),
        "messages": _append_message(
            state,
            "assistant",
            message,
            kind="model_decision_error",
        ),
    }


def _validate_arguments(spec: ToolSpec, arguments: dict[str, Any]) -> str | None:
    required_names = set(spec.required_arguments)
    provided_names = set(arguments)
    missing = sorted(required_names - provided_names)
    extra = sorted(provided_names - required_names)
    if missing:
        return "Missing required tool arguments: " + ", ".join(missing) + "."
    if extra:
        return "Unsupported tool arguments: " + ", ".join(extra) + "."

    for name, expected_type in spec.required_arguments.items():
        value = arguments[name]
        if not isinstance(value, expected_type):
            return (
                f"Tool argument {name!r} must be "
                f"{expected_type.__name__}, got {type(value).__name__}."
            )
        if expected_type is str and not _normalize_text(value):
            return f"Tool argument {name!r} must not be empty."

    return None


def _tool_error(
    *,
    name: str | None,
    arguments: dict[str, Any],
    message: str,
    error_type: str,
    attempted: bool,
) -> ToolError:
    return {
        "name": name,
        "arguments": dict(arguments),
        "message": message,
        "error_type": error_type,
        "status": "error",
        "attempted": attempted,
    }


def _append_message(
    state: ToolUseState,
    role: str,
    content: str,
    *,
    name: str | None = None,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    message: dict[str, Any] = {"role": role, "content": content}
    if name:
        message["name"] = name
    if kind:
        message["kind"] = kind
    return [*state.get("messages", []), message]


def _format_tool_definitions(state: ToolUseState) -> str:
    available_tools = state.get("available_tools") or sorted(TOOL_REGISTRY)
    definitions = []
    for name in available_tools:
        spec = TOOL_REGISTRY.get(name)
        if spec is None:
            continue
        definitions.append(
            {
                "name": spec.name,
                "description": spec.description,
                "required_arguments": {
                    arg_name: arg_type.__name__
                    for arg_name, arg_type in spec.required_arguments.items()
                },
                "requires_confirmation": spec.requires_confirmation,
            }
        )
    return _to_json_text(definitions)


def _format_observation_summary(tool_results: list[ToolResult]) -> str:
    lines = ["Tool observations:"]
    for result in tool_results:
        lines.append(f"- {result['name']}: {result['result']}")
    return "\n".join(lines)


def _to_json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        coerced = int(value)
    except (TypeError, ValueError):
        return default
    return max(0, coerced)


class _SafeArithmeticEvaluator:
    _binary_operators: dict[type[ast.operator], Callable[[float, float], float]] = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
    }
    _unary_operators: dict[type[ast.unaryop], Callable[[float], float]] = {
        ast.UAdd: operator.pos,
        ast.USub: operator.neg,
    }

    def evaluate(self, expression: str) -> float:
        normalized = _normalize_text(expression)
        if not normalized:
            raise ValueError("Expression is empty.")
        if len(normalized) > 200:
            raise ValueError("Expression is too long.")

        try:
            tree = ast.parse(normalized, mode="eval")
        except SyntaxError as exc:
            raise ValueError(f"Invalid arithmetic expression: {exc.msg}.") from exc

        return self._evaluate_node(tree.body)

    def _evaluate_node(self, node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)

        if isinstance(node, ast.BinOp):
            operator_type = type(node.op)
            if operator_type not in self._binary_operators:
                raise ValueError("Unsupported arithmetic operator.")
            left = self._evaluate_node(node.left)
            right = self._evaluate_node(node.right)
            return float(self._binary_operators[operator_type](left, right))

        if isinstance(node, ast.UnaryOp):
            operator_type = type(node.op)
            if operator_type not in self._unary_operators:
                raise ValueError("Unsupported arithmetic operator.")
            operand = self._evaluate_node(node.operand)
            return float(self._unary_operators[operator_type](operand))

        raise ValueError("Expression may contain only numbers and arithmetic operators.")
