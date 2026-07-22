"""Request and response models for the Assistants API."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.json_schema import SkipJsonSchema


class _RejectExplicitNulls(BaseModel):
    @model_validator(mode="after")
    def reject_explicit_nulls(self):
        null_fields = {
            field for field in self.model_fields_set if getattr(self, field) is None
        }
        if null_fields:
            fields = ", ".join(sorted(null_fields))
            raise ValueError(f"Fields may not be null: {fields}")
        return self


class Assistant(BaseModel):
    assistant_id: UUID
    graph_id: str
    config: dict[str, Any]
    context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any]
    version: int = 1
    name: str = "Untitled"
    description: str | None = None


class AssistantCreate(BaseModel):
    assistant_id: UUID | SkipJsonSchema[None] = None
    graph_id: str
    config: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    if_exists: Literal["raise", "do_nothing"] = "raise"
    name: str = "Untitled"
    description: str | None = None

    @model_validator(mode="after")
    def reject_null_assistant_id(self) -> "AssistantCreate":
        if "assistant_id" in self.model_fields_set and self.assistant_id is None:
            raise ValueError("Field may not be null: assistant_id")
        return self


class AssistantPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    graph_id: str | SkipJsonSchema[None] = None
    config: dict[str, Any] | SkipJsonSchema[None] = None
    context: dict[str, Any] | SkipJsonSchema[None] = None
    metadata: dict[str, Any] | SkipJsonSchema[None] = None
    name: str | SkipJsonSchema[None] = None
    description: str | SkipJsonSchema[None] = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "AssistantPatch":
        null_fields = {
            field
            for field in self.model_fields_set
            if getattr(self, field) is None
        }
        if null_fields:
            fields = ", ".join(sorted(null_fields))
            raise ValueError(f"Fields may not be null: {fields}")
        return self


class AssistantSearchRequest(_RejectExplicitNulls):
    metadata: dict[str, Any] | SkipJsonSchema[None] = None
    graph_id: str | SkipJsonSchema[None] = None
    name: str | SkipJsonSchema[None] = None
    limit: int = Field(default=10, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    sort_by: Literal[
        "assistant_id", "created_at", "updated_at", "name", "graph_id"
    ] | SkipJsonSchema[None] = None
    sort_order: Literal["asc", "desc"] | SkipJsonSchema[None] = None
    select: list[
        Literal[
            "assistant_id",
            "graph_id",
            "name",
            "description",
            "config",
            "context",
            "created_at",
            "updated_at",
            "metadata",
            "version",
        ]
    ] | SkipJsonSchema[None] = None


class AssistantCountRequest(_RejectExplicitNulls):
    metadata: dict[str, Any] | SkipJsonSchema[None] = None
    graph_id: str | SkipJsonSchema[None] = None
    name: str | SkipJsonSchema[None] = None


class AssistantVersionsSearchRequest(_RejectExplicitNulls):
    metadata: dict[str, Any] | SkipJsonSchema[None] = None
    limit: int = Field(default=10, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class GraphSchemaNoId(BaseModel):
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    state_schema: dict[str, Any]
    config_schema: dict[str, Any] = Field(default_factory=dict)
    context_schema: dict[str, Any] = Field(default_factory=dict)


class GraphSchema(GraphSchemaNoId):
    graph_id: str
