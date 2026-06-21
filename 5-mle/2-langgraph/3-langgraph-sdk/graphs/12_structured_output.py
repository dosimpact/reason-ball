"""Example 12: structured output extraction with validation metadata."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


Priority = Literal["low", "medium", "high"]
Team = Literal["product", "engineering", "support", "security", "operations"]
ValidationStatus = Literal["pending", "valid", "invalid"]


class ActionItem(BaseModel):
    """A concrete follow-up item extracted from the request."""

    owner: str = Field(description="Person or role responsible for the action.")
    task: str = Field(description="Concrete action that should be completed.")
    due: str = Field(description="Natural-language due date or timing.")


class LaunchBrief(BaseModel):
    """Structured launch-readiness brief for a product or operations request."""

    title: str = Field(description="Short descriptive title.")
    summary: str = Field(description="Two-sentence summary of the request.")
    priority: Priority = Field(description="Execution priority.")
    team: Team = Field(description="Primary owning team.")
    deadline: str = Field(description="Date, milestone, or timing mentioned by the request.")
    actions: list[ActionItem] = Field(description="Two to four concrete action items.", min_length=2)
    risks: list[str] = Field(description="One to three notable risks.", min_length=1)
    confidence: float = Field(description="Model confidence from 0.0 to 1.0.", ge=0.0, le=1.0)


class FieldRow(TypedDict):
    path: str
    label: str
    value: str
    value_type: str


class StructuredOutputState(TypedDict, total=False):
    request: str
    schema_name: str
    schema_json: dict[str, Any]
    raw_model_output: str
    parsed_object: dict[str, Any]
    validation_status: ValidationStatus
    validation_errors: list[str]
    field_rows: list[FieldRow]
    final: str
    trace: list[dict[str, Any]]


DEFAULT_REQUEST = (
    "Extract a launch-readiness brief from this note: The LangGraph SDK learning "
    "workspace should ship a structured-output demo by Friday. Product owns the "
    "release checklist, engineering must verify schema validation, support needs "
    "a short troubleshooting note, and the main risk is confusing raw JSON with "
    "validated fields."
)


def _stringify(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(_stringify(item) for item in value)
    if isinstance(value, dict):
        return ", ".join(f"{key}: {_stringify(item)}" for key, item in value.items())
    return str(value)


def _field_rows(parsed: dict[str, Any]) -> list[FieldRow]:
    rows: list[FieldRow] = []
    for key, value in parsed.items():
        if key == "actions" and isinstance(value, list):
            for index, action in enumerate(value, start=1):
                if isinstance(action, dict):
                    for field, field_value in action.items():
                        rows.append(
                            {
                                "path": f"actions[{index - 1}].{field}",
                                "label": f"Action {index} {field.replace('_', ' ').title()}",
                                "value": _stringify(field_value),
                                "value_type": type(field_value).__name__,
                            }
                        )
                else:
                    rows.append(
                        {
                            "path": f"actions[{index - 1}]",
                            "label": f"Action {index}",
                            "value": _stringify(action),
                            "value_type": type(action).__name__,
                        }
                    )
            continue

        rows.append(
            {
                "path": key,
                "label": key.replace("_", " ").title(),
                "value": _stringify(value),
                "value_type": "array" if isinstance(value, list) else type(value).__name__,
            }
        )
    return rows


def prepare_schema(state: StructuredOutputState) -> dict:
    request = state.get("request", DEFAULT_REQUEST)
    return {
        "request": request,
        "schema_name": "LaunchBrief",
        "schema_json": LaunchBrief.model_json_schema(),
        "validation_status": "pending",
        "validation_errors": [],
        "trace": [
            {
                "node": "prepare_schema",
                "event": "schema_ready",
                "schema": "LaunchBrief",
            }
        ],
    }


def extract_structured(state: StructuredOutputState) -> dict:
    structured_llm = create_llm("fast").with_structured_output(LaunchBrief)
    request = state.get("request", DEFAULT_REQUEST)
    try:
        result: LaunchBrief = structured_llm.invoke(
            [
                SystemMessage(
                    content=(
                        "Extract a structured launch brief from the user's note. "
                        "Use only the requested schema fields. Keep each action concrete, "
                        "assign realistic owners from the note when possible, and set "
                        "confidence based on how explicit the input is."
                    )
                ),
                HumanMessage(content=request),
            ]
        )
        parsed = result.model_dump()
        return {
            "parsed_object": parsed,
            "raw_model_output": result.model_dump_json(indent=2),
            "trace": state.get("trace", [])
            + [
                {
                    "node": "extract_structured",
                    "event": "parsed",
                    "field_count": len(parsed),
                }
            ],
        }
    except Exception as exc:  # pragma: no cover - provider failures are environment dependent
        return {
            "parsed_object": {},
            "raw_model_output": str(exc),
            "validation_status": "invalid",
            "validation_errors": [f"Structured output call failed: {exc}"],
            "trace": state.get("trace", [])
            + [
                {
                    "node": "extract_structured",
                    "event": "failed",
                    "error": str(exc),
                }
            ],
        }


def validate_result(state: StructuredOutputState) -> dict:
    parsed = state.get("parsed_object", {})
    errors = list(state.get("validation_errors", []))

    if not parsed:
        errors.append("No parsed object was produced.")
    else:
        for field in ("title", "summary", "priority", "team", "deadline"):
            if not str(parsed.get(field, "")).strip():
                errors.append(f"`{field}` is required.")

        actions = parsed.get("actions")
        if not isinstance(actions, list) or len(actions) < 2:
            errors.append("At least two action items are required.")
        else:
            for index, action in enumerate(actions, start=1):
                if not isinstance(action, dict):
                    errors.append(f"Action {index} must be an object.")
                    continue
                for field in ("owner", "task", "due"):
                    if not str(action.get(field, "")).strip():
                        errors.append(f"Action {index} is missing `{field}`.")

        risks = parsed.get("risks")
        if not isinstance(risks, list) or len(risks) == 0:
            errors.append("At least one risk is required.")

        confidence = parsed.get("confidence")
        if not isinstance(confidence, (float, int)) or not 0 <= float(confidence) <= 1:
            errors.append("Confidence must be between 0.0 and 1.0.")

    rows = _field_rows(parsed)
    status: ValidationStatus = "invalid" if errors else "valid"
    return {
        "validation_status": status,
        "validation_errors": errors,
        "field_rows": rows,
        "trace": state.get("trace", [])
        + [
            {
                "node": "validate_result",
                "event": status,
                "error_count": len(errors),
                "row_count": len(rows),
            }
        ],
    }


def finalize(state: StructuredOutputState) -> dict:
    status = state.get("validation_status", "invalid")
    parsed = state.get("parsed_object", {})
    title = parsed.get("title", "Structured output")
    action_count = len(parsed.get("actions", [])) if isinstance(parsed.get("actions"), list) else 0
    return {
        "final": f"{title}: validation {status}; {action_count} action items extracted.",
        "trace": state.get("trace", [])
        + [
            {
                "node": "finalize",
                "event": "complete",
                "validation_status": status,
                "action_count": action_count,
            }
        ],
    }


def build_graph():
    builder = StateGraph(StructuredOutputState)
    builder.add_node("prepare_schema", prepare_schema)
    builder.add_node("extract_structured", extract_structured)
    builder.add_node("validate_result", validate_result)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "prepare_schema")
    builder.add_edge("prepare_schema", "extract_structured")
    builder.add_edge("extract_structured", "validate_result")
    builder.add_edge("validate_result", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"request": DEFAULT_REQUEST})
    print(output["final"])
