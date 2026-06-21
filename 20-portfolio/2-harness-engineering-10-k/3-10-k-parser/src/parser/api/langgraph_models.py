from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class CreateThreadRequest(BaseModel):
    assistant_id: str = Field(default="sec_filing_assistant_v1", alias="assistantId")
    thread_id: Optional[str] = Field(default=None, alias="threadId")

    model_config = {"populate_by_name": True}


class StreamRunRequest(BaseModel):
    chat_id: Optional[str] = Field(default=None, alias="chatId")
    user_id: Optional[str] = Field(default=None, alias="userId")
    message: Optional[str] = None
    messages: Optional[list[dict[str, Any]]] = None
    selected_filing: Optional[dict[str, Any]] = Field(default=None, alias="selectedFiling")
    company_query: Optional[str] = Field(default=None, alias="companyQuery")
    ticker: Optional[str] = None
    cik: Optional[str] = None
    accession_no: Optional[str] = Field(default=None, alias="accessionNo")
    filing_id: Optional[str] = Field(default=None, alias="filingId")

    model_config = {"populate_by_name": True}
