"""API-only production-manager parity checks against an owned QA fixture app."""

import asyncio
import json
import time
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:3981"
OWNED = Path("/tmp/fastapi-parity-cases.json")


async def main():
    evidence = {"threads": [], "checks": []}
    async with httpx.AsyncClient(base_url=BASE, timeout=25) as client:

        async def call(method, path, **kwargs):
            response = await client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()

        async def thread():
            tid = (
                await call(
                    "POST",
                    "/threads",
                    json={"metadata": {"source": "qa-fastapi-parity"}},
                )
            )["thread_id"]
            evidence["threads"].append(tid)
            OWNED.write_text(json.dumps(evidence))
            return tid

        async def terminal(tid, rid):
            for _ in range(100):
                run = await call("GET", f"/threads/{tid}/runs/{rid}")
                if run["status"] not in {"pending", "running"}:
                    return run
                await asyncio.sleep(0.1)
            raise AssertionError("Run did not terminate within 10 seconds")

        assistants = await call("POST", "/assistants/search", json={"limit": 100})
        graph_ids = {row["graph_id"] for row in assistants}
        expected = set(json.loads(Path("langgraph.json").read_text())["graphs"])
        assert expected <= graph_ids, expected - graph_ids
        for gid in sorted(expected):
            schema = await call("GET", f"/assistants/{gid}/schemas")
            assert schema["input_schema"] and schema["output_schema"]
        evidence["checks"].append({"discovery_and_schemas": sorted(expected)})
        tid = await thread()
        events = []
        started = time.monotonic()
        async with client.stream(
            "POST",
            f"/threads/{tid}/runs/stream",
            json={
                "assistant_id": "qa_parity_graph",
                "input": {
                    "messages": [{"role": "human", "content": "one"}],
                    "delay": 1.5,
                },
                "stream_mode": ["values", "messages-tuple", "custom"],
            },
        ) as response:
            response.raise_for_status()
            event = None
            async for line in response.aiter_lines():
                if line.startswith("event: "):
                    event = line[7:]
                elif line.startswith("data: "):
                    events.append(
                        {
                            "event": event,
                            "data": json.loads(line[6:]),
                            "elapsed": time.monotonic() - started,
                        }
                    )
        rid = next(e["data"]["run_id"] for e in events if e["event"] == "metadata")
        assert (await terminal(tid, rid))["status"] == "success"
        assert any(
            e["event"] == "custom"
            and e["data"].get("phase") == "started"
            and e["elapsed"] < 1.3
            for e in events
        )
        assert any(e["event"] == "messages-tuple" for e in events)
        state = await call("GET", f"/threads/{tid}/state")
        assert state["values"]["completed"] == 1
        assert any(
            m.get("tool_call_id") == "fixture-tool" for m in state["values"]["messages"]
        )
        await call(
            "POST",
            f"/threads/{tid}/runs/wait",
            json={
                "assistant_id": "qa_parity_graph",
                "input": {
                    "messages": [{"role": "human", "content": "two"}],
                    "delay": 0.01,
                },
            },
        )
        state = await call("GET", f"/threads/{tid}/state")
        assert state["values"]["completed"] == 2
        assert sum(m.get("type") == "human" for m in state["values"]["messages"]) == 2
        evidence["restart_thread"] = tid
        evidence["checkpoint"] = state["checkpoint"]
        evidence["checks"].append({"live_stream": events, "same_thread_completed": 2})
        for action, desired in [
            ("cancel", "interrupted"),
            ("disconnect", "success"),
            ("error", "error"),
        ]:
            case_tid = await thread()
            run = await call(
                "POST",
                f"/threads/{case_tid}/runs",
                json={
                    "assistant_id": "qa_parity_graph",
                    "input": {"action": action, "delay": 1.0},
                    "stream_mode": ["values", "custom"],
                },
            )
            case_rid = run["run_id"]
            if action == "cancel":
                await asyncio.sleep(0.15)
                await call(
                    "POST", f"/threads/{case_tid}/runs/{case_rid}/cancel?wait=true"
                )
            elif action == "disconnect":
                async with client.stream(
                    "GET", f"/threads/{case_tid}/runs/{case_rid}/stream"
                ) as stream:
                    async for line in stream.aiter_lines():
                        if line.startswith("data: "):
                            break
            result = await terminal(case_tid, case_rid)
            assert result["status"] == desired, result
            await asyncio.sleep(0.2)
            assert (await call("GET", f"/threads/{case_tid}/runs/{case_rid}"))[
                "status"
            ] == desired
            evidence["checks"].append({action: desired})
    OWNED.write_text(json.dumps(evidence, indent=2))
    print(
        json.dumps(
            {
                "passed": len(evidence["checks"]),
                "restart_thread": tid,
                "evidence": str(OWNED),
            }
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
