"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. 에이전트가 호출할 수 있는 도구 함수를 모아 둡니다."""

from __future__ import annotations

import ast
import operator
from typing import Any

from langchain_core.tools import tool


_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval_arithmetic(node: ast.AST) -> int | float:
    if isinstance(node, ast.Expression):
        return _eval_arithmetic(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
        return node.value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPERATORS:
        return _OPERATORS[type(node.op)](_eval_arithmetic(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
        return _OPERATORS[type(node.op)](
            _eval_arithmetic(node.left),
            _eval_arithmetic(node.right),
        )
    raise ValueError("Only numeric arithmetic expressions are allowed.")


@tool
def calculate(expression: str) -> str:
    """Evaluate a simple arithmetic expression without using Python eval."""
    tree = ast.parse(expression, mode="eval")
    result = _eval_arithmetic(tree)
    return f"{expression} = {result}"


@tool
def lookup_weather(city: str) -> str:
    """Return deterministic sample weather for a city."""
    samples = {
        "seoul": "Seoul: clear, 24C",
        "busan": "Busan: breezy, 22C",
        "san francisco": "San Francisco: foggy, 16C",
    }
    return samples.get(city.lower(), f"{city}: sample forecast unavailable")


@tool
def draft_file_write(filename: str, content: str) -> str:
    """Draft a file write action without touching the filesystem."""
    return f"Drafted file write to {filename}: {content}"


@tool
def send_email_draft(to: str, body: str) -> str:
    """Draft an email action without sending anything."""
    return f"Drafted email to {to}: {body}"


@tool
def prepare_payment(payee: str, amount: str) -> str:
    """Prepare a payment action without charging anyone."""
    return f"Prepared payment to {payee} for {amount}"


TOOLS = {
    "calculate": calculate,
    "lookup_weather": lookup_weather,
    "draft_file_write": draft_file_write,
    "send_email_draft": send_email_draft,
    "prepare_payment": prepare_payment,
}


def invoke_tool(tool_name: str, args: dict[str, Any]) -> str:
    return str(TOOLS[tool_name].invoke(args))
