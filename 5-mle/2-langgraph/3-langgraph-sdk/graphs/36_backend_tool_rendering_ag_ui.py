"""Example 36: CopilotKit AG-UI backend tool rendering graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


INVENTORY_ROWS = [
    {
        "sku": "LG-AX-10",
        "name": "LangGraph Atlas Kit",
        "warehouse": "north",
        "available": 42,
        "reserved": 8,
        "status": "ready",
    },
    {
        "sku": "CP-UI-22",
        "name": "Copilot UI Harness",
        "warehouse": "north",
        "available": 16,
        "reserved": 3,
        "status": "ready",
    },
    {
        "sku": "AG-RN-04",
        "name": "AG-UI Renderer Pack",
        "warehouse": "west",
        "available": 7,
        "reserved": 5,
        "status": "low",
    },
]


@tool("search_inventory")
def search_inventory(query: str, warehouse: str = "north") -> dict[str, Any]:
    """Search deterministic demo inventory for backend tool rendering."""

    normalized_query = query.lower().strip()
    normalized_warehouse = warehouse.lower().strip()
    rows = [
        row
        for row in INVENTORY_ROWS
        if (
            normalized_warehouse in {"all", row["warehouse"]}
            and (
                normalized_query in row["name"].lower()
                or normalized_query in row["sku"].lower()
                or normalized_query in row["status"].lower()
                or normalized_query in {"inventory", "stock", "demo", "available"}
            )
        )
    ]

    total_available = sum(int(row["available"]) for row in rows)
    total_reserved = sum(int(row["reserved"]) for row in rows)
    status = "empty" if not rows else "attention" if any(row["status"] == "low" for row in rows) else "ready"

    return {
        "title": "Inventory lookup",
        "status": status,
        "summary": (
            f"Found {len(rows)} matching item(s) for {query!r} "
            f"in {normalized_warehouse or 'north'} warehouse scope."
        ),
        "metrics": [
            {"label": "Matches", "value": len(rows)},
            {"label": "Available", "value": total_available},
            {"label": "Reserved", "value": total_reserved},
        ],
        "rows": rows,
    }


SYSTEM_PROMPT = (
    "You are the backend tool rendering demo agent. When the user asks about "
    "inventory, stock, availability, warehouses, or demo items, always call "
    "search_inventory. After the tool result, summarize the top match in one "
    "short sentence. For unrelated questions, answer briefly without using a tool."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[search_inventory],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
