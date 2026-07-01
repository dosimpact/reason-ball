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

