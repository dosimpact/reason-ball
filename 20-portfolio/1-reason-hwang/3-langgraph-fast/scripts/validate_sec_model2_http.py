"""Owned HTTP lifecycle verification of full published AAPL/CPNG model1 inputs."""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import httpx

PACKAGE = Path(__file__).resolve().parents[1]
SAMPLES = [
    ("AAPL", "0000320193", "0000320193-26-000026"),
    ("CPNG", "0001834584", "0001834584-26-000024"),
]


def available(port):
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def data(response):
    response.raise_for_status()
    return response.json()


def snapshot(client, cik, accession):
    prefix = f"/internal/sec-modeling/filings/{cik}/{accession}"
    status = data(client.get(prefix + "/status"))
    results = {
        str(stage): data(client.get(prefix + f"/results/{stage}", params={"limit": 1}))
        for stage in (1, 2)
    }
    return {"status": status, "results": results}


def verify_sample(client, sample, output, execute):
    ticker, cik, accession = sample
    before = snapshot(client, cik, accession)
    (output / f"{ticker}-before.json").write_text(json.dumps(before, indent=2))
    first = before["status"]["stages"]["1"]
    row = {"ticker": ticker, "before": before, "executed": execute}
    if execute:
        run_id = "http-model2-" + ticker + "-" + uuid4().hex
        body = {
            "runId": run_id,
            "executionToken": uuid4().hex,
            "cik": cik,
            "accessionNo": accession,
            "sourceHash": first["sourceHash"],
            "inputGenerationId": first["id"],
        }
        events = []
        with client.stream(
            "POST", "/internal/sec-modeling/model-2/runs", json=body, timeout=None
        ) as response:
            response.raise_for_status()
            with (output / f"{ticker}-events.ndjson").open("w") as log:
                for line in response.iter_lines():
                    if line:
                        event = json.loads(line)
                        events.append(event)
                        log.write(json.dumps(event) + "\n")
                        log.flush()
                        if event.get("type") in {"completed", "error"}:
                            print(
                                json.dumps({"ticker": ticker, "event": event}),
                                flush=True,
                            )
        state = data(client.get(f"/internal/sec-modeling/runs/{run_id}"))
        row["run"] = state
        row["eventCount"] = len(events)
        row["after"] = snapshot(client, cik, accession)
        (output / f"{ticker}-result.json").write_text(json.dumps(row, indent=2))
        assert "executionToken" not in state
        assert state["status"] == "SUCCEEDED", state
        assert any(e.get("type") == "completed" for e in events)
        assert not any(e.get("type") == "error" for e in events)
    after = snapshot(client, cik, accession)
    row["after"] = after
    assert after["status"]["stages"]["1"]["id"] == first["id"], (
        "Model1 changed during validation"
    )
    second = after["status"]["stages"]["2"]
    assert second["inputGenerationId"] == first["id"]
    assert after["results"]["2"]["total"] > 0
    filing = f"filing:{cik}:{accession}"
    hits = data(
        client.post(
            "/api/sec-analysis/search",
            json={
                "query": "business risks operations products competition",
                "filingIds": [filing],
                "topK": 5,
            },
        )
    )
    assert hits["items"], "Published evidence search was empty"
    for hit in hits["items"]:
        assert hit["filingId"] == filing and hit["generationId"] == second["id"]
        evidence = data(client.get("/api/sec-analysis/evidence/" + hit["evidenceId"]))
        assert evidence["isActive"] is True
        assert (
            evidence["filingId"] == filing and evidence["generationId"] == second["id"]
        )
        assert evidence["itemId"] and evidence["supportingChunks"]
        for chunk in evidence["supportingChunks"]:
            assert chunk["filingId"] == filing and chunk["generationId"] == second["id"]
    row["searchHits"] = hits
    (output / f"{ticker}-result.json").write_text(json.dumps(row, indent=2))
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=32983)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Publish full model2 for both actual filings; default only verifies reads",
    )
    parser.add_argument("--output", type=Path, default=PACKAGE / ".tmp/sec-model2-http")
    parser.add_argument(
        "--ticker",
        choices=["AAPL", "CPNG"],
        help="Limit execution to one approved filing; default both",
    )
    args = parser.parse_args()
    assert available(args.port), "Choose an unoccupied owned-server port"
    assert os.environ.get("SEC_MODELING_KEY"), "SEC_MODELING_KEY must be configured"
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"status": "RUNNING", "port": args.port, "samples": []}
    process = None
    try:
        with (
            (args.output / "server.log").open("w") as log,
            httpx.Client(
                base_url=f"http://127.0.0.1:{args.port}",
                headers={"X-SEC-Modeling-Key": os.environ["SEC_MODELING_KEY"]},
                timeout=120,
            ) as client,
        ):
            process = subprocess.Popen(
                ["pnpm", "start", "--port", str(args.port), "--host", "127.0.0.1"],
                cwd=PACKAGE,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            report["serverPid"] = process.pid
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError("Owned server exited; inspect server.log")
                try:
                    if client.get(
                        "/internal/sec-modeling/runs/validation-health", timeout=1
                    ).is_success:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError("Owned server startup timed out")
            unauth = httpx.get(
                f"http://127.0.0.1:{args.port}/internal/sec-modeling/runs/validation-health"
            )
            assert unauth.status_code == 401
            report["unauthenticatedHttp"] = unauth.status_code
            for sample in SAMPLES:
                if args.ticker and sample[0] != args.ticker:
                    continue
                report["samples"].append(
                    verify_sample(client, sample, args.output, args.execute)
                )
            # Run committed Bruno read scenarios against the same owned real server.
            result = subprocess.run(
                [
                    "pnpm",
                    "test:model2:http:api",
                    "--env-var",
                    f"baseUrl=http://127.0.0.1:{args.port}",
                ],
                cwd=PACKAGE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                check=False,
            )
            (args.output / "bruno.log").write_text(result.stdout)
            report["brunoExit"] = result.returncode
            assert result.returncode == 0, "Bruno failed; inspect bruno.log"
            report["status"] = "SUCCEEDED"
    except Exception as error:  # noqa: BLE001 - persist failure before owned cleanup
        report.update(
            status="FAILED", errorType=type(error).__name__, message=str(error)[:1000]
        )
    finally:
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        report["serverExited"] = process is None or process.poll() is not None
        report["portReleased"] = available(args.port)
        (args.output / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "samples"}))
    return (
        0
        if report["status"] == "SUCCEEDED"
        and report["serverExited"]
        and report["portReleased"]
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(main())
