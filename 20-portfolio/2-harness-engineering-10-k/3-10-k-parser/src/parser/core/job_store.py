from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

TERMINAL_STATUSES = {"completed", "completed_with_errors", "failed"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InMemoryJobStore:
    def __init__(self, *, max_jobs: int = 1000, ttl_seconds: int = 86400) -> None:
        self.max_jobs = max(1, max_jobs)
        self.ttl_seconds = max(1, ttl_seconds)
        self._jobs: dict[str, dict[str, Any]] = {}
        self._updated_at: dict[str, float] = {}
        self._lock = threading.Lock()

    def set(self, job_id: str, **updates: Any) -> dict[str, Any]:
        now = time.time()
        with self._lock:
            record = self._jobs.setdefault(job_id, {"jobId": job_id})
            record.update(updates)
            self._updated_at[job_id] = now
            self._evict_locked(now)
            return dict(record)

    def get(self, job_id: str) -> dict[str, Any] | None:
        now = time.time()
        with self._lock:
            self._evict_locked(now)
            record = self._jobs.get(job_id)
            return dict(record) if record is not None else None

    def stats(self) -> dict[str, int]:
        now = time.time()
        with self._lock:
            self._evict_locked(now)
            terminal_count = sum(1 for record in self._jobs.values() if self._is_terminal(record))
            return {
                "jobs": len(self._jobs),
                "terminalJobs": terminal_count,
                "maxJobs": self.max_jobs,
                "ttlSeconds": self.ttl_seconds,
            }

    def _evict_locked(self, now: float) -> None:
        expired_job_ids = [
            job_id
            for job_id, record in self._jobs.items()
            if self._is_terminal(record)
            and now - self._updated_at.get(job_id, now) >= self.ttl_seconds
        ]
        for job_id in expired_job_ids:
            self._delete_locked(job_id)

        overflow = len(self._jobs) - self.max_jobs
        if overflow <= 0:
            return

        terminal_jobs = sorted(
            (
                (self._updated_at.get(job_id, 0), job_id)
                for job_id, record in self._jobs.items()
                if self._is_terminal(record)
            ),
            key=lambda item: item[0],
        )
        for _, job_id in terminal_jobs[:overflow]:
            self._delete_locked(job_id)

    def _delete_locked(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)
        self._updated_at.pop(job_id, None)

    @staticmethod
    def _is_terminal(record: dict[str, Any]) -> bool:
        return record.get("status") in TERMINAL_STATUSES
