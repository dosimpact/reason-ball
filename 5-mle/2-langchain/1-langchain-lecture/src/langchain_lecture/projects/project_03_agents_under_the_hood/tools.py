"""에이전트 루프와 도구 호출이 내부적으로 어떻게 이어지는지 보여주는 예제입니다. 에이전트가 호출할 수 있는 도구 함수를 모아 둡니다."""

from __future__ import annotations

from langchain.tools import tool


CATALOG_PRICES = {"laptop": 1299.99, "headphones": 149.95, "keyboard": 89.50}
DISCOUNTS = {"bronze": 5, "silver": 12, "gold": 23}


@tool
def get_product_price(product: str) -> float:
    """Look up the price of a product in the catalog."""
    return CATALOG_PRICES.get(product.lower().strip(), 0)


@tool
def apply_discount(price: float, discount_tier: str) -> float:
    """Apply a discount tier to a price and return the final price."""
    percentage = DISCOUNTS.get(discount_tier.lower().strip(), 0)
    return round(float(price) * (1 - percentage / 100), 2)


def tool_registry():
    tools = [get_product_price, apply_discount]
    return {tool.name: tool for tool in tools}

