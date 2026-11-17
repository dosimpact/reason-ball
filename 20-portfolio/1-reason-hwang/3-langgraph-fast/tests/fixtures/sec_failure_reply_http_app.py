"""Actual failure-reply HTTP/helper with a controlled model boundary."""
from fastapi import FastAPI
from langchain_core.messages import AIMessage

from domains.sec_chat.failure_reply import build_failure_reply as real_build_reply
from server.sec_chat import router as routes

TRACE = []


class Model:
    def __init__(self, body):
        self.body = body

    async def ainvoke(self, messages):
        TRACE.append({"stage": self.body.stage, "reason": self.body.reason,
                      "messageCount": len(messages), "sessionCount": len(routes.sessions)})
        if self.body.message == "provider-fail":
            raise RuntimeError("private provider response")
        if self.body.message == "empty-reply":
            return AIMessage(content="")
        return AIMessage(content=f"{self.body.stage} 작업을 완료하지 못했어요. 질문을 다시 보내 주세요.")


async def build_reply(body):
    return await real_build_reply(body, Model(body))


routes.build_failure_reply = build_reply
app = FastAPI()
app.include_router(routes.router)


@app.get("/qa/trace")
async def trace():
    return {"calls": TRACE, "sessionCount": len(routes.sessions)}
