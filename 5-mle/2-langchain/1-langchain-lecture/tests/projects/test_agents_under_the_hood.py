from __future__ import annotations

from langchain_lecture.projects.project_03_agents_under_the_hood.raw_react_prompt import (
    build_tool_descriptions,
    parse_final_answer,
    parse_react_action,
)
from langchain_lecture.projects.project_03_agents_under_the_hood.tools import (
    apply_discount,
    get_product_price,
)


def test_catalog_tools_are_deterministic():
    assert get_product_price.invoke({"product": "laptop"}) == 1299.99
    assert apply_discount.invoke({"price": 100, "discount_tier": "gold"}) == 77


def test_raw_react_parsers():
    output = "Thought: use a tool\nAction: get_product_price\nAction Input: product=laptop"
    assert parse_react_action(output) == ("get_product_price", ["laptop"])
    assert parse_final_answer("Final Answer: 42") == "42"
    assert "get_product_price" in build_tool_descriptions()

