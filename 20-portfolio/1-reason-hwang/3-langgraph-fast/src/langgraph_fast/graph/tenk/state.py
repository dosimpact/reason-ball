from typing import Any, TypedDict


class TenkGraphState(TypedDict):
    query: str
    selected_filing: dict[str, Any] | None
    intent: str
    answer: str
    evidence: list[dict[str, Any]]
