"""Server-calculated values. The model chooses a layout, never recalculates data."""
from __future__ import annotations

import re
from collections import defaultdict

from .contract import ContractError
from .data import SALES


def build_facts() -> dict:
    revenue = sum(row["revenue"] for row in SALES)
    quota = sum(row["quota"] for row in SALES)
    regions = defaultdict(int)
    months = defaultdict(int)
    team = {}
    accounts = {}
    for index, row in enumerate(SALES):
        regions[row["region"]] += row["revenue"]
        months[row["month"]] += row["revenue"]
        rep = team.setdefault(row["rep"], {"rep": row["rep"], "revenue": 0, "quota": 0, "accounts": 0})
        for field in ("revenue", "quota"):
            rep[field] += row[field]
        rep["accounts"] += 1
        accounts[f"account{index}"] = {
            **row, "revenue": f"${row['revenue']:,}", "quota": f"${row['quota']:,}",
            "attainment": f"{row['revenue'] / row['quota'] * 100:.1f}%",
            "risk": "주의" if row["risk"] == "at-risk" else "정상",
        }
    risk_count = sum(row["risk"] == "at-risk" for row in SALES)
    return {
        "summary": {"revenue": f"${revenue:,}", "quota": f"${quota:,}", "attainment": f"{revenue / quota * 100:.1f}%", "accounts": str(len(SALES)), "atRisk": str(risk_count)},
        "series": {
            "regions": [{"label": {"seoul": "서울", "busan": "부산"}[key], "value": value} for key, value in regions.items()],
            "months": [{"label": key, "value": value} for key, value in sorted(months.items())],
            "team": [{"label": key, "value": value["revenue"]} for key, value in team.items()],
            "risk": [{"label": "정상", "value": len(SALES) - risk_count}, {"label": "주의", "value": risk_count}],
        },
        "tables": {"team": list(team.values()), "accounts": SALES},
        "accounts": accounts,
    }


FACTS = build_facts()


def resolve_fact(path: str):
    if not path.startswith("/facts/"):
        raise ContractError("Generated bindings must reference /facts/")
    value = FACTS
    for key in path.removeprefix("/facts/").split("/"):
        if not isinstance(value, dict) or key not in value:
            raise ContractError(f"Unknown sales fact: {path}")
        value = value[key]
    return value


def validate_fact_bindings(operations: list[dict]) -> None:
    """Reject invented numeric literals before they enter a rendered surface."""
    for operation in operations:
        for component in operation.get("updateComponents", {}).get("components", []):
            kind = component["component"]
            required_binding = {"Metric": "value", "InfoRow": "value", "Chart": "data", "Table": "rows"}.get(kind)
            if required_binding:
                binding = component.get(required_binding)
                if not isinstance(binding, dict) or set(binding) != {"path"}:
                    raise ContractError(f"{kind}.{required_binding} must bind to a server /facts/ path")
                value = resolve_fact(binding["path"])
                if kind == "Chart" and (not isinstance(value, list) or any(set(row) != {"label", "value"} for row in value)):
                    raise ContractError("Chart data must bind to a /facts/series/ path")
                if kind == "Table":
                    keys = {column["key"] for column in component["columns"]}
                    if not isinstance(value, list) or any(not keys <= set(row) for row in value):
                        raise ContractError("Table column keys must exist in the bound server rows")
                if kind in {"Metric", "InfoRow"} and not isinstance(value, str):
                    raise ContractError("Display value must bind to a string fact")
            for key, value in component.items():
                if key in {"id", "child", "children", "component"}:
                    continue
                if isinstance(value, dict) and "path" in value:
                    resolve_fact(value["path"])
                elif isinstance(value, str) and re.search(r"\d", value):
                    raise ContractError(f"Numeric display literals are forbidden: bind {kind}.{key} to /facts/")
