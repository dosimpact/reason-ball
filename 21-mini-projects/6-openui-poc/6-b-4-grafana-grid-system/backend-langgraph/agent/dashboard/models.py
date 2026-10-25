"""브라우저와 에이전트가 공유하는 패널 명령 계약."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: int = Field(default=0, ge=0, le=23)
    y: int = Field(default=0, ge=0, le=10000)
    w: int = Field(default=12, ge=4, le=24)
    h: int = Field(default=12, ge=4, le=40)


class RefreshPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["live", "snapshot"] = "live"
    interval_seconds: Literal[0, 60, 300, 900] = 0
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    error: str | None = None


class Panel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=150)
    kind: Literal["openui", "financial"] = "openui"
    tab_id: str = "main"
    layout: Layout = Field(default_factory=Layout)
    pinned: bool = False
    refresh: RefreshPolicy = Field(default_factory=RefreshPolicy)
    program: str = Field(default="", max_length=120000)
    ui_state: dict = Field(default_factory=dict)
    source_artifact_id: str | None = None
    query: dict = Field(default_factory=dict)
    data: dict = Field(default_factory=dict)
    sources: list[dict] = Field(default_factory=list, max_length=100)


class DashboardCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: str = Field(min_length=1, max_length=100)
    base_revision: int = Field(ge=0)
    action: Literal[
        "add",
        "update",
        "remove",
        "layout",
        "pin",
        "select",
        "tab_add",
        "tab_select",
        "tab_remove",
        "tab_rename",
        "artifact_add",
        "ui_state",
        "export",
        "import",
        "refresh",
        "refresh_policy",
        "refresh_result",
    ]
    panel_id: str | None = None
    payload: dict = Field(default_factory=dict)
