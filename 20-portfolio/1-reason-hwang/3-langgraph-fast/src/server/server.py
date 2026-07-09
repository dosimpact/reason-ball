from fastapi import FastAPI
from pydantic import BaseModel, Field

from graph.main_graph.workflow import run_graph
from server.routers.tenk import graph_router as tenk_graph_router
from server.routers.tenk import router as tenk_router


class GraphRunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    provider: str = Field(default="openai")


class GraphRunResponse(BaseModel):
    provider: str
    message: str
    response: str


app = FastAPI(title="LangGraph Fast", version="0.1.0")
app.include_router(tenk_router)
app.include_router(tenk_graph_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/graph/run", response_model=GraphRunResponse)
async def graph_run(request: GraphRunRequest) -> GraphRunResponse:
    result = await run_graph(message=request.message, provider_name=request.provider)
    return GraphRunResponse(**result)
