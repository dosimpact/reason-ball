"""토큰/비용 메트릭 헬퍼.

가격은 코드에 직접 박아두고, 실제 청구액과는 차이가 있을 수 있음을 README 에 명시.
"""
from __future__ import annotations

from typing import TypedDict


class MetricsRecord(TypedDict):
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


# Bedrock Anthropic 가격 (USD per 1,000 tokens). 정확한 청구액은 AWS 콘솔 기준.
# 출처: 작성 시점의 공개 가격표. 변경되면 이 값을 업데이트하면 끝.
PRICING: dict[str, dict[str, float]] = {
    "fast":  {"input": 0.001,  "output": 0.005},
    "default": {"input": 0.003,  "output": 0.015},
    "smart":   {"input": 0.015,  "output": 0.075},
}


def estimate_cost(model_alias: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICING.get(model_alias, PRICING["default"])
    return (input_tokens / 1000.0) * p["input"] + (output_tokens / 1000.0) * p["output"]


def merge_metrics(a: list[MetricsRecord], b: list[MetricsRecord]) -> list[MetricsRecord]:
    """state reducer 가 필요할 때 사용 (현재 그래프는 명시적 append 사용)."""
    return list(a) + list(b)


__all__ = ["MetricsRecord", "PRICING", "estimate_cost", "merge_metrics"]
