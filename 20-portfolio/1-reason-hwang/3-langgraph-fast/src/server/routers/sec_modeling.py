import hmac
import json
import os
from contextlib import contextmanager

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from domains.sec_modeling import runtime, search
from domains.sec_modeling.contracts import FactsRequest, ModelingRequest, SearchRequest
from domains.sec_modeling.store import GraphStore


def authenticate(x_sec_modeling_key: str = Header(default="")):
    expected = os.getenv("SEC_MODELING_KEY", "")
    if not expected:
        raise HTTPException(503, "SEC_MODELING_KEY is not configured")
    if not hmac.compare_digest(expected, x_sec_modeling_key):
        raise HTTPException(401, "Invalid service key")


router = APIRouter(dependencies=[Depends(authenticate)])


@contextmanager
def store():
    graph = GraphStore()
    try:
        yield graph
    finally:
        graph.close()


@router.post("/internal/sec-modeling/model-{stage}/runs")
async def create_run(stage: int, body: ModelingRequest):
    if stage not in (1, 2, 3):
        raise HTTPException(404, "Unknown modeling stage")
    try:
        queue = runtime.launch(stage, body)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error

    async def stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield json.dumps(event) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@router.get("/internal/sec-modeling/runs/{run_id}")
def run_status(run_id: str):
    with store() as graph:
        state = graph.run_state(run_id)
        return {k: v for k, v in state.items() if k != "executionToken"}


class CancelRequest(BaseModel):
    executionToken: str


@router.post("/internal/sec-modeling/runs/{run_id}/cancel")
def cancel_run(run_id: str, body: CancelRequest):
    try:
        runtime.cancel(run_id, body.executionToken)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    return {"accepted": True}


class FilingStatusIdentity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cik: str = Field(pattern=r"^\d{10}$")
    accessionNo: str = Field(pattern=r"^\d{10}-\d{2}-\d{6}$")


class FilingStatusesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    filings: list[FilingStatusIdentity] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def distinct(self):
        if len({(f.cik, f.accessionNo) for f in self.filings}) != len(self.filings):
            raise ValueError("Duplicate filing identities")
        return self


@router.post("/internal/sec-modeling/filings/status")
def filing_statuses(body: FilingStatusesRequest):
    with store() as graph:
        return {"items": graph.active_many([f.model_dump() for f in body.filings])}


@router.get("/internal/sec-modeling/filings/{cik}/{accession}/status")
def filing_status(cik: str, accession: str):
    with store() as graph:
        stages = {}
        for stage in (1, 2, 3):
            active = graph.active(f"filing:{cik}:{accession}", stage)
            if active:
                stages[str(stage)] = {**active, "generationId": active["id"]}
        return {"stages": stages}


@router.get("/internal/sec-modeling/filings/{cik}/{accession}/results/{stage}")
def results(
    cik: str,
    accession: str,
    stage: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    with store() as graph:
        active = graph.active(f"filing:{cik}:{accession}", stage)
        rows = graph.records(active["id"]) if active else []
        return {
            "stage": stage,
            "generationId": active["id"] if active else None,
            "items": rows[offset : offset + limit],
            "total": len(rows),
            "offset": offset,
            "limit": limit,
        }


@router.post("/api/sec-analysis/search")
def search_evidence(body: SearchRequest):
    with store() as graph:
        return search.search(body, graph)


@router.post("/api/sec-analysis/facts/query")
def search_facts(body: FactsRequest):
    with store() as graph:
        return search.facts(body, graph)


@router.get("/api/sec-analysis/evidence/{evidence_id:path}")
def get_evidence(evidence_id: str):
    with store() as graph:
        result = search.evidence(evidence_id, graph)
    if result is None:
        raise HTTPException(404, "Evidence not found")
    return result
