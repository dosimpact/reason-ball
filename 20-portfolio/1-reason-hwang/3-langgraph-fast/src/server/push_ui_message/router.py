import asyncio
import json
import logging
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field

from graph.primary_graphs.simple_push_ui_message.workflow import simple_push_ui_message
from server.execution import execution_gate

router = APIRouter(prefix="/examples/push-ui-message", tags=["examples"])
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, pattern=r"\S")
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


def encode(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    async def stream():
        turn_id = str(uuid4())
        yield encode("start", {"message_id": turn_id})
        queue = asyncio.Queue(maxsize=32)

        async def execute():
            messages = [HumanMessage(content=m.content) if m.role == "user" else AIMessage(content=m.content)
                        for m in request.history]
            messages.append(HumanMessage(content=request.message))
            final = None
            async for mode, value in simple_push_ui_message.astream(
                {"messages": messages, "ui": [], "turn_id": turn_id, "model_calls": 0},
                stream_mode=["custom", "values"], config={"recursion_limit": 16},
            ):
                if mode == "custom":
                    await queue.put(encode("ui", value))
                else:
                    final = value
            response = final["messages"][-1]
            if not isinstance(response, AIMessage) or response.tool_calls:
                raise ValueError("Graph did not produce a final answer")
            content = response.content if isinstance(response.content, str) else "".join(
                block.get("text", "") for block in response.content if isinstance(block, dict)
            )
            if not content.strip():
                raise ValueError("Model returned an empty answer")
            await queue.put(encode("answer", {"message_id": turn_id, "content": content}))
            await queue.put(encode("done", {"message_id": turn_id}))

        async def produce():
            try:
                await execution_gate.run(asyncio.wait_for(execute(), timeout=180))
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning("Push UI example execution failed")
                await queue.put(encode("error", {"message_id": turn_id, "message": "실행에 실패했습니다. 모델 설정과 서버 연결을 확인하세요."}))
            finally:
                # Cancellation is handled by the consumer; do not block on a full queue.
                if not asyncio.current_task().cancelling():
                    await queue.put(None)

        task = asyncio.create_task(produce())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
