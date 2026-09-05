from __future__ import annotations

import math
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class IndicatorCategory(StrEnum):
    OVERLAP_STUDIES = "overlap_studies"
    MOMENTUM_INDICATORS = "momentum_indicators"
    VOLATILITY_INDICATORS = "volatility_indicators"
    VOLUME_INDICATORS = "volume_indicators"


class IndicatorName(StrEnum):
    SMA = "SMA"
    EMA = "EMA"
    BBANDS = "BBANDS"
    RSI = "RSI"
    MACD = "MACD"
    ADX = "ADX"
    ATR = "ATR"
    OBV = "OBV"


NumericParameter = int | float


class IndicatorRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: IndicatorName
    parameters: dict[str, NumericParameter] = Field(default_factory=dict)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value

    @field_validator("parameters")
    @classmethod
    def validate_parameters(
        cls,
        parameters: dict[str, NumericParameter],
    ) -> dict[str, NumericParameter]:
        for name, value in parameters.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise TypeError(f"parameter {name} must be numeric")
            if not math.isfinite(float(value)):
                raise ValueError(f"parameter {name} must be finite")
        return parameters


class IndicatorOutcome(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: IndicatorName
    category: IndicatorCategory
    status: Literal["success", "error"]
    parameters: dict[str, NumericParameter] = Field(default_factory=dict)
    series: dict[str, tuple[float | None, ...]] = Field(default_factory=dict)
    latest: dict[str, float | None] = Field(default_factory=dict)
    error_code: str | None = None
    error_message: str | None = None

    @model_validator(mode="after")
    def validate_status_payload(self) -> IndicatorOutcome:
        if self.status == "success" and self.error_code is not None:
            raise ValueError("successful indicator outcome cannot contain an error code")
        if self.status == "error" and not self.error_code:
            raise ValueError("error indicator outcome requires an error code")
        return self


class AnalysisResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    symbol: str
    interval: str
    points: int
    indicators: tuple[IndicatorOutcome, ...]
    warnings: tuple[str, ...] = ()
