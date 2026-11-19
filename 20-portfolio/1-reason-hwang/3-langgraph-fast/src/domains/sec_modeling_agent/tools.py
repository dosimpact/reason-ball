"""Typed SEC modeling administration through the durable BFF boundary."""

import asyncio
import json
from typing import Literal
from uuid import UUID, uuid4

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from domains.sec_tools.modeling import build_sec_modeling_tools
from domains.sec_tools.tools import SecBffClient, build_sec_tools, compact
from domains.tenk.sec_client import SecReadError


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FilingInput(Input):
    cik: str = Field(pattern=r"^\d{10}$")
    accessionNo: str = Field(pattern=r"^\d{10}-\d{2}-\d{6}$")

    @field_validator("cik", mode="before")
    @classmethod
    def normalize_cik(cls, value):
        if (
            isinstance(value, str)
            and value.isascii()
            and value.isdigit()
            and 1 <= len(value) <= 10
        ):
            return value.zfill(10)
        return value


class ResultsInput(FilingInput):
    stage: Literal[1, 2, 3]
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=1000000)


class StartInput(FilingInput):
    stage: Literal[1, 2, 3]
    extractionModel: Literal["gpt-5.6-sol", "gpt-5.6-luna"] = Field(
        default="gpt-5.6-sol",
        description="Models 1/2 only; model 3 always uses direct Decisions gpt-6-luna.",
    )


class RunInput(Input):
    runId: UUID


class RunsInput(FilingInput):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=1000000)


def build_sec_modeling_test_tools(client=None, activity=None):
    client = client or SecBffClient()

    def make(name, schema, description, operation):
        async def execute(**kwargs):
            args = schema(**kwargs).model_dump(mode="json", exclude_none=True)
            identity = str(uuid4())

            def emit(status):
                if activity:
                    activity(
                        {
                            "id": identity,
                            "label": f"SEC 모델링 도구 · {name}",
                            "status": status,
                            "kind": "node",
                        }
                    )

            emit("running")
            try:
                method, path, params, body = operation(args)
                result = await client.request(method, path, params=params, body=body)
                emit("completed")
                return json.dumps(compact(result), ensure_ascii=False), {
                    "tool": name,
                    "args": args,
                    "result": result,
                }
            except asyncio.CancelledError:
                emit("cancelled")
                raise
            except Exception as error:
                emit("failed")
                # Provider responses, connection URLs and credentials never become model-visible errors.
                raise SecReadError(
                    "SEC modeling request failed; results are unavailable. Check service and run status."
                ) from error

        return StructuredTool.from_function(
            coroutine=execute,
            name=name,
            args_schema=schema,
            description=description,
            response_format="content_and_artifact",
        )

    def filing_path(args):
        return f"modeling/filings/{args['cik']}/{args['accessionNo']}"

    lookup = [
        tool
        for tool in build_sec_tools(client, activity, allow_sync=False)
        if tool.name in {"search_sec_companies", "list_sec_filings"}
    ]
    return [
        *lookup,
        *build_sec_modeling_tools(client),
        make(
            "get_sec_modeling_status",
            FilingInput,
            "Read actual published model 1/2/3 generation status for an exact filing. Empty stages mean no published result, not a successful run. Never infer graph readiness from historical SUCCEEDED runs.",
            lambda a: ("GET", filing_path(a) + "/status", None, None),
        ),
        make(
            "get_sec_modeling_results",
            ResultsInput,
            "Read published results for model 1 (Items), 2 (lexical knowledge), or 3 (selected XBRL facts). Preserve provenance, dimensions, units, classification and probabilities. Empty results are not evidence that a fact is absent from SEC.",
            lambda a: (
                "GET",
                filing_path(a) + f"/results/{a['stage']}",
                {"limit": a["limit"], "offset": a["offset"]},
                None,
            ),
        ),
        make(
            "list_sec_modeling_runs",
            RunsInput,
            "Read durable BFF modeling run history for one exact filing, newest first. Run completion and active graph publication are different states.",
            lambda a: ("GET", "modeling/runs", a, None),
        ),
        make(
            "get_sec_modeling_run",
            RunInput,
            "Read one durable BFF run by returned UUID, including work units, status and errors. Use to monitor a requested execution; do not invent completion.",
            lambda a: ("GET", f"modeling/runs/{a['runId']}", None, None),
        ),
        make(
            "start_sec_modeling",
            StartInput,
            "MUTATION: Start a durable BFF modeling run ONLY when the user explicitly requests execution for this filing/stage. Analysis or status requests alone do not authorize execution. Models 1/2 support 10-K/10-K/A; model 2 needs current model 1. Model 3 supports 10-K/10-Q and always uses direct OpenAI Decisions gpt-6-luna. Return queued runId and monitor it; acceptance is not success. Never provide HTML or execution tokens.",
            lambda a: (
                "POST",
                filing_path(a) + f"/model-{a['stage']}/runs",
                None,
                {
                    "extractionModel": "gpt-6-luna"
                    if a["stage"] == 3
                    else a["extractionModel"]
                },
            ),
        ),
        make(
            "cancel_sec_modeling_run",
            RunInput,
            "MUTATION: Request cancellation through the durable BFF ONLY when the user explicitly asks to cancel this run. Use an actual returned run UUID and report server status; cancellation may be asynchronous.",
            lambda a: ("POST", f"modeling/runs/{a['runId']}/cancel", None, {}),
        ),
        make(
            "retry_sec_modeling_run",
            RunInput,
            "MUTATION: Retry a failed or cancelled durable BFF run ONLY when the user explicitly requests retry. Creates a new run; preserve the old run history and report the returned new runId.",
            lambda a: ("POST", f"modeling/runs/{a['runId']}/retry", None, {}),
        ),
    ]
