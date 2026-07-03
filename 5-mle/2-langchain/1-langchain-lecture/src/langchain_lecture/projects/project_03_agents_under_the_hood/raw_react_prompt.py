"""에이전트 루프와 도구 호출이 내부적으로 어떻게 이어지는지 보여주는 예제입니다. ReAct 형식의 도구 설명, 액션 파싱, 최종 답변 파싱을 보여줍니다."""

from __future__ import annotations

import inspect
import re
from collections.abc import Callable

from langchain_lecture.projects.project_03_agents_under_the_hood.tools import (
    apply_discount,
    get_product_price,
)


TOOLS: dict[str, Callable[..., object]] = {
    "get_product_price": get_product_price.func,
    "apply_discount": apply_discount.func,
}


def build_tool_descriptions(tools: dict[str, Callable[..., object]] = TOOLS) -> str:
    descriptions = []
    for name, func in tools.items():
        descriptions.append(f"{name}{inspect.signature(func)} - {inspect.getdoc(func)}")
    return "\n".join(descriptions)


def parse_react_action(output: str) -> tuple[str, list[str]] | None:
    action_match = re.search(r"Action:\s*(.+)", output)
    input_match = re.search(r"Action Input:\s*(.+)", output)
    if not action_match or not input_match:
        return None
    args = [
        part.split("=", 1)[-1].strip().strip("'\"")
        for part in input_match.group(1).split(",")
    ]
    return action_match.group(1).strip(), args


def parse_final_answer(output: str) -> str | None:
    match = re.search(r"Final Answer:\s*(.+)", output)
    return match.group(1).strip() if match else None

