import asyncio
import json
import sys
import time
from pathlib import Path

import httpx
from langgraph_sdk import get_client


async def main():
    mode = sys.argv[1]
    c = get_client(url="http://127.0.0.1:3981")
    e = json.loads(Path("/tmp/fastapi-parity-cases.json").read_text())
    http = httpx.AsyncClient(timeout=100)
    catalog = (
        await http.get("http://127.0.0.1:3981/technical-analysis/catalog")
    ).json()
    names = [x["name"] for x in catalog["indicators"]]
    request = {
        "ticker": "AAPL",
        "interval": "1d",
        "count": 60,
        "indicators": [{"name": n} for n in names],
    }
    gid = (
        "technical_analysis_agent"
        if mode == "inline"
        else "technical_analysis_canvas_agent"
    )
    t = await c.threads.create(metadata={"source": "qa-ta20-wire", "graph_id": gid})
    tid = t["thread_id"]
    e["threads"].append(tid)
    Path("/tmp/fastapi-parity-cases.json").write_text(json.dumps(e, indent=2))
    data = {
        "messages": [
            {
                "role": "human",
                "content": "제공된 구조화 조건대로 20종 전체 지표를 계산해 주세요.",
            }
        ]
    }
    data.update(
        {"analysis_request": request}
        if mode == "inline"
        else {"canvas_context": {"request": request}}
    )
    events = []
    final = None
    start = time.monotonic()

    async def collect():
        nonlocal final
        async for chunk in c.runs.stream(
            tid, gid, input=data, stream_mode=["values", "custom"]
        ):
            if chunk.event == "values":
                final = chunk.data
            elif chunk.event == "custom":
                events.append(chunk.data)
            elif chunk.event == "error":
                raise AssertionError(chunk.data)

    await asyncio.wait_for(collect(), 100)
    run = (await c.runs.list(tid))[0]
    assert run["status"] == "success", run
    assert final and len(final["analysis_result"]["indicators"]) == 20, list(
        final or {}
    )
    assert {i["name"] for i in final["analysis_result"]["indicators"]} == set(names)
    if mode == "inline":
        program = final["presentation"]["program"]
        assert not any(x.get("channel") == "canvas" for x in events)
        assert (await http.get("http://127.0.0.1:3981/qa/model-guard")).json() == {
            "enabled": True,
            "calls": 0,
        }
    else:
        ready = next(
            x
            for x in events
            if x.get("channel") == "canvas" and x.get("type") == "ready"
        )
        report = final["canvas_reports"][ready["reportId"]]
        assert report["status"] == "ready"
        assert len(report["request"]["indicators"]) == 20
        program = report["program"]
    assert "IndicatorControls(" in program
    check = await http.post(
        "http://127.0.0.1:3183/api/sec-ui/validate", json={"program": program}
    )
    check.raise_for_status()
    assert check.json()["valid"], check.json()
    e["checks"].append(
        {
            "actual_ta20_agent": mode,
            "run_id": run["run_id"],
            "thread_id": tid,
            "indicators": 20,
            "parser_valid": True,
            "program_chars": len(program),
            "seconds": round(time.monotonic() - start, 2),
            "canvas_events": [x.get("type") for x in events],
        }
    )
    Path("/tmp/fastapi-parity-cases.json").write_text(json.dumps(e, indent=2))
    print(json.dumps(e["checks"][-1]))
    await http.aclose()


asyncio.run(main())
