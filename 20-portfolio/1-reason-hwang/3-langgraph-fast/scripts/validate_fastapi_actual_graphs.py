"""Bounded read-only representative graphs using the actual LangGraph Python SDK."""

import asyncio
import json
from pathlib import Path

from langgraph_sdk import get_client


async def main():
    c = get_client(url="http://127.0.0.1:3981")
    e = json.loads(Path("/tmp/fastapi-parity-cases.json").read_text())
    for gid, payload in [
        ("price_agent", {"query": "AAPL 최근 5개 일봉", "interval": "1d", "count": 5}),
        (
            "sec_deep_agent",
            {
                "messages": [
                    {
                        "role": "human",
                        "content": "외부 도구/수집/파일 쓰기를 호출하지 말고 일반 지식으로 SEC 10-K의 뜻만 한 문장으로 설명하세요.",
                    }
                ]
            },
        ),
    ]:
        t = await c.threads.create(
            metadata={"source": "qa-fastapi-sdk", "graph_id": gid}
        )
        tid = t["thread_id"]
        e["threads"].append(tid)
        Path("/tmp/fastapi-parity-cases.json").write_text(json.dumps(e, indent=2))
        r = await asyncio.wait_for(c.runs.wait(tid, gid, input=payload), 90)
        runs = await c.runs.list(tid)
        assert runs[0]["status"] == "success", (gid, runs[0])
        state = await c.threads.get_state(tid)
        assert state["values"]
        if gid == "price_agent":
            assert len(r["prices"]) == 5, r
        if gid == "sec_deep_agent":
            assert not any(m.get("tool_calls") for m in r.get("messages", [])), (
                "SEC test unexpectedly called a tool"
            )
        e["checks"].append(
            {"actual_sdk_graph": gid, "run_id": runs[0]["run_id"], "status": "success"}
        )
        Path("/tmp/fastapi-parity-cases.json").write_text(json.dumps(e, indent=2))
        print("PASS SDK actual", gid, flush=True)


asyncio.run(main())
