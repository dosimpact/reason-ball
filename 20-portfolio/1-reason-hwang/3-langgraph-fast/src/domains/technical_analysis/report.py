"""Deterministic v1 indicator requests, aligned reports, and signals."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from domains.technical_analysis.models import (
    IndicatorName,
    IndicatorRequest,
    NumericParameter,
)


class AgentIndicator(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Literal["RSI", "SMA", "MACD"]
    timeperiod: int | None = Field(default=None, ge=2, le=200)
    fastperiod: int = Field(default=12, ge=2, le=200)
    slowperiod: int = Field(default=26, ge=3, le=200)
    signalperiod: int = Field(default=9, ge=2, le=200)

    @model_validator(mode="after")
    def validate_periods(self):
        if self.name == "MACD" and self.fastperiod >= self.slowperiod:
            raise ValueError("MACD fastperiod must be less than slowperiod")
        if self.name == "MACD" and self.timeperiod is not None:
            raise ValueError("MACD uses fastperiod, slowperiod and signalperiod")
        return self

    def request(self) -> IndicatorRequest:
        parameters: dict[str, NumericParameter] = (
            {
                "fastperiod": self.fastperiod,
                "slowperiod": self.slowperiod,
                "signalperiod": self.signalperiod,
            }
            if self.name == "MACD"
            else {"timeperiod": self.timeperiod or (14 if self.name == "RSI" else 20)}
        )
        return IndicatorRequest(name=IndicatorName(self.name), parameters=parameters)

    def lookback(self) -> int:
        if self.name == "MACD":
            return self.slowperiod + self.signalperiod - 2
        return self.timeperiod or (14 if self.name == "RSI" else 20)


def default_indicators() -> list[AgentIndicator]:
    return [AgentIndicator(name=name) for name in ("RSI", "SMA", "MACD")]


def warmup_count(indicators: list[AgentIndicator]) -> int:
    return max(250, 5 * max(item.lookback() for item in indicators))


def crossing(previous: float | None, current: float | None) -> str:
    if previous is None or current is None:
        return "판단 불가"
    if previous <= 0 < current:
        return "상향 교차"
    if previous >= 0 > current:
        return "하향 교차"
    return "교차 없음"


def indicator_signal(name: str, series: dict, closes: list[float]) -> dict:
    def tail(key):
        values = series.get(key, [])
        return values[-1] if values else None

    if name == "RSI":
        value = tail("rsi")
        label = (
            "판단 불가"
            if value is None
            else "과매수"
            if value >= 70
            else "과매도"
            if value <= 30
            else "중립"
        )
        return {"state": label, "rsi": value, "lower": 30, "upper": 70}
    key = "sma" if name == "SMA" else "macd"
    values = series.get(key, [])
    reference = closes if name == "SMA" else series.get("signal", [])
    if (
        len(values) < 2
        or len(reference) < 2
        or any(v is None for v in [*values[-2:], *reference[-2:]])
    ):
        return {"state": "판단 불가", "cross": "판단 불가"}
    # SMA: close minus SMA; MACD: MACD minus signal.
    differences = [
        reference[i] - values[i] if name == "SMA" else values[i] - reference[i]
        for i in (-2, -1)
    ]
    return {
        "state": "위"
        if differences[-1] > 0
        else "아래"
        if differences[-1] < 0
        else "동일",
        "cross": crossing(*differences),
        "previous_difference": differences[0],
        "difference": differences[1],
        **(
            {"close": closes[-1], "sma": values[-1]}
            if name == "SMA"
            else {
                "macd": values[-1],
                "signal": reference[-1],
                "histogram": tail("histogram"),
            }
        ),
    }
