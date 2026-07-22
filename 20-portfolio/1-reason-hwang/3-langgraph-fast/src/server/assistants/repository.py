"""Thread-safe in-process metadata repository for assistant versions.

The repository deliberately owns no checkpoint data.  Consequently deleting an
assistant, including with ``delete_threads=true``, cannot delete checkpoints.
It can be replaced later with a durable implementation through the router hook.
"""

from copy import deepcopy
from datetime import UTC, datetime
from threading import RLock
from uuid import UUID, uuid4

from server.assistants.models import (
    Assistant,
    AssistantCountRequest,
    AssistantCreate,
    AssistantPatch,
    AssistantSearchRequest,
    AssistantVersionsSearchRequest,
)


class AssistantAlreadyExistsError(Exception):
    pass


class AssistantNotFoundError(Exception):
    pass


class AssistantVersionNotFoundError(Exception):
    pass


class InMemoryAssistantRepository:
    """Store immutable assistant versions and a movable latest pointer."""

    def __init__(self) -> None:
        self._versions: dict[UUID, list[Assistant]] = {}
        self._latest: dict[UUID, int] = {}
        self._lock = RLock()

    def export_state(self) -> dict[str, object]:
        with self._lock:
            return {
                "versions": {
                    str(key): [item.model_dump(mode="json") for item in values]
                    for key, values in self._versions.items()
                },
                "latest": {str(key): value for key, value in self._latest.items()},
            }

    def import_state(self, state: dict[str, object]) -> None:
        versions = state.get("versions")
        latest = state.get("latest")
        if not isinstance(versions, dict) or not isinstance(latest, dict):
            return
        with self._lock:
            self._versions = {
                UUID(key): [Assistant.model_validate(item) for item in values]
                for key, values in versions.items()
                if isinstance(key, str) and isinstance(values, list)
            }
            self._latest = {
                UUID(key): int(value)
                for key, value in latest.items()
                if isinstance(key, str) and isinstance(value, int)
            }

    def create(self, payload: AssistantCreate) -> Assistant:
        with self._lock:
            assistant_id = payload.assistant_id or uuid4()
            if assistant_id in self._versions:
                if payload.if_exists == "do_nothing":
                    return self._current(assistant_id)
                raise AssistantAlreadyExistsError(str(assistant_id))

            now = datetime.now(UTC)
            assistant = Assistant(
                assistant_id=assistant_id,
                graph_id=payload.graph_id,
                config=deepcopy(payload.config),
                context=deepcopy(payload.context),
                created_at=now,
                updated_at=now,
                metadata=deepcopy(payload.metadata),
                version=1,
                name=payload.name,
                description=payload.description,
            )
            self._versions[assistant_id] = [assistant]
            self._latest[assistant_id] = 1
            return assistant.model_copy(deep=True)

    def get(self, assistant_id: UUID) -> Assistant:
        with self._lock:
            return self._current(assistant_id)

    def patch(self, assistant_id: UUID, payload: AssistantPatch) -> Assistant:
        with self._lock:
            current = self._current(assistant_id)
            changes = payload.model_dump(exclude_unset=True)
            if "metadata" in changes:
                changes["metadata"] = {
                    **current.metadata,
                    **(changes["metadata"] or {}),
                }
            changes["version"] = len(self._versions[assistant_id]) + 1
            changes["updated_at"] = datetime.now(UTC)
            updated = current.model_copy(update=changes, deep=True)
            self._versions[assistant_id].append(updated)
            self._latest[assistant_id] = updated.version
            return updated.model_copy(deep=True)

    def delete(self, assistant_id: UUID, *, delete_threads: bool = False) -> None:
        del delete_threads
        with self._lock:
            if assistant_id not in self._versions:
                raise AssistantNotFoundError(str(assistant_id))
            del self._versions[assistant_id]
            del self._latest[assistant_id]

    def search(self, request: AssistantSearchRequest) -> list[dict]:
        with self._lock:
            assistants = [self._current(key) for key in self._versions]
            assistants = self._filter(
                assistants, request.metadata, request.graph_id, request.name
            )
            if request.sort_by:
                sort_by = request.sort_by
                assistants.sort(
                    key=lambda item: getattr(item, sort_by),
                    reverse=request.sort_order == "desc",
                )
            result = assistants[request.offset : request.offset + request.limit]
            return [
                item.model_dump(include=set(request.select) if request.select else None)
                for item in result
            ]

    def count(self, request: AssistantCountRequest) -> int:
        with self._lock:
            assistants = [self._current(key) for key in self._versions]
            return len(
                self._filter(
                    assistants, request.metadata, request.graph_id, request.name
                )
            )

    def versions(
        self, assistant_id: UUID, request: AssistantVersionsSearchRequest
    ) -> list[Assistant]:
        with self._lock:
            versions = list(reversed(self._versions.get(assistant_id, [])))
            if request.metadata:
                versions = [
                    item
                    for item in versions
                    if all(item.metadata.get(k) == v for k, v in request.metadata.items())
                ]
            return [
                item.model_copy(deep=True)
                for item in versions[request.offset : request.offset + request.limit]
            ]

    def set_latest(self, assistant_id: UUID, version: int) -> Assistant:
        with self._lock:
            if assistant_id not in self._versions:
                raise AssistantNotFoundError(str(assistant_id))
            if version < 1 or version > len(self._versions[assistant_id]):
                raise AssistantVersionNotFoundError(str(version))
            self._latest[assistant_id] = version
            return self._current(assistant_id)

    def _current(self, assistant_id: UUID) -> Assistant:
        try:
            version = self._latest[assistant_id]
            return self._versions[assistant_id][version - 1].model_copy(deep=True)
        except KeyError as exc:
            raise AssistantNotFoundError(str(assistant_id)) from exc

    @staticmethod
    def _filter(
        assistants: list[Assistant],
        metadata: dict | None,
        graph_id: str | None,
        name: str | None,
    ) -> list[Assistant]:
        if metadata:
            assistants = [
                item
                for item in assistants
                if all(item.metadata.get(k) == v for k, v in metadata.items())
            ]
        if graph_id:
            assistants = [item for item in assistants if item.graph_id == graph_id]
        if name:
            needle = name.casefold()
            assistants = [item for item in assistants if needle in item.name.casefold()]
        return assistants
