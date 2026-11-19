"""Explicit BFF execution and self-contained analysis contracts."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    runId: str = Field(min_length=1, max_length=128)
    executionToken: str = Field(min_length=1)
    cik: str = Field(pattern=r"^\d{10}$")
    accessionNo: str = Field(pattern=r"^\d{10}-\d{2}-\d{6}$")
    sourceHtml: str | None = Field(default=None, max_length=33554432)
    sourceHash: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    inputGenerationId: str | None = None
    extractionModel: Literal["gpt-5.6-sol", "gpt-5.6-luna", "gpt-6-luna"] = "gpt-5.6-sol"

    @property
    def filing_id(self):
        return f"filing:{self.cik}:{self.accessionNo}"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=16000)
    filingIds: list[str] = Field(min_length=1, max_length=50)
    itemCodes: list[str] | None = None
    topK: int = Field(default=10, ge=1, le=50)


AnalysisCategory = Literal[
    "OPERATING_PERFORMANCE",
    "INVESTMENT_AND_RESTRUCTURING",
    "DEPENDENCIES_AND_COMMITMENTS",
    "CAPITAL_AND_SHAREHOLDER_RIGHTS",
    "LEGAL_REGULATORY_AND_INCIDENTS",
    "OTHER",
]


class FactsRequest(BaseModel):
    analysisCategory: AnalysisCategory | None = Field(
        default=None, description="Filter selected facts by their single analysis category."
    )
    filingIds: list[str] = Field(min_length=1, max_length=50)
    conceptQName: str | None = Field(
        default=None,
        description="Expanded QName {namespaceUri}localName, as returned by facts; not a namespace prefix such as us-gaap:Revenue.",
    )
    period: dict[str, str] | None = Field(
        default=None,
        description="Exact context period fields, such as startDate/endDate or instantDate, using ISO dates.",
    )
    dimensions: dict[str, str] | None = Field(
        default=None,
        description="Map expanded dimension QNames {namespaceUri}localName to returned expanded member QNames or typedValue strings.",
    )
    unit: str | None = Field(
        default=None,
        description='JSON string of the returned unit object with numerator and denominator arrays of expanded measure QNames. Not a currency shorthand such as USD. Measure order is immaterial; malformed JSON matches no facts.',
    )
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)
