"""소유한 임시 localhost 서버에서 18개 API 실행과 HITL 재개를 검증한 뒤 종료한다."""

from __future__ import annotations

import importlib.util
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx
from langchain_core.messages import convert_to_messages

ROOT = Path(__file__).resolve().parents[2]


def sample_input(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data = (
        module.sample_input()
        if hasattr(module, "sample_input")
        else {"messages": [("user", module.PROMPT)]}
    )
    data["messages"] = [
        {"role": {"human": "user", "ai": "assistant"}[m.type], "content": m.content}
        for m in convert_to_messages(data["messages"])
    ]
    return data


def wait_until_ready(client, process, log):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("Server exited:\n" + log.read_text()[-8000:])
        try:
            if client.get("/ok").status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(0.25)
    raise TimeoutError("Server boot timeout:\n" + log.read_text()[-8000:])


def result_of(response):
    response.raise_for_status()
    result = response.json()
    assert "__error__" not in result, result
    return result


def verify_result(graph_id, result):
    number = int(graph_id[:2])
    if number == 14:
        assert result.get("__interrupt__"), result
        assert "/approved.txt" not in result.get("files", {})
        return
    assert result["messages"][-1]["type"] == "ai", result
    errors = [m for m in result["messages"] if m.get("status") == "error"]
    assert len(errors) == (1 if number == 16 else 0), errors
    if number in (3, 18):
        assert result["todos"][0]["status"] == "completed"
    if number == 18:
        assert "fixture://research" in result["files"]["/report.md"]["content"]


def main():
    # subprocess와 fixture import 모두 오프라인으로 고정한다.
    os.environ["DEEP_AGENTS_MODE"] = "scripted"
    os.environ["LANGSMITH_TRACING"] = "false"
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    with TemporaryDirectory(prefix="deep-agents-server-") as temp:
        config = json.loads((ROOT / "6-langgraph-deep-agents.json").read_text())
        config["dependencies"] = [str((ROOT / dep).resolve()) for dep in config["dependencies"]]
        config["env"] = str((ROOT / config["env"]).resolve())
        config_path = Path(temp) / "langgraph.json"
        config_path.write_text(json.dumps(config))
        log = Path(temp) / "server.log"
        with log.open("w") as output:
            process = subprocess.Popen(
                [
                    str(Path(sys.executable).parent / "langgraph"),
                    "dev",
                    "--config",
                    str(config_path),
                    "--host",
                    "127.0.0.1",
                    "--no-browser",
                    "--no-reload",
                    "--allow-blocking",
                    "--port",
                    str(port),
                ],
                cwd=temp,
                stdout=output,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=45) as client:
                wait_until_ready(client, process, log)
                assistants = result_of(client.post("/assistants/search", json={"limit": 100}))
                expected = json.loads((ROOT / "6-langgraph-deep-agents.json").read_text())["graphs"]
                assert {a["graph_id"] for a in assistants} == set(expected)
                for path in sorted((ROOT / "graphs/deep_agents").rglob("[0-9]*.py")):
                    thread = result_of(client.post("/threads", json={}))
                    endpoint = f"/threads/{thread['thread_id']}/runs/wait"
                    result = result_of(
                        client.post(
                            endpoint,
                            json={
                                "assistant_id": path.stem,
                                "input": sample_input(path),
                            },
                        )
                    )
                    verify_result(path.stem, result)
                    if path.stem.startswith("14_"):
                        resumed = result_of(
                            client.post(
                                endpoint,
                                json={
                                    "assistant_id": path.stem,
                                    "command": {"resume": {"decisions": [{"type": "approve"}]}},
                                },
                            )
                        )
                        assert resumed["files"]["/approved.txt"]["content"] == "draft"
                        assert not resumed.get("__interrupt__")
                    print("PASS API", path.stem, flush=True)
                print("18/18 API passed, approval resume passed", flush=True)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
            with socket.socket() as probe:
                released = probe.connect_ex(("127.0.0.1", port)) != 0
            print("Owned server stopped; port released:", released, flush=True)
            assert released


if __name__ == "__main__":
    main()
