"""API-only multiworker acceptance harness with owned PostgreSQL/process lifecycle.

Two actual server lifespans share a disposable database. No user server or data
is reused. Fixture graphs replace external tools/models, not runtime coordination.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
from dotenv import dotenv_values
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]


class OwnedRuntime:
    def __init__(self):
        self.artifact = Path(tempfile.mkdtemp(prefix="fastapi-multiworker-"))
        self.container = "qa-fastapi-multi-" + uuid4().hex[:12]
        self.workers: dict[int, subprocess.Popen] = {}
        self.used_ports = set()
        self.process_history = []
        self.created = False
        self.validator = None
        self.validator_dist = ".next-multiworker-" + uuid4().hex[:8]
        self.validator_baseline = {}
        self.env = dict(os.environ)
        self.env.update(
            {k: v for k, v in dotenv_values(ROOT / ".env").items() if v is not None}
        )
        self.env.update(
            ENV_PROFILE="production",
            POSTGRES_SCHEMA="qa_multi",
            POSTGRES_HOST="127.0.0.1",
            POSTGRES_USER="postgres",
            POSTGRES_PASSWORD="fixture",
            POSTGRES_DB="runtime_test",
            FASTAPI_STARTUP_GRAPH_ONLY="true",
            FASTAPI_ENABLE_LEGACY_MIGRATION="false",
            LANGGRAPH_RUNTIME_MODE="postgres",
            LANGGRAPH_RUNTIME_NAMESPACE="qa-multi",
            LANGGRAPH_MAX_ACTIVE="2",
            LANGGRAPH_MAX_QUEUED="2",
            LANGGRAPH_LEASE_SECONDS="3",
            LANGGRAPH_HEARTBEAT_SECONDS="0.5",
            LANGGRAPH_POLL_SECONDS="0.1",
            LANGGRAPH_RUNTIME_LISTEN="true",
            LANGGRAPH_WORKER_MAX_ACTIVE="1",
            LANGGRAPH_EXECUTION_VERSION="qa-v1",
            PYTHONPATH="src:tests/fixtures",
            SEC_CHAT_UI_VALIDATOR_URL="http://127.0.0.1:3193/api/sec-ui/validate",
        )

    def command(self, args, timeout=30):
        return subprocess.run(
            args,
            cwd=ROOT,
            env=self.env,
            text=True,
            capture_output=True,
            check=True,
            timeout=timeout,
        )

    def record(self):
        value = {
            "container": self.container,
            "artifact": str(self.artifact),
            "postgresPort": self.env.get("POSTGRES_PORT"),
            "validatorPid": self.validator.pid if self.validator else None,
            "processHistory": self.process_history,
            "workers": {
                str(port): process.pid for port, process in self.workers.items()
            },
        }
        (self.artifact / "ownership.json").write_text(json.dumps(value, indent=2))
        print(json.dumps({"ownership": value}), flush=True)

    async def prepare_database(self):
        for port in (3981, 3982):
            listening = await asyncio.to_thread(
                subprocess.run,
                ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
                capture_output=True,
                text=True,
                check=False,
            )
            if listening.stdout:
                raise RuntimeError(
                    f"Reserved QA port {port} is already occupied; existing listener preserved"
                )
        with socket.socket() as reserved:
            reserved.bind(("127.0.0.1", 0))
            host_port = reserved.getsockname()[1]
        self.command(
            [
                "docker",
                "run",
                "-d",
                "--name",
                self.container,
                "-e",
                "POSTGRES_PASSWORD=fixture",
                "-e",
                "POSTGRES_DB=runtime_test",
                "-p",
                f"127.0.0.1:{host_port}:5432",
                "postgres:16-alpine",
            ]
        )
        self.created = True
        self.env["POSTGRES_PORT"] = (
            self.command(["docker", "port", self.container, "5432/tcp"])
            .stdout.strip()
            .split(":")[-1]
        )
        self.record()
        for _ in range(100):
            result = await asyncio.to_thread(
                subprocess.run,
                ["docker", "exec", self.container, "pg_isready", "-U", "postgres"],
                capture_output=True,
                check=False,
            )
            if result.returncode == 0:
                break
            await asyncio.sleep(0.1)
        else:
            raise AssertionError("Owned PostgreSQL did not become ready")
        migration = [
            str(ROOT / ".venv/bin/python"),
            "-m",
            "infrastructure.postgres.runtime_migration",
        ]
        self.command([*migration, "--bootstrap-base"])
        self.command(migration)
        (self.artifact / "migration.json").write_text(
            json.dumps(
                {
                    "entrypoint": "infrastructure.postgres.runtime_migration",
                    "bootstrap": 0,
                    "repeat": 0,
                    "namespace": "qa-multi",
                }
            )
        )
        script = """import asyncio
import psycopg
from settings import AppSettings
async def main():
 s=AppSettings.from_env()
 async with await psycopg.AsyncConnection.connect(s.postgres_conninfo(),autocommit=True,options=f"-c search_path={s.postgres_schema},public") as conn:
  await conn.execute("CREATE TABLE qa_effects(id bigint GENERATED ALWAYS AS IDENTITY,marker text NOT NULL,phase text NOT NULL,pid integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())")
