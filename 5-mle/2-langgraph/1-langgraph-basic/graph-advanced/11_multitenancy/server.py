"""FastAPI 서버 — JWT 검증, 사용자별 thread 격리, rate limit."""
from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from jose import JWTError, jwt
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore
from pydantic import BaseModel

from graph import build_graph_with_storage

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://langgraph:langgraph@localhost:5432/langgraph"
)
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
RATE_LIMIT_PER_HOUR = int(os.environ.get("RATE_LIMIT_PER_HOUR", "30"))

# TODO(prod): in-memory dict 는 단일 프로세스 전용. multi-replica 환경에서는
# Redis (`INCR` + `EXPIRE`) 또는 token bucket 라이브러리로 교체.
_rate_buckets: dict[str, deque] = defaultdict(deque)


def _rate_check(user_id: str) -> None:
    now = time.time()
    bucket = _rate_buckets[user_id]
    while bucket and now - bucket[0] > 3600:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(429, detail=f"rate limit exceeded ({RATE_LIMIT_PER_HOUR}/h)")
    bucket.append(now)


def _verify_jwt(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise HTTPException(401, detail=f"invalid token: {e}") from e
    # 표준 JWT claim "sub" 만 허용. fallback (user_id 등) 두지 않음.
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, detail="token missing 'sub' claim")
    return str(user_id)


class ChatRequest(BaseModel):
    conv_id: str
    message: str


class IssueTokenRequest(BaseModel):
    user_id: str


_state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    saver_cm = PostgresSaver.from_conn_string(DATABASE_URL)
    store_cm = PostgresStore.from_conn_string(DATABASE_URL)
    saver = saver_cm.__enter__()
    store = store_cm.__enter__()
    saver.setup()
    store.setup()
    _state["graph"] = build_graph_with_storage(saver, store)
    _state["saver_cm"] = saver_cm
    _state["store_cm"] = store_cm
    try:
        yield
    finally:
        store_cm.__exit__(None, None, None)
        saver_cm.__exit__(None, None, None)


app = FastAPI(lifespan=lifespan)


def _scoped_thread_id(user_id: str, conv_id: str) -> str:
    # 다른 사용자가 conv_id 만 알아도 thread_id 가 user_id prefix 라 자동 분리.
    return f"{user_id}:{conv_id}"


def _assert_thread_owner(user_id: str, thread_id: str) -> None:
    expected_prefix = f"{user_id}:"
    if not thread_id.startswith(expected_prefix):
        raise HTTPException(403, detail="thread does not belong to user")


@app.post("/chat")
async def chat(req: ChatRequest, user_id: str = Depends(_verify_jwt)):
    """그래프 sync API → to_thread 로 워커 격리."""
    _rate_check(user_id)
    graph = _state["graph"]
    thread_id = _scoped_thread_id(user_id, req.conv_id)
    cfg = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    out = await asyncio.to_thread(
        graph.invoke,
        {"messages": [HumanMessage(content=req.message)]},
        cfg,
    )
    last = out["messages"][-1]
    return {
        "thread_id": thread_id,
        "user_id": user_id,
        "reply": getattr(last, "content", None),
    }


@app.get("/threads/{thread_id}")
async def get_thread(thread_id: str, user_id: str = Depends(_verify_jwt)):
    _assert_thread_owner(user_id, thread_id)
    graph = _state["graph"]
    snap = await asyncio.to_thread(
        graph.get_state, {"configurable": {"thread_id": thread_id}}
    )
    msgs = snap.values.get("messages", []) if snap.values else []
    return {
        "thread_id": thread_id,
        "n_messages": len(msgs),
        "last": getattr(msgs[-1], "content", None) if msgs else None,
    }


@app.get("/whoami")
async def whoami(user_id: str = Depends(_verify_jwt)):
    return {"user_id": user_id, "rate_used": len(_rate_buckets[user_id])}


@app.post("/_dev/token")
async def issue_token(req: IssueTokenRequest):
    """개발 편의용 토큰 발급. 운영에서는 절대 노출 금지."""
    token = jwt.encode(
        {"sub": req.user_id, "iat": int(time.time())}, JWT_SECRET, algorithm=JWT_ALG
    )
    return {"token": token}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
