"""Bounded durable run events; PostgreSQL is the stream's source of truth."""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from psycopg.types.json import Jsonb


class RuntimeEventTooLarge(ValueError):
    pass


@dataclass
class _Subscription:
    event: asyncio.Event = field(default_factory=asyncio.Event)
    revision: int = 0
    users: int = 0


class RuntimeEvents:
    def __init__(
        self,
        pool: Any,
        namespace: str,
        max_bytes: int = 8 * 1024 * 1024,
        max_events: int = 256,
        ttl: int = 60,
        max_event_bytes: int = 16 * 1024 * 1024,
        poll_seconds: float | None = None,
    ) -> None:
        self.pool = pool
        self.namespace = namespace
        self.max_bytes = max_bytes
        self.max_events = max_events
        self.ttl = ttl
        self.max_event_bytes = max_event_bytes
        self.poll_seconds = (
            float(os.getenv("LANGGRAPH_POLL_SECONDS", "1"))
            if poll_seconds is None
            else poll_seconds
        )
        if not 0.05 <= self.poll_seconds <= 10:
            raise ValueError("Invalid runtime event polling interval")
        self._subscriptions: dict[str, _Subscription] = {}
        self._closed = False

    def notify(self, run_id: str) -> None:
        """A commit hint only: never cache event data or create unused entries."""
        subscription = self._subscriptions.get(str(run_id))
        if subscription is not None:
            subscription.revision += 1
            subscription.event.set()

    def notify_all(self) -> None:
        # Reconnect/close must cause every current subscriber to recheck DB state.
        for run_id in tuple(self._subscriptions):
            self.notify(run_id)

    def close(self) -> None:
        self._closed = True
        self.notify_all()

    async def _wait(self, subscription: _Subscription, revision: int) -> None:
        if self._closed or subscription.revision != revision:
            return
        subscription.event.clear()
        try:
            await asyncio.wait_for(subscription.event.wait(), self.poll_seconds)
        except TimeoutError:
            pass

    async def append_locked(
        self, conn: Any, run_id: str, epoch: int, events: list[tuple[str, Any]]
    ) -> list[int]:
        """Caller owns run lock and valid ownership in this SAME transaction."""
        sequences = []
        for kind, payload in events:
            if not kind or any(char in kind for char in "\r\n"):
                raise ValueError("Invalid runtime event name")
            encoded = json.dumps(payload, ensure_ascii=False, default=str)
            size = len(encoded.encode())
            if size > self.max_event_bytes:
                raise RuntimeEventTooLarge(
                    "Runtime event exceeds the configured size limit"
                )
            cursor = await conn.execute(
                "UPDATE runs SET event_seq=event_seq+1 WHERE run_id=%s AND runtime_namespace=%s RETURNING event_seq",
                (run_id, self.namespace),
            )
            row = await cursor.fetchone()
            if row is None:
                raise LookupError("Runtime run not found")
            sequence = row["event_seq"]
            await conn.execute(
                "INSERT INTO runtime_events(run_id,sequence,execution_epoch,event,namespace,payload,size_bytes,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,clock_timestamp())",
                (
                    run_id,
                    sequence,
                    epoch,
                    kind,
                    kind.split("|")[1:],
                    Jsonb(json.loads(encoded)),
                    size,
                ),
            )
            sequences.append(sequence)
        # Retention is strict, including a single event larger than the budget.
        # Consumers receive an explicit cursor gap instead of silent truncation.
        await conn.execute(
            """DELETE FROM runtime_events WHERE run_id=%s AND sequence IN (
                SELECT sequence FROM (
                    SELECT sequence,row_number() OVER(ORDER BY sequence DESC) AS rank,
                    sum(size_bytes) OVER(ORDER BY sequence DESC) AS bytes
                    FROM runtime_events WHERE run_id=%s
                ) retained WHERE rank>%s OR bytes>%s
            )""",
            (run_id, run_id, self.max_events, self.max_bytes),
        )
        await conn.execute(
            "UPDATE runs SET event_bytes=(SELECT COALESCE(sum(size_bytes),0) FROM runtime_events WHERE run_id=%s) WHERE run_id=%s",
            (run_id, run_id),
        )
        if sequences:
            await conn.execute(
                "SELECT pg_notify('langgraph_runtime_events',%s)", (str(run_id),)
            )
        return sequences

    async def read(
        self, run_id: str, after: int = 0, limit: int = 100
    ) -> dict[str, Any]:
        if after < 0 or not 1 <= limit <= 1000:
            raise ValueError("Invalid event cursor or page size")
        async with self.pool.connection() as conn, conn.transaction():
            cursor = await conn.execute(
                "SELECT * FROM runs WHERE run_id=%s AND runtime_namespace=%s FOR SHARE",
                (run_id, self.namespace),
            )
            row = await cursor.fetchone()
            if row is None:
                return {
                    "run": None,
                    "events": [],
                    "gap": False,
                    "oldestCursor": 0,
                    "latestCursor": 0,
                }
            run = dict(row)
            cursor = await conn.execute(
                "SELECT min(sequence) AS oldest FROM runtime_events WHERE run_id=%s",
                (run_id,),
            )
            first = await cursor.fetchone()
            oldest = first["oldest"] or int(run["event_seq"]) + 1
            cursor = await conn.execute(
                "SELECT sequence,event,namespace,payload FROM runtime_events WHERE run_id=%s AND sequence>%s ORDER BY sequence LIMIT %s",
                (run_id, after, limit),
            )
            return {
                "run": run,
                "events": [dict(event) for event in await cursor.fetchall()],
                "gap": after < oldest - 1,
                "oldestCursor": oldest,
                "latestCursor": int(run["event_seq"]),
            }

    @staticmethod
    def _sse(kind: str, payload: Any, sequence: int | None = None) -> str:
        prefix = f"id: {sequence}\n" if sequence is not None else ""
        return f"{prefix}event: {kind}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"

    async def stream(
        self, run: dict[str, Any] | str, cursor: int = 0
    ) -> AsyncIterator[str]:
        run_id = str(run["run_id"]) if isinstance(run, dict) else str(run)
        subscription = self._subscriptions.setdefault(run_id, _Subscription())
        subscription.users += 1
        try:
            async for frame in self._stream(run_id, cursor, subscription):
                yield frame
        finally:
            subscription.users -= 1
            if (
                subscription.users == 0
                and self._subscriptions.get(run_id) is subscription
            ):
                del self._subscriptions[run_id]

    async def _stream(
        self, run_id: str, cursor: int, subscription: _Subscription
    ) -> AsyncIterator[str]:
        yield self._sse("metadata", {"run_id": run_id})
        ended = False
        heartbeat = asyncio.get_running_loop().time()
        while not self._closed:
            revision = subscription.revision
            page = await self.read(run_id, cursor)
            current = page["run"]
            if current is None:
                yield self._sse("error", {"message": "Run no longer exists"})
                yield self._sse("end", {})
                return
            if (
                current["internal_status"] == "terminal"
                and not page["events"]
                and cursor == 0
            ):
                # Retention expiry must not remove the durable final snapshot.
                yield self._sse("values", current.get("result"))
                yield self._sse("end", {})
                return
            if page["gap"]:
                yield self._sse(
                    "error",
                    {
                        "error": "stream_buffer_gap",
                        "after": cursor,
                        "oldest": page["oldestCursor"],
                        "latest": page["latestCursor"],
                        "message": "Fetch thread state to recover latest values",
                    },
                )
                yield self._sse("end", {})
                return
            for event in page["events"]:
                cursor = event["sequence"]
                ended = ended or event["event"] == "end"
                yield self._sse(event["event"], event["payload"], cursor)
            if (
                current["internal_status"] == "terminal"
                and cursor >= page["latestCursor"]
            ):
                if not ended:
                    yield self._sse("end", {})
                return
            if ended:
                return
            if cursor < page["latestCursor"]:
                continue
            now = asyncio.get_running_loop().time()
            if now - heartbeat >= 10:
                heartbeat = now
                yield ": heartbeat\n\n"
            await self._wait(subscription, revision)

    async def prune(self) -> None:
        async with self.pool.connection() as conn, conn.transaction():
            await conn.execute(
                """DELETE FROM runtime_events events USING runs
                WHERE events.run_id=runs.run_id AND runs.runtime_namespace=%s
                AND runs.internal_status='terminal'
                AND runs.updated_at<clock_timestamp()-(%s * interval '1 second')""",
                (self.namespace, self.ttl),
            )
            await conn.execute(
                """UPDATE runs SET event_bytes=0 WHERE runtime_namespace=%s
                AND internal_status='terminal'
                AND updated_at<clock_timestamp()-(%s * interval '1 second')""",
                (self.namespace, self.ttl),
            )