asyncio.run(main())"""
        self.command([str(ROOT / ".venv/bin/python"), "-c", script])
        print(
            json.dumps(
                {
                    "phase": "official migration entrypoint bootstrap+idempotent repeat PASS"
                }
            ),
            flush=True,
        )

    async def start_worker(self, port):
        assert port in {3981, 3982}
        with (self.artifact / f"worker-{port}.log").open("a") as log:
            process = await asyncio.to_thread(
                subprocess.Popen,
                [
                    str(ROOT / ".venv/bin/python"),
                    "-m",
                    "uvicorn",
                    "multiworker_fixture_app:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                ],
                cwd=ROOT,
                env={**self.env, "PGAPPNAME": f"qa-worker-{port}"},
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        self.workers[port] = process
        self.process_history.append(
            {"port": port, "pid": process.pid, "kind": "worker"}
        )
        self.used_ports.add(port)
        self.record()
        async with httpx.AsyncClient(timeout=2) as client:
            for _ in range(150):
                if process.poll() is not None:
                    raise AssertionError(
                        f"Owned worker {port} exited; see artifact log"
                    )
                try:
                    response = await client.post(
                        f"http://127.0.0.1:{port}/assistants/search",
                        json={"limit": 100},
                    )
                    if response.status_code == 200:
                        identity = (
                            await client.get(f"http://127.0.0.1:{port}/qa/runtime")
                        ).json()
                        assert (
                            identity["manager"] == "PostgresRunManager"
                            and identity["pid"] == process.pid
                        ), identity
                        return
                except httpx.RequestError:
                    pass
                await asyncio.sleep(0.1)
        raise AssertionError(f"Owned worker {port} did not become ready")

    async def stop_worker(self, port, *, crash=False):
        process = self.workers.pop(port)
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGCONT)
            os.killpg(process.pid, signal.SIGKILL if crash else signal.SIGTERM)
            try:
                await asyncio.wait_for(asyncio.to_thread(process.wait), 10)
            except TimeoutError:
                os.killpg(process.pid, signal.SIGKILL)
                await asyncio.to_thread(process.wait)
        self.record()

    async def start_validator(self):
        port = 3193
        listening = await asyncio.to_thread(
            subprocess.run,
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert not listening.stdout, (
            "Owned validator port is occupied; existing service preserved"
        )
        frontend = ROOT.parent / "1-fe-host"
        self.validator_baseline = {
            name: (frontend / name).read_bytes()
            for name in ("next-env.d.ts", "tsconfig.json")
        }
        with (self.artifact / "validator.log").open("w") as log:
            self.validator = await asyncio.to_thread(
                subprocess.Popen,
                [
                    "pnpm",
                    "exec",
                    "next",
                    "dev",
                    "--turbopack",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    str(port),
                ],
                cwd=frontend,
                env={**os.environ, "NEXT_DIST_DIR": self.validator_dist},
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        self.used_ports.add(port)
        self.process_history.append(
            {"port": port, "pid": self.validator.pid, "kind": "validator"}
        )
        self.record()
        async with httpx.AsyncClient(timeout=2) as client:
            for _ in range(100):
                if self.validator.poll() is not None:
                    raise AssertionError("Owned validator exited")
                try:
                    response = await client.post(
                        "http://127.0.0.1:3193/api/sec-ui/validate",
                        json={"program": 'root = Text("ready")'},
                    )
                    if response.status_code == 200 and response.json().get("valid"):
                        return
                except httpx.RequestError:
                    pass
                await asyncio.sleep(0.1)
        raise AssertionError("Owned validator did not become ready")

    async def close_validator(self):
        if self.validator is None:
            return
        if self.validator.poll() is None:
            os.killpg(self.validator.pid, signal.SIGTERM)
            try:
                await asyncio.wait_for(asyncio.to_thread(self.validator.wait), 10)
            except TimeoutError:
                os.killpg(self.validator.pid, signal.SIGKILL)
                await asyncio.to_thread(self.validator.wait)
        # pnpm can exit before its Next child flushes trace output. Wait for the
        # owned process group before deleting the cache, so it cannot reappear.
        for _ in range(100):
            processes=await asyncio.to_thread(subprocess.run,["ps","-axo","pid=,pgid=,command="],capture_output=True,text=True,check=True)
            members=[row for row in processes.stdout.splitlines() if len(row.split())>1 and row.split()[1]==str(self.validator.pid)]
            if not members:break
            await asyncio.sleep(.05)
        assert not members,"Owned validator children did not exit"
        frontend = ROOT.parent / "1-fe-host"
        path = frontend / "next-env.d.ts"
        text = path.read_text()
        if self.validator_dist in text:
            before = self.validator_baseline["next-env.d.ts"].decode()
            reference = re.search(r'/// <reference path="([^"]+)"', before)
            assert reference
            text = text.replace(
                f"./{self.validator_dist}/types/routes.d.ts", reference.group(1)
            )
            path.write_text(text)
        path = frontend / "tsconfig.json"
        text = path.read_text()
        token = re.escape(self.validator_dist + "/types/**/*.ts")
        text = re.sub(r'\n\s*"' + token + r'",', "", text)
        text = re.sub(r',\n\s*"' + token + r'"', "", text)
        json.loads(text)
        path.write_text(text)
        shutil.rmtree(frontend / self.validator_dist, ignore_errors=True)
        self.validator = None
        self.record()

    async def close(self):
        for port in list(self.workers):
            await self.stop_worker(port)
        await self.close_validator()
        if self.created:
            await asyncio.to_thread(
                subprocess.run,
                ["docker", "unpause", self.container],
                capture_output=True,
                check=False,
            )
            self.command(["docker", "rm", "-f", "-v", self.container])
            assert (
                await asyncio.to_thread(
                    subprocess.run,
                    ["docker", "inspect", self.container],
                    capture_output=True,
                    check=False,
                )
            ).returncode != 0
            self.created = False
        for port in self.used_ports:
            result = await asyncio.to_thread(
                subprocess.run,
                ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
                capture_output=True,
                check=False,
                text=True,
            )
            assert not result.stdout, f"Owned port {port} remains occupied"
        print(
            json.dumps({"cleanup": "PASS", "artifact": str(self.artifact)}), flush=True
        )


class Checks:
    def __init__(self, owned):
        self.owned = owned
        self.clients = {
            port: httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=15)
            for port in (3981, 3982)
        }
        self.evidence = []

    def passed(self, name, **details):
        self.evidence.append({"check": name, **details})
        (self.owned.artifact / "evidence.json").write_text(
            json.dumps(self.evidence, indent=2, default=str)
        )
        print(json.dumps(self.evidence[-1], default=str), flush=True)

    async def db(self):
        e = self.owned.env
        return await psycopg.AsyncConnection.connect(
            host=e["POSTGRES_HOST"],
            port=e["POSTGRES_PORT"],
            dbname=e["POSTGRES_DB"],
            user=e["POSTGRES_USER"],
            password=e["POSTGRES_PASSWORD"],
            autocommit=True,
            row_factory=dict_row,
            options="-c search_path=qa_multi,public",
            application_name="qa-multi-probe",
        )

    async def rows(self, query, parameters=()):
        async with await self.db() as connection:
            cursor = await connection.execute(query, parameters)
            return await cursor.fetchall() if cursor.description is not None else []

    async def api(self, port, method, path, *, expected=200, **kwargs):
        response = await self.clients[port].request(method, path, **kwargs)
        assert response.status_code == expected, (
            method,
            path,
            response.status_code,
            response.text[:1000],
        )
        return response.json() if response.content else None

    async def thread(self, port=3981, graph_id="qa_read_graph"):
        return (
            await self.api(
                port,
                "POST",
                "/threads",
                json={"metadata": {"source": "qa-multi", "graph_id": graph_id}},
            )
        )["thread_id"]

    async def create(self, tid, *, port=3981, delay=0.05, marker=None, **extra):
        marker = marker or uuid4().hex
        payload = {
            "assistant_id": "qa_read_graph",
            "input": {"marker": marker, "delay": delay},
            "stream_mode": ["values", "custom", "messages-tuple"],
            "stream_subgraphs": True,
            **extra,
        }
        run = await self.api(port, "POST", f"/threads/{tid}/runs", json=payload)
        return run, marker, payload

    async def status(self, tid, rid, statuses, *, port=3982, timeout=12):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            run = await self.api(port, "GET", f"/threads/{tid}/runs/{rid}")
            if run["status"] in statuses:
                return run
            await asyncio.sleep(0.05)
        raise AssertionError(f"Run {rid} did not reach {statuses}")

    async def terminal(self, tid, rid, **kwargs):
        return await self.status(
            tid, rid, {"success", "error", "interrupted"}, **kwargs
        )

    async def read_stream(self, tid, rid, *, port=3982, cursor=None):
        headers = {"Last-Event-ID": str(cursor)} if cursor is not None else {}
        response = await self.clients[port].get(
            f"/threads/{tid}/runs/{rid}/stream", headers=headers
        )
        response.raise_for_status()
        events = []
        for block in response.text.split("\n\n"):
            lines = block.splitlines()
            name = next(
                (line[7:] for line in lines if line.startswith("event: ")), None
            )
            data = next((line[6:] for line in lines if line.startswith("data: ")), None)
            sequence = next(
                (int(line[4:]) for line in lines if line.startswith("id: ")), None
            )
            if name and data:
                events.append({"event": name, "data": json.loads(data), "id": sequence})
        return events

    async def cross_worker(self):
        tid = await self.thread()
        run, marker, _ = await self.create(tid, delay=15)
        rid = run["run_id"]
        await self.status(tid, rid, {"running"}, port=3981)
        for _ in range(100):
            effects = await self.rows(
                "SELECT pid FROM qa_effects WHERE marker=%s AND phase='started'",
                (marker,),
            )
            if effects:
                break
            await asyncio.sleep(0.05)
        assert effects[0]["pid"] == self.owned.workers[3981].pid
        await self.owned.start_worker(3982)
        assert (await self.api(3982, "GET", f"/threads/{tid}/runs/{rid}"))[
            "status"
        ] == "running"
        state = await self.api(3982, "GET", f"/threads/{tid}/state")
        assert state["values"]["pid"] == self.owned.workers[3981].pid
        # Closing this B subscription does not cancel the A-owned task.
        async with self.clients[3982].stream(
            "GET", f"/threads/{tid}/runs/{rid}/stream"
        ) as response:
            response.raise_for_status()
            event_name = ""
            async for line in response.aiter_lines():
                if line.startswith("event: "):
                    event_name = line[7:]
                if (
                    line.startswith("data: ")
                    and marker in line
                    and event_name.startswith("custom")
                ):
                    break
        assert (await self.api(3982, "GET", f"/threads/{tid}/runs/{rid}"))[
            "status"
        ] == "running"
        await self.api(3982, "POST", f"/threads/{tid}/runs/{rid}/cancel?wait=true")
        assert (await self.terminal(tid, rid))["status"] == "interrupted"
        assert not await self.rows(
            "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='completed'", (marker,)
        )
        events = await self.read_stream(tid, rid)
        assert any(event["event"].startswith("custom") for event in events)
        assert events[-1]["event"] == "end"
        assert (await self.api(3981, "GET", f"/threads/{tid}/runs/{rid}"))[
            "status"
        ] == "interrupted"
        self.passed(
            "A execution / B state+SSE+cancel; B startup preserves live A",
            ownerPid=effects[0]["pid"],
            run=rid,
        )

    async def fifo_and_capacity(self):
        tid = await self.thread()
        first, m1, _ = await self.create(tid, delay=0.6)
        second, m2, _ = await self.create(tid, port=3982, delay=0.05)
        await self.api(
            3982,
            "POST",
            f"/threads/{tid}/runs",
            expected=409,
            json={
                "assistant_id": "qa_read_graph",
                "input": {"marker": uuid4().hex},
                "multitask_strategy": "reject",
            },
        )
        assert (await self.terminal(tid, first["run_id"]))["status"] == "success"
        assert (await self.terminal(tid, second["run_id"]))["status"] == "success"
        order = await self.rows(
            "SELECT marker,phase FROM qa_effects WHERE marker=ANY(%s) ORDER BY id",
            ([m1, m2],),
        )
        assert [(row["marker"], row["phase"]) for row in order] == [
            (m1, "started"),
            (m1, "completed"),
            (m2, "started"),
            (m2, "completed"),
        ], order
        tids = [await self.thread() for _ in range(5)]
        runs = []
        for i in range(4):
            runs.append((await self.create(tids[i], port=3981 + i % 2, delay=1.5))[0])
        response = await self.clients[3982].post(
            f"/threads/{tids[4]}/runs",
            json={
                "assistant_id": "qa_read_graph",
                "input": {"marker": uuid4().hex, "delay": 1.5},
            },
        )
        assert response.status_code == 429 and response.headers.get("retry-after")
        counts = await self.rows(
            "SELECT internal_status,count(*)::int AS n FROM runs WHERE runtime_namespace='qa-multi' AND internal_status!='terminal' GROUP BY internal_status"
        )
        active = sum(
            row["n"]
            for row in counts
            if row["internal_status"] in {"reserved", "running", "cancelling"}
        )
        queued = sum(row["n"] for row in counts if row["internal_status"] == "queued")
        assert active == 2 and queued == 2, counts
        for index, run in enumerate(runs):
            assert (await self.terminal(tids[index], run["run_id"]))[
                "status"
            ] == "success"
        self.passed(
            "Same-thread FIFO/reject; cross-process global2 active+2 queued/overflow429",
            active=active,
            queued=queued,
        )

    async def idempotency(self):
        tid = await self.thread()
        key = "qa-" + uuid4().hex
        payload = {
            "assistant_id": "qa_read_graph",
            "input": {"marker": key, "delay": 0.3},
            "request_id": key,
        }
        first, second = await asyncio.gather(
            *(
                self.api(port, "POST", f"/threads/{tid}/runs", json=payload)
                for port in (3981, 3982)
            )
        )
        assert first["run_id"] == second["run_id"], (first, second)
        await self.api(
            3982,
            "POST",
            f"/threads/{tid}/runs",
            expected=409,
            json={**payload, "input": {"marker": "different"}},
        )
        assert (await self.terminal(tid, first["run_id"]))["status"] == "success"
        rows = await self.rows(
            "SELECT phase,count(*)::int AS n FROM qa_effects WHERE marker=%s GROUP BY phase",
            (key,),
        )
        assert {row["phase"]: row["n"] for row in rows} == {
            "started": 1,
            "completed": 1,
        }, rows
        self.passed(
            "Concurrent A/B idempotency same payload once; conflicting payload409",
            run=first["run_id"],
        )

    async def bruno_contract(self):
        report = self.owned.artifact / "bruno.json"
        result = await asyncio.to_thread(
            subprocess.run,
            [
                str(ROOT / "node_modules/.bin/bru"),
                "run",
                "27-fastapi-multiworker",
                "--env-var",
                "workerA=http://127.0.0.1:3981",
                "--env-var",
                "workerB=http://127.0.0.1:3982",
                "--bail",
                "--reporter-json",
                str(report),
            ],
            cwd=ROOT / "bruno-api-tests",
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
        (self.owned.artifact / "bruno.log").write_text(result.stdout + result.stderr)
        assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-1000:]
        self.passed(
            "Bruno2-worker SDK-compatible contract11requests", report=str(report)
        )

    async def schemas_and_sdk_recovery(self):
        from langgraph_sdk import get_client

        expected = set(json.loads((ROOT / "langgraph.json").read_text())["graphs"])
        discovered = await self.api(
            3982, "POST", "/assistants/search", json={"limit": 100}
        )
        assert expected <= {row["graph_id"] for row in discovered}
        for gid in sorted(expected):
            schema = await self.api(3982, "GET", f"/assistants/{gid}/schemas")
            assert schema["input_schema"] and schema["output_schema"]
        client = get_client(url="http://127.0.0.1:3981")
        try:
            thread = await client.threads.create(
                metadata={"source": "qa-sdk-recovery", "graph_id": "qa_read_graph"}
            )
            tid = thread["thread_id"]
            marker = uuid4().hex
            events = []
            async for chunk in client.runs.stream(
                tid,
                "qa_read_graph",
                input={"marker": marker, "mode": "error", "delay": 0.05},
                stream_mode=["values", "messages-tuple", "custom"],
                stream_subgraphs=True,
            ):
                events.append(chunk.event)
            assert "error" in events and events[-1] == "end", events
            failed = (await self.api(3982, "GET", f"/threads/{tid}/runs"))[0]
            assert failed["status"] == "error"
            saved = await self.api(3982, "GET", f"/threads/{tid}/state")
            assert saved["values"]["marker"] == marker and saved["values"].get("pid")
            assert any(
                m.get("tool_call_id") == marker + "-tool"
                for m in saved["values"]["messages"]
            )
            next_marker = uuid4().hex
            result = await client.runs.wait(
                tid,
                "qa_read_graph",
                input={"marker": next_marker, "mode": "ok", "delay": 0.05},
            )
            assert result["completed"] == 1 and result["marker"] == next_marker
            assert (
                len(
                    await self.rows(
                        "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='started'",
                        (marker,),
                    )
                )
                == 1
            )
        finally:
            await client.aclose()
        self.passed(
            "All registered graph schemas / actual SDK error event then checkpoint restoration and next-turn recovery",
            graphs=len(expected),
        )

    async def locked_head_progress(self):
        blockers = []
        for port in (3981, 3982):
            tid = await self.thread()
            run, marker, _ = await self.create(tid, port=port, delay=15)
            await self.owner_for(marker)
            blockers.append((tid, run))
        head_tid = await self.thread()
        head, _, _ = await self.create(head_tid, delay=0.05)
        tail_tid = await self.thread()
        tail, _, _ = await self.create(tail_tid, port=3982, delay=0.05)
        async with await self.db() as connection, connection.transaction():
            await connection.execute(
                "SELECT thread_id FROM runtime_threads WHERE thread_id=%s FOR UPDATE",
                (head_tid,),
            )
            tid, run = blockers[0]
            await self.api(
                3982, "POST", f"/threads/{tid}/runs/{run['run_id']}/cancel?wait=true"
            )
            assert (await self.terminal(tail_tid, tail["run_id"]))[
                "status"
            ] == "success"
            assert (
                await self.api(
                    3982, "GET", f"/threads/{head_tid}/runs/{head['run_id']}"
                )
            )["status"] == "pending"
        assert (await self.terminal(head_tid, head["run_id"]))["status"] == "success"
        tid, run = blockers[1]
        await self.api(
            3982, "POST", f"/threads/{tid}/runs/{run['run_id']}/cancel?wait=true"
        )
        await self.terminal(tid, run["run_id"])
        self.passed(
            "Locked oldest thread is skipped; another thread progresses without waiting for its lock"
        )

    async def risky_review(self):
        tid = await self.thread(graph_id="qa_effect_graph")
        run, marker, _ = await self.create(
            tid, assistant_id="qa_effect_graph", delay=15
        )
        await self.owner_for(marker)
        queued, _, _ = await self.create(
            tid, port=3982, assistant_id="qa_effect_graph", delay=0.05
        )
        await self.api(
            3982, "POST", f"/threads/{tid}/runs/{run['run_id']}/cancel?wait=true"
        )
        assert (await self.terminal(tid, run["run_id"]))["status"] == "interrupted"
        control = (
            await self.rows(
                "SELECT blocked_reason FROM runtime_threads WHERE thread_id=%s", (tid,)
            )
        )[0]
        assert control["blocked_reason"]
        await asyncio.sleep(0.3)
        assert (await self.api(3982, "GET", f"/threads/{tid}/runs/{queued['run_id']}"))[
            "status"
        ] == "pending"
        await self.api(
            3982,
            "POST",
            f"/threads/{tid}/runtime/review",
            json={
                "acknowledge": True,
                "reason": "Owned fixture side effects reviewed; safe to proceed",
            },
        )
        assert (await self.terminal(tid, queued["run_id"]))["status"] == "success"
        self.passed(
            "Ambiguous side-effect interruption blocks follow-up until explicit operator review"
        )

    async def terminal_atomic_crash(self):
        tid = await self.thread()
        run, marker, _ = await self.create(tid, delay=1)
        rid = run["run_id"]
        owner = await self.owner_for(marker)
        survivor = 3982 if owner == 3981 else 3981
        # UUID comes from our own accepted run; no untrusted SQL identifiers.
        from uuid import UUID

        rid = str(UUID(rid))
        await self.rows(f"""CREATE FUNCTION qa_hold_terminal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event='end' AND NEW.run_id='{rid}'::uuid AND (SELECT status FROM runs WHERE run_id=NEW.run_id)='success' THEN PERFORM pg_sleep(8); END IF;
          RETURN NEW; END $$""")
        await self.rows(
            "CREATE TRIGGER qa_hold_terminal BEFORE INSERT ON runtime_events FOR EACH ROW EXECUTE FUNCTION qa_hold_terminal()"
        )
        try:
            for _ in range(100):
                sleeping = await self.rows(
                    "SELECT pid FROM pg_stat_activity WHERE datname='runtime_test' AND wait_event='PgSleep'"
                )
                if sleeping:
                    break
                await asyncio.sleep(0.05)
            assert sleeping, (
                "Owner did not reach the controlled pre-commit terminal boundary"
            )
            observed = (
                await self.rows(
                    "SELECT status,result,(SELECT count(*) FROM runtime_events WHERE run_id=%s AND event='end') AS ends FROM runs WHERE run_id=%s",
                    (rid, rid),
                )
            )[0]
            assert (
                observed["status"] == "running"
                and observed["result"] is None
                and observed["ends"] == 0
            ), observed
            await self.owned.stop_worker(owner, crash=True)
            settled = await self.terminal(tid, rid, port=survivor, timeout=15)
            assert settled["status"] == "interrupted"
            final = (
                await self.rows(
                    "SELECT status,result,(SELECT count(*) FROM runtime_events WHERE run_id=%s AND event='end') AS ends FROM runs WHERE run_id=%s",
                    (rid, rid),
                )
            )[0]
            assert (
                final["status"] == "interrupted"
                and final["result"] is None
                and final["ends"] == 1
            ), final
            # The completed checkpoint is not enough to promote an abandoned run.
            state = await self.api(survivor, "GET", f"/threads/{tid}/state")
            assert state["values"]["completed"] == 1
        finally:
            await self.rows("DROP TRIGGER IF EXISTS qa_hold_terminal ON runtime_events")
            await self.rows("DROP FUNCTION IF EXISTS qa_hold_terminal()")
            if owner not in self.owned.workers:
                await self.owned.start_worker(owner)
        self.passed(
            "SIGKILL before terminal commit rolls back status/result/end together; completed checkpoint is not success"
        )

    async def cancel_races_and_control(self):
        for _ in range(5):
            tid = await self.thread()
            run, marker, _ = await self.create(tid, delay=0.8)
            await self.api(
                3982, "POST", f"/threads/{tid}/runs/{run['run_id']}/cancel?wait=true"
            )
            assert (await self.terminal(tid, run["run_id"]))["status"] == "interrupted"
            assert not await self.rows(
                "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='completed'",
                (marker,),
            )
        tid = await self.thread()
        run, _, _ = await self.create(tid, delay=0.6)
        await self.status(tid, run["run_id"], {"running"})
        for method, path, body in [
            ("POST", f"/threads/{tid}/state", {"values": {"completed": 99}}),
            ("DELETE", f"/threads/{tid}", None),
        ]:
            response = await self.clients[3982].request(method, path, json=body)
            assert response.status_code == 409, (response.status_code, response.text)
        await self.terminal(tid, run["run_id"])
        changed = await self.api(
            3982, "POST", f"/threads/{tid}/state", json={"values": {"completed": 12}}
        )
        assert changed["checkpoint"]["checkpoint_id"]
        assert (await self.api(3981, "GET", f"/threads/{tid}/state"))["values"][
            "completed"
        ] == 12
        await self.api(3982, "DELETE", f"/threads/{tid}", expected=204)
        await self.api(3981, "GET", f"/threads/{tid}", expected=404)
        assert not await self.rows(
            "SELECT 1 FROM checkpoints WHERE thread_id=%s", (tid,)
        )
        self.passed(
            "Five claim/cancel races; active state/delete rejected; idle cross-worker control atomic"
        )

    async def owner_for(self, marker):
        for _ in range(150):
            rows = await self.rows(
                "SELECT pid FROM qa_effects WHERE marker=%s AND phase='started'",
                (marker,),
            )
            if rows:
                pid = rows[0]["pid"]
                return next(
                    port
                    for port, process in self.owned.workers.items()
                    if process.pid == pid
                )
            await asyncio.sleep(0.05)
        raise AssertionError("Fixture graph did not start")

    async def stopped_owner_lease(self):
        tid = await self.thread()
        run, marker, _ = await self.create(tid, delay=4)
        rid = run["run_id"]
        owner = await self.owner_for(marker)
        survivor = 3982 if owner == 3981 else 3981
        # Let the prepare checkpoint finish before stopping a pure graph wait.
        for _ in range(100):
            state = await self.api(survivor, "GET", f"/threads/{tid}/state")
            if state["values"].get("pid"):
                break
            await asyncio.sleep(0.05)
        old = (await self.rows("SELECT * FROM runs WHERE run_id=%s", (rid,)))[0]
        queued, next_marker, _ = await self.create(tid, port=survivor, delay=0.05)
        os.killpg(self.owned.workers[owner].pid, signal.SIGSTOP)
        try:
            assert (await self.terminal(tid, rid, port=survivor, timeout=15))[
                "status"
            ] == "interrupted"
            assert (
                await self.terminal(tid, queued["run_id"], port=survivor, timeout=15)
            )["status"] == "success"
        finally:
            os.killpg(self.owned.workers[owner].pid, signal.SIGCONT)
        await asyncio.sleep(1)
        assert (await self.api(survivor, "GET", f"/threads/{tid}/runs/{rid}"))[
            "status"
        ] == "interrupted"
        final = await self.api(survivor, "GET", f"/threads/{tid}/state")
        assert final["values"]["marker"] == next_marker
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='started'",
                    (marker,),
                )
            )
            == 1
        )
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='started'",
                    (next_marker,),
                )
            )
            == 1
        )
        await self.stale_saver_probe(tid, old)
        self.passed(
            "SIGSTOP lease expiry / queued resume / old OS owner returns without publishing stale state",
            oldRun=rid,
            owner=owner,
        )

    async def stale_saver_probe(self, tid, old):
        from langgraph.checkpoint.base import empty_checkpoint
        from psycopg.conninfo import make_conninfo
        from psycopg_pool import AsyncConnectionPool

        from infrastructure.postgres.fenced_saver import (
            CheckpointAuthority,
            CheckpointOwnershipLost,
            FencedAsyncPostgresSaver,
            checkpoint_authority,
        )
        from infrastructure.postgres.runtime_queue import RuntimeQueue

        e = self.owned.env
        pool = AsyncConnectionPool(
            make_conninfo(
                host=e["POSTGRES_HOST"],
                port=e["POSTGRES_PORT"],
                dbname=e["POSTGRES_DB"],
                user=e["POSTGRES_USER"],
                password=e["POSTGRES_PASSWORD"],
            ),
            kwargs={
                "autocommit": True,
                "row_factory": dict_row,
                "prepare_threshold": 0,
                "options": "-c search_path=qa_multi,public",
            },
            min_size=1,
            max_size=2,
            open=False,
        )
        await pool.open()
        try:
            queue = RuntimeQueue(pool, "qa-multi", 2, 2, 3)
            saver = FencedAsyncPostgresSaver(pool, queue.guard_write)
            config = {"configurable": {"thread_id": tid, "checkpoint_ns": ""}}
            snapshot = await saver.aget_tuple(config)
            before = await self.rows(
                "SELECT checkpoint_id FROM checkpoints WHERE thread_id=%s ORDER BY checkpoint_id",
                (tid,),
            )
            authority = CheckpointAuthority(
                tid, str(old["run_id"]), str(old["owner_id"]), old["execution_epoch"]
            )
            for operation in ("checkpoint", "pending"):
                rejected = False
                try:
                    with checkpoint_authority(authority):
                        if operation == "checkpoint":
                            await saver.aput(config, empty_checkpoint(), {}, {})
                        else:
                            await saver.aput_writes(
                                snapshot.config,
                                [("stale_probe", "DENIED")],
                                "late-owner",
                            )
                except CheckpointOwnershipLost:
                    rejected = True
                assert rejected, operation
            assert before == await self.rows(
                "SELECT checkpoint_id FROM checkpoints WHERE thread_id=%s ORDER BY checkpoint_id",
                (tid,),
            )
            assert not await self.rows(
                "SELECT 1 FROM checkpoint_writes WHERE thread_id=%s AND task_id='late-owner'",
                (tid,),
            )
        finally:
            await pool.close()

    async def crash_and_queued_restart(self):
        tid = await self.thread()
        run, marker, _ = await self.create(tid, delay=30)
        owner = await self.owner_for(marker)
        survivor = 3982 if owner == 3981 else 3981
        queued, next_marker, _ = await self.create(tid, port=survivor, delay=0.05)
        await self.owned.stop_worker(owner, crash=True)
        assert (await self.terminal(tid, run["run_id"], port=survivor, timeout=15))[
            "status"
        ] == "interrupted"
        assert (await self.terminal(tid, queued["run_id"], port=survivor, timeout=15))[
            "status"
        ] == "success"
        await self.owned.start_worker(owner)
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='started'",
                    (marker,),
                )
            )
            == 1
        )
        assert not await self.rows(
            "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='completed'", (marker,)
        )
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='completed'",
                    (next_marker,),
                )
            )
            == 1
        )
        self.passed(
            "SIGKILL running owner; durable queued work resumes once; running task is never automatically retried"
        )

    async def notify_polling_and_retention(self):
        # Stop/restart B without LISTEN: event reads must still work from DB polling.
        await self.owned.stop_worker(3982)
        self.owned.env["LANGGRAPH_RUNTIME_LISTEN"] = "false"
        await self.owned.start_worker(3982)
        tid = await self.thread()
        run, _, _ = await self.create(tid, delay=0.1)
        assert (await self.terminal(tid, run["run_id"]))["status"] == "success"
        events = await self.read_stream(tid, run["run_id"])
        ids = [event["id"] for event in events if event["id"] is not None]
        assert ids == sorted(set(ids))
        assert events[-1]["event"] == "end"
        cursor = ids[len(ids) // 2]
        replay = await self.read_stream(tid, run["run_id"], cursor=cursor)
        assert all(event["id"] > cursor for event in replay if event["id"] is not None)
        burst_tid = await self.thread()
        burst, _, _ = await self.create(
            burst_tid,
            input={
                "marker": uuid4().hex,
                "delay": 0.05,
                "events": 300,
                "bytes_per_event": 40000,
            },
        )
        assert (await self.terminal(burst_tid, burst["run_id"]))["status"] == "success"
        retained = await self.rows(
            "SELECT count(*)::int AS n,coalesce(sum(size_bytes),0)::bigint AS bytes FROM runtime_events WHERE run_id=%s",
            (burst["run_id"],),
        )
        assert retained[0]["n"] <= 256 and retained[0]["bytes"] <= 8 * 1024 * 1024, (
            retained
        )
        gap = await self.read_stream(burst_tid, burst["run_id"], cursor=0)
        assert any(
            event["event"] == "error"
            and event["data"].get("error") == "stream_buffer_gap"
            for event in gap
        ), gap[:2]
        assert gap[-1]["event"] == "end"
        assert (await self.api(3982, "GET", f"/threads/{burst_tid}/state"))["values"][
            "completed"
        ] == 1
        await self.rows(
            "UPDATE runs SET updated_at=clock_timestamp()-interval '61 seconds' WHERE run_id=%s RETURNING run_id",
            (run["run_id"],),
        )
        # Dispatcher cleanup runs every10 polls; wait for the terminal log to expire.
        for _ in range(100):
            if not await self.rows(
                "SELECT 1 FROM runtime_events WHERE run_id=%s", (run["run_id"],)
            ):
                break
            await asyncio.sleep(0.1)
        restored = await self.read_stream(tid, run["run_id"])
        assert (
            any(event["event"] == "values" for event in restored)
            and restored[-1]["event"] == "end"
        )
        self.passed(
            "LISTEN disabled / DB polling / durable cursor / strict byte-event retention / gap+end / TTL final-state fallback",
            retained=retained[0],
        )

    async def canvas_sdk_contract(self):
        from langgraph_sdk import get_client

        await self.owned.start_validator()
        a = get_client(url="http://127.0.0.1:3981")
        b = get_client(url="http://127.0.0.1:3982")
        try:
            thread = await a.threads.create(
                metadata={
                    "source": "qa-canvas-multi",
                    "graph_id": "technical_analysis_canvas_agent",
                }
            )
            tid = thread["thread_id"]
            run = await a.runs.create(
                tid,
                "technical_analysis_canvas_agent",
                input={
                    "messages": [
                        {
                            "role": "human",
                            "content": "고정 fixture 지표를 설명해 주세요.",
                        }
                    ],
                    "canvas_context": {
                        "request": {
                            "ticker": "TEST",
                            "interval": "1d",
                            "count": 60,
                            "indicators": [{"name": "SMA"}, {"name": "RSI"}],
                        }
                    },
                },
                stream_mode=["values", "custom"],
            )
            custom = []
            values = None
            async for chunk in b.runs.join_stream(tid, run["run_id"]):
                if chunk.event == "custom" and chunk.data.get("channel") == "canvas":
                    custom.append(chunk.data)
                elif chunk.event == "values":
                    values = chunk.data
                elif chunk.event == "error":
                    raise AssertionError(chunk.data)
            ready = next(event for event in custom if event["type"] == "ready")
            report = values["canvas_reports"][ready["reportId"]]
            assert report["status"] == "ready" and report["request"]["count"] == 60
            assert [event["type"] for event in custom][-2:] == ["validating", "ready"]
            assert (
                "IndicatorControls(" in report["program"]
                and "Query(" in report["program"]
            )
            validation = await self.clients[3982].post(
                "http://127.0.0.1:3193/api/sec-ui/validate",
                json={"program": report["program"]},
            )
            validation.raise_for_status()
            assert validation.json()["valid"], validation.json()
            restored = await b.threads.get_state(tid)
            assert (
                restored["values"]["canvas_reports"][ready["reportId"]]["program"]
                == report["program"]
            )
            calls = [
                await self.api(port, "GET", "/qa/canvas-model") for port in (3981, 3982)
            ]
            assert sum(row["calls"] for row in calls) == 1, calls
            self.passed(
                "Actual Canvas workflow with fixed model/OHLCV: SDK A creates/B streams ready; OpenUI parser and durable report unchanged",
                report=ready["reportId"],
                model="fixture only",
                chars=len(report["program"]),
            )
        finally:
            await asyncio.gather(a.aclose(), b.aclose())

    async def database_disconnect(self):
        tid = await self.thread()
        run, marker, _ = await self.create(tid, delay=30)
        await self.owner_for(marker)
        queued, next_marker, _ = await self.create(tid, port=3982, delay=0.05)
        await asyncio.to_thread(
            self.owned.command, ["docker", "stop", "--time", "1", self.owned.container]
        )
        try:
            await asyncio.sleep(1)
            response = await self.clients[3982].post(
                f"/threads/{tid}/runs",
                json={
                    "assistant_id": "qa_read_graph",
                    "input": {"marker": "must-not-run"},
                },
                timeout=3,
            )
            assert response.status_code == 503, response.status_code
        finally:
            await asyncio.to_thread(
                self.owned.command, ["docker", "start", self.owned.container]
            )
            port = (
                self.owned.command(["docker", "port", self.owned.container, "5432/tcp"])
                .stdout.strip()
                .split(":")[-1]
            )
            assert port == self.owned.env["POSTGRES_PORT"], (
                "Fixture host port changed across restart"
            )
            for _ in range(100):
                try:
                    await self.rows("SELECT 1")
                    break
                except psycopg.OperationalError:
                    await asyncio.sleep(0.1)
            else:
                raise AssertionError("Owned PostgreSQL failed to restart")
        assert (await self.terminal(tid, run["run_id"], timeout=30))[
            "status"
        ] == "interrupted"
        assert (await self.terminal(tid, queued["run_id"], timeout=30))[
            "status"
        ] == "success"
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='started'",
                    (marker,),
                )
            )
            == 1
        )
        assert not await self.rows(
            "SELECT 1 FROM qa_effects WHERE marker='must-not-run'"
        )
        assert (
            len(
                await self.rows(
                    "SELECT 1 FROM qa_effects WHERE marker=%s AND phase='completed'",
                    (next_marker,),
                )
            )
            == 1
        )
        self.passed(
            "Owned PostgreSQL stop/start; admission503/fail-closed; running not retried; queued preserved"
        )

    async def close(self):
        await asyncio.gather(*(client.aclose() for client in self.clients.values()))


async def main():
    owned = OwnedRuntime()
    try:
        await owned.prepare_database()
        if os.getenv("MULTIWORKER_PREFLIGHT") == "concurrent":
            await asyncio.gather(owned.start_worker(3981), owned.start_worker(3982))
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get("http://127.0.0.1:3982/health/runtime")
                response.raise_for_status()
                health = response.json()
                assert (
                    health["mode"] == "postgres" and health["namespace"] == "qa-multi"
                )
                assert health["executionVersion"] == "qa-v1"
                assert health["limits"] == {"active": 2, "queued": 2}
                assert health["counts"]["active"] == health["counts"]["queued"] == 0
                assert isinstance(health["blockedVersions"], list) and isinstance(
                    health["listenerConnected"], bool
                )
                assert health["workers"]["live"] == 2
                (owned.artifact / "health.json").write_text(
                    json.dumps(health, indent=2)
                )
            print(
                json.dumps(
                    {
                        "preflight": "concurrent first startup PASS",
                        "healthRuntime": "PASS",
                    }
                ),
                flush=True,
            )
            return
        await owned.start_worker(3981)
        if os.getenv("MULTIWORKER_PREFLIGHT") == "1":
            await owned.start_worker(3982)
            print(
                json.dumps({"preflight": "two official app processes ready"}),
                flush=True,
            )
            return
        checks = Checks(owned)
        names = [
            "cross_worker",
            "fifo_and_capacity",
            "idempotency",
            "bruno_contract",
            "schemas_and_sdk_recovery",
            "cancel_races_and_control",
            "locked_head_progress",
            "risky_review",
            "stopped_owner_lease",
            "crash_and_queued_restart",
            "notify_polling_and_retention",
            "database_disconnect",
            "terminal_atomic_crash",
            "canvas_sdk_contract",
        ]
        start_at = os.getenv("MULTIWORKER_START_AT", names[0])
        assert start_at in names, start_at
        if start_at != names[0]:
            await owned.start_worker(3982)
        try:
            for name in names[names.index(start_at) :]:
                await getattr(checks, name)()
                if os.getenv("MULTIWORKER_SMOKE") == "1" and name == "bruno_contract":
                    break
        finally:
            await checks.close()
    finally:
        await owned.close()


if __name__ == "__main__":
    asyncio.run(main())
