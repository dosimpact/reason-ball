from fastapi import FastAPI
from pydantic import BaseModel, Field

from langgraph_fast.graph.workflow import run_graph


class GraphRunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    provider: str = Field(default="openai")


class GraphRunResponse(BaseModel):
    provider: str
    message: str
    response: str


app = FastAPI(title="LangGraph Fast", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/graph/run", response_model=GraphRunResponse)
async def graph_run(request: GraphRunRequest) -> GraphRunResponse:
    result = await run_graph(message=request.message, provider_name=request.provider)
    return GraphRunResponse(**result)
