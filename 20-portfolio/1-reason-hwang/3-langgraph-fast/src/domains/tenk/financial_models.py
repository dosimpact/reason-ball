"""Model output contains source references; server-owned datasets contain numbers."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SectionSelection(StrictModel):
    section_ids: list[str] = Field(max_length=4)
    index_offset: int | None = Field(default=None, ge=0)


class TableSelection(StrictModel):
    table_ids: list[str] = Field(max_length=8)
    index_offset: int | None = Field(default=None, ge=0)


class Period(StrictModel):
    id: str = Field(max_length=80)
    label: str = Field(max_length=100)
    kind: Literal["instant", "duration"]
    start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    duration_class: Literal["annual", "quarter", "ytd", "other"]


class CellObservation(StrictModel):
    metric_id: str = Field(max_length=80)
    label: str = Field(max_length=150)
    statement: Literal["income", "balance", "cashflow", "note"]
    scope: Literal["consolidated", "parent", "segment", "other"]
    period: Period
    table_id: str
    value_cell: str
    label_cells: list[str] = Field(min_length=1, max_length=8)
    period_cells: list[str] = Field(min_length=1, max_length=8)
    unit_text: str = Field(max_length=300)
    dimension: Literal["money", "shares", "money_per_share", "percent", "count"]
    currency: str | None = None
    scale: Literal["1", "1000", "1000000", "1000000000"]
    # Optional, source-backed whole/parts relationship; no inferred additive group.
    composition: str | None = Field(default=None, max_length=100)
    is_total: bool = False


class ExtractionProposal(StrictModel):
    observations: list[CellObservation] = Field(max_length=360)
    missing: list[str] = Field(max_length=30)
    additional_table_ids: list[str] = Field(max_length=8)


class ChartBlock(StrictModel):
    type: Literal["chart", "table", "metric"]
    kind: Literal["bar", "grouped_bar", "stacked_bar", "line", "area", "donut"] | None = None
    metric_ids: list[str] = Field(min_length=1, max_length=30)
    period_ids: list[str] = Field(min_length=1, max_length=12)
    category: Literal["period", "metric"] = "period"
    title: str = Field(default="", max_length=100)


class FinancialChartPlan(StrictModel):
    title: str = Field(min_length=1, max_length=100)
    columns: Literal[1, 2] = 1
    blocks: list[ChartBlock] = Field(min_length=1, max_length=8)
