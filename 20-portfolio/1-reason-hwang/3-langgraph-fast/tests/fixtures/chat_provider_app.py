"""Owned HTTP validator: real provider clients, local upstream, no paid calls."""
import asyncio
import os
from unittest.mock import patch

from fastapi import FastAPI, HTTPException, Request

from graph.provider.chat_model import ChatModelSettings

app = FastAPI()
_lock = asyncio.Lock()
_wire: list[dict] = []


@app.post("/v1/chat/completions")
async def upstream(request: Request):
    body = await request.json()
    _wire.append({"path": request.url.path, "model": body["model"],
                  "message": body["messages"][-1]["content"]})
    return {"id": "chatcmpl-local", "object": "chat.completion", "created": 0,
            "model": body["model"], "choices": [{"index": 0,
            "message": {"role": "assistant", "content": "local-provider-ok"},
            "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}


def validation_env(provider: str, base_url: str) -> dict[str, str]:
    return {"CHAT_LLM_PROVIDER": provider,
            "CHAT_LLM_OAUTH_MODEL": "oauth-fixture-model",
            "CHAT_LLM_OAUTH_BASE_URL": base_url,
            "CHAT_LLM_OAUTH_API_KEY": "fixture-only-token",
            "CHAT_LLM_OPENAI_MODEL": "openai-fixture-model",
            "CHAT_LLM_OPENAI_BASE_URL": base_url + "/v1",
            "CHAT_LLM_OPENAI_API_KEY": "fixture-only-token",
            "OPENAI_API_KEY": "", "OPENAI_BASE_URL": "http://invalid.invalid",
            "OPENAI_MODEL": "legacy-model-must-not-leak"}


@app.post("/validate/{scenario}")
async def validate(scenario: str, request: Request):
    async with _lock:
        provider = "openai" if scenario == "missing-key" else scenario
        env = validation_env(provider, str(request.base_url).rstrip("/"))
        if scenario == "default":
            env["CHAT_LLM_PROVIDER"] = ""
        if scenario == "missing-key":
            env["CHAT_LLM_OPENAI_API_KEY"] = ""
        _wire.clear()
        with patch.dict(os.environ, env):
            try:
                settings = ChatModelSettings.from_env()
            except ValueError as error:
                raise HTTPException(422, detail=str(error)) from error
            model = settings.build(timeout=5, max_retries=0)
            reply = await model.ainvoke("provider-validation")
        return {"provider": settings.provider, "model": settings.model,
                "baseUrl": settings.base_url, "reply": reply.content,
                "wire": list(_wire)}
