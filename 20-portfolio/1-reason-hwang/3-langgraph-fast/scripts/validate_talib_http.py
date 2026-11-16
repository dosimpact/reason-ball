"""Owned real HTTP/graph/tool/native engine/parser validation without browsers or paid calls."""

import json
import os
import signal
import socket
import subprocess
import time
from pathlib import Path

import httpx

PACKAGE = Path(__file__).resolve().parents[1]
HOST = PACKAGE.parent / "1-fe-host"


def free(port):
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def main():
    ports = [32984, 32985]
    assert all(free(port) for port in ports), "Choose unused validation ports"
    output = PACKAGE / ".tmp/talib-http"
    output.mkdir(parents=True, exist_ok=True)
    processes = []
    logs = []
    report = {"status": "RUNNING", "ports": ports}
    try:
        env = dict(
            os.environ,
            SEC_CHAT_UI_VALIDATOR_URL="http://127.0.0.1:32985/api/sec-ui/validate",
            TALIB_VALIDATOR_PORT="32985",
            PYTHONPATH=str(PACKAGE / "tests/fixtures")
            + os.pathsep
            + str(PACKAGE / "src"),
        )
        for name, command, cwd in [
            ("validator", ["node", "tests/fixtures/talib-validator.mjs"], HOST),
            (
                "runtime",
                [
                    "uv",
                    "run",
                    "--env-file",
                    ".env",
                    "python",
                    "-m",
                    "uvicorn",
                    "talib_http_app:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "32984",
                ],
                PACKAGE,
            ),
        ]:
            log = (output / f"{name}.log").open("w")
            logs.append(log)
            processes.append(
                subprocess.Popen(
                    command,
                    cwd=cwd,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            )
        report["pids"] = [process.pid for process in processes]
        deadline = time.monotonic() + 90
        with httpx.Client(base_url="http://127.0.0.1:32984", timeout=5) as client:
            while time.monotonic() < deadline:
                assert all(process.poll() is None for process in processes), (
                    "Owned process exited; inspect logs"
                )
                try:
                    if client.post("/assistants/search", json={"limit": 10}).is_success:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.25)
            else:
                raise TimeoutError("Owned server startup timed out")
            result = subprocess.run(
                [
                    "pnpm",
                    "test:talib-agent:api",
                    "--env-var",
                    "baseUrl=http://127.0.0.1:32984",
                ],
                cwd=PACKAGE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                check=False,
            )
            (output / "bruno.log").write_text(result.stdout)
            report["brunoExit"] = result.returncode
            assert result.returncode == 0, "Bruno failed; inspect bruno.log"
            assert (
                client.post(
                    "/threads/search",
                    json={"metadata": {"source": "talib-api-validation"}},
                ).json()
                == []
            )
            report["threadsDeleted"] = True
        report["status"] = "SUCCEEDED"
    except Exception as error:  # noqa: BLE001 - retain evidence before owned cleanup
        report.update(
            status="FAILED", errorType=type(error).__name__, message=str(error)[:500]
        )
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
        for log in logs:
            log.close()
        report["processesExited"] = all(
            process.poll() is not None for process in processes
        )
        report["portsReleased"] = all(free(port) for port in ports)
        (output / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    return (
        0
        if report["status"] == "SUCCEEDED"
        and report["processesExited"]
        and report["portsReleased"]
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
