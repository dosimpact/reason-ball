"""Mock 외부 시스템.

POST /jobs 로 잡을 받으면 N초 뒤 callback_url 로 결과를 POST 한다.
실제 환경에서는 영상 인코더 / 배치 잡 클러스터 / SaaS API 등이 이 역할.
"""
from __future__ import annotations

import asyncio
import os
import random
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class JobIn(BaseModel):
    job_id: str
    task: str
    # callback_url 은 "http://server/webhook/{thread_id}" 처럼 placeholder 가 들어있을 수 있음.
    # 데모에서는 클라이언트(서버) 가 thread_id 를 채워 보내거나, 여기서 그대로 사용.
    callback_url: str


PROCESS_DELAY = float(os.environ.get("MOCK_DELAY_SEC", "5"))


async def _run_job(job: JobIn, thread_id: str):
    await asyncio.sleep(PROCESS_DELAY)
    url = job.callback_url.replace("{thread_id}", thread_id)
    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "result": f"task='{job.task}' done with score={random.randint(80, 99)}",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.post(url, json=payload)
            print(f"[mock_external] callback {url} -> {r.status_code}")
        except Exception as e:  # noqa: BLE001
            print(f"[mock_external] callback failed: {e}")


@app.post("/jobs")
async def submit(job: JobIn):
    # 데모 단순화: thread_id 를 별도 헤더 / 본문에 받지 않고, callback_url 에 박혀있다고 가정.
    # 실제로는 서버가 job 등록 시 thread_id 를 함께 전달하는 식으로 바인딩.
    # 여기서는 callback_url 의 마지막 segment 를 thread_id 로 사용.
    thread_id = job.callback_url.rstrip("/").split("/")[-1]
    asyncio.create_task(_run_job(job, thread_id))
    return {"accepted": True, "job_id": job.job_id, "thread_id": thread_id}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("MOCK_EXTERNAL_PORT", "9000"))
    uvicorn.run("mock_external:app", host="0.0.0.0", port=port, reload=False)
