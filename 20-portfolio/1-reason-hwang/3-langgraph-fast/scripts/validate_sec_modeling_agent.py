"""Validate the SEC POC through an owned LangGraph OSS HTTP server, without a browser."""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import time
from pathlib import Path

import httpx

PACKAGE = Path(__file__).resolve().parents[1]
GRAPH = "sec_modeling_agent"


def available(port):
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def check(response):
    response.raise_for_status()
    return response.json()


def verify_bff_reads():
    samples = (
        ("AAPL", "0000320193", "0000320193-26-000026"),
        ("CPNG", "0001834584", "0001834584-26-000024"),
        ("NVDA", "0001045810", "0001045810-26-000021"),
    )
    rows = []
    with httpx.Client(
        base_url=os.getenv("SEC_CHAT_BFF_URL", "http://127.0.0.1:2801"), timeout=40
    ) as client:
        for ticker, cik, accession in samples:
            prefix = f"/api/sec/modeling/filings/{cik}/{accession}"
            status = check(client.get(prefix + "/status"))
            result = check(client.get(prefix + "/results/3", params={"limit": 100}))
            assert "3" in status["stages"] and result["total"] > 0
            rows.append(
                {
                    "ticker": ticker,
                    "facts": result["total"],
                    "generationId": result["generationId"],
                    "passed": True,
                }
            )
        invalid = client.get(
            "/api/sec/modeling/filings/bad/0000320193-26-000026/status"
        )
        assert invalid.status_code == 400, "Invalid CIK must be rejected"
    return {"filings": rows, "invalidCikHttp": invalid.status_code}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=32982)
    parser.add_argument(
        "--output", type=Path, default=PACKAGE / ".tmp/sec-modeling-agent-validation"
    )
    args = parser.parse_args()
    if not available(args.port):
        raise ValueError("Validation port is occupied; choose another --port")
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"graph": GRAPH, "status": "RUNNING", "port": args.port}
    thread_id = None
    process = None
    client = httpx.Client(base_url=f"http://127.0.0.1:{args.port}", timeout=240)
    try:
        with (args.output / "server.log").open("w") as log:
            process = subprocess.Popen(
                [
                    "pnpm",
                    "dev:langgraph",
                    "--port",
                    str(args.port),
                    "--host",
                    "127.0.0.1",
                    "--no-reload",
                ],
                cwd=PACKAGE,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            report["serverPid"] = process.pid
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(
                        "Owned LangGraph server exited during startup; inspect server.log"
                    )
                try:
                    if client.get("/ok", timeout=1).is_success:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError("Owned LangGraph server startup timed out")
            assistants = check(
                client.post("/assistants/search", json={"graph_id": GRAPH, "limit": 10})
            )
            assert assistants, "SEC graph was not discovered"
            assistant = assistants[0]["assistant_id"]
            schemas = check(client.get(f"/assistants/{assistant}/schemas"))
            assert "messages" in json.dumps(schemas), (
                "Chat input schema is missing messages"
            )
            report["bffReads"] = verify_bff_reads()
            report["discovery"] = {"assistantId": assistant, "schemaHasMessages": True}
            thread = check(
                client.post(
                    "/threads",
                    json={
                        "metadata": {"purpose": "owned-sec-modeling-agent-validation"}
                    },
                )
            )
            thread_id = thread["thread_id"]
            report["threadId"] = thread_id
            question = (
                "SEC 모델링 POC 읽기 전용 확인입니다. 저장된 AAPL 최신 10-K 한 건을 찾아, "
                "모델1은 get_sec_modeling_results(stage=1), 모델2는 search_sec_evidence, 모델3는 query_sec_xbrl_facts 도구로 각각 실제 조회하세요. "
                "각 모델의 원문 근거 ID와 모델3 분류·값·기간·단위·차원을 함께 짧게 비교하세요. "
                "모델2 데이터가 없으면 그 사실을 명시하세요. 수집·재모델링·삭제를 실행하지 마세요."
            )
            frames = []
            with client.stream(
                "POST",
                f"/threads/{thread_id}/runs/stream",
                json={
                    "assistant_id": assistant,
                    "input": {"messages": [{"role": "user", "content": question}]},
                    "stream_mode": ["values", "updates"],
                    "config": {"recursion_limit": 40},
                },
            ) as response:
                response.raise_for_status()
                event = None
                for line in response.iter_lines():
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:"):
                        payload = json.loads(line[5:])
                        frames.append({"event": event, "data": payload})
                        if event == "error":
                            raise RuntimeError(
                                "SEC graph run emitted an error; inspect stream.json"
                            )
            (args.output / "stream.json").write_text(
                json.dumps(frames, ensure_ascii=False, indent=2)
            )
            state = check(client.get(f"/threads/{thread_id}/state"))
            (args.output / "state.json").write_text(
                json.dumps(state, ensure_ascii=False, indent=2)
            )
            messages = state.get("values", {}).get("messages", [])
            calls = [
                call["name"]
                for message in messages
                for call in message.get("tool_calls", [])
            ]
            answers = [
                m
                for m in messages
                if m.get("type", m.get("role")) in {"ai", "assistant"}
                and m.get("content")
            ]
            assert calls and answers, "Run did not return tool calls and a final answer"
            required = {
                "get_sec_modeling_results",
                "search_sec_evidence",
                "query_sec_xbrl_facts",
            }
            assert required <= set(calls), (
                "Run did not exercise all three modeling read paths"
            )
            assert not {
                "start_sec_modeling",
                "cancel_sec_modeling_run",
                "retry_sec_modeling_run",
            } & set(calls), "Read-only query invoked a mutation"
            assert not [
                m
                for m in messages
                if m.get("type") == "tool" and m.get("status") == "error"
            ], "A tool returned an error"
            report.update(
                status="SUCCEEDED",
                toolCalls=calls,
                streamFrames=len(frames),
                finalAnswer=answers[-1]["content"],
            )
    except Exception as error:  # noqa: BLE001 - persist validation failures before owned-resource cleanup
        report.update(
            status="FAILED", errorType=type(error).__name__, message=str(error)[:1000]
        )
    finally:
        if thread_id:
            try:
                response = client.delete(f"/threads/{thread_id}")
                report["threadDeleted"] = (
                    response.is_success or response.status_code == 404
                )
            except httpx.HTTPError:
                report["threadDeleted"] = False
        client.close()
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        report["serverExited"] = process is None or process.poll() is not None
        report["portReleased"] = available(args.port)
        (args.output / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2)
        )
    print(
        json.dumps(
            {k: v for k, v in report.items() if k != "finalAnswer"}, ensure_ascii=False
        )
    )
    return (
        0
        if report["status"] == "SUCCEEDED"
        and report["serverExited"]
        and report["portReleased"]
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
