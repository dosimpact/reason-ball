from app.tools.analytics_data import get_products, get_sales_data, select_analytics_context


def test_sales_filter_by_region() -> None:
    rows = get_sales_data(region="North")

    assert rows
    assert {row["region"] for row in rows} == {"North"}


def test_products_filter_by_category() -> None:
    rows = get_products(category="Furniture")

    assert rows
    assert {row["category"] for row in rows} == {"Furniture"}


def test_selects_product_tool_from_prompt() -> None:
    tool_name, tool_input, rows = select_analytics_context("Show top furniture products")

    assert tool_name == "getProducts"
    assert tool_input == {"category": "Furniture"}
    assert rows
