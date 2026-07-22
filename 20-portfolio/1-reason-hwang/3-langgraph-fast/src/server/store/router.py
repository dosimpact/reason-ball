from __future__ import annotations

from datetime import UTC, datetime, timedelta
from threading import RLock
from typing import Any, Protocol

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/store", tags=["Store"])


class StorePutRequest(BaseModel):
    namespace: list[str]
    key: str
    value: dict[str, Any]
    index: bool | list[str] | None = None
    ttl: float | None = None


class StoreDeleteRequest(BaseModel):
    namespace: list[str] = Field(default_factory=list)
    key: str


class StoreSearchRequest(BaseModel):
    namespace_prefix: list[str] | None = None
    filter: dict[str, Any] | None = None
    limit: int = 10
    offset: int = 0
    query: str | None = None
    refresh_ttl: bool | None = None


class StoreListNamespacesRequest(BaseModel):
    prefix: list[str] | None = None
    suffix: list[str] | None = None
    max_depth: int | None = None
    limit: int = 100
    offset: int = 0


_items: dict[tuple[tuple[str, ...], str], dict[str, Any]] = {}
_lock = RLock()


class StoreRepository(Protocol):
    async def put(
        self,
        *,
        namespace: list[str],
        key: str,
        value: dict[str, Any],
        index: bool | list[str] | None,
        ttl: float | None,
    ) -> None: ...
    async def delete(self, *, namespace: list[str], key: str) -> None: ...
    async def get(
        self, *, namespace: list[str], key: str, refresh_ttl: bool = False
    ) -> dict[str, Any] | None: ...
    async def search(
        self,
        *,
        namespace_prefix: list[str] | None,
        filter: dict[str, Any] | None,
        query: str | None,
        limit: int,
        offset: int,
        refresh_ttl: bool = False,
    ) -> list[dict[str, Any]]: ...
    async def list_namespaces(
        self,
        *,
        prefix: list[str] | None,
        suffix: list[str] | None,
        max_depth: int | None,
        limit: int,
        offset: int,
    ) -> list[list[str]]: ...


_repository: StoreRepository | None = None


def set_store_repository(repository: StoreRepository | None) -> None:
    """Select PostgreSQL persistence; ``None`` restores isolated in-memory mode."""
    global _repository
    _repository = repository


def export_state() -> list[dict[str, Any]]:
    with _lock:
        return [
            {
                "namespace": list(namespace),
                "key": key,
                "item": {
                    item_key: (
                        item_value.isoformat()
                        if isinstance(item_value, datetime)
                        else item_value
                    )
                    for item_key, item_value in item.items()
                },
            }
            for (namespace, key), item in _items.items()
        ]


def import_state(state: list[dict[str, Any]]) -> None:
    with _lock:
        _items.clear()
        for entry in state:
            namespace, key, item = entry.get("namespace"), entry.get("key"), entry.get("item")
            if not isinstance(namespace, list) or not isinstance(key, str) or not isinstance(item, dict):
                continue
            expires_at = item.get("_expires_at")
            if isinstance(expires_at, str):
                item["_expires_at"] = datetime.fromisoformat(expires_at)
            _items[(tuple(str(value) for value in namespace), key)] = item


def _now() -> datetime:
    return datetime.now(UTC)


def _purge_expired() -> None:
    now = _now()
    for identity, item in list(_items.items()):
        expires_at = item.get("_expires_at")
        if expires_at is not None and expires_at <= now:
            del _items[identity]


def _public(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if not key.startswith("_")}


@router.put("/items", status_code=204, operation_id="put_item")
async def put_item(request: StorePutRequest) -> Response:
    if _repository is not None:
        await _repository.put(
            namespace=request.namespace,
            key=request.key,
            value=request.value,
            index=request.index,
            ttl=request.ttl,
        )
        return Response(status_code=204)
    identity = (tuple(request.namespace), request.key)
    now = _now()
    with _lock:
        _purge_expired()
        existing = _items.get(identity)
        created_at = existing["created_at"] if existing else now.isoformat()
        _items[identity] = {
            "namespace": request.namespace,
            "key": request.key,
            "value": request.value,
            "created_at": created_at,
            "updated_at": now.isoformat(),
            "_ttl": request.ttl,
            "_expires_at": now + timedelta(minutes=request.ttl) if request.ttl is not None else None,
        }
    return Response(status_code=204)


@router.delete("/items", status_code=204, operation_id="delete_item")
async def delete_item(request: StoreDeleteRequest) -> Response:
    if _repository is not None:
        await _repository.delete(namespace=request.namespace, key=request.key)
        return Response(status_code=204)
    with _lock:
        _items.pop((tuple(request.namespace), request.key), None)
    return Response(status_code=204)


@router.get("/items", operation_id="get_item")
async def get_item(
    key: str,
    namespace: list[str] = Query(default_factory=list),
    refresh_ttl: bool | None = None,
) -> dict[str, Any] | None:
    if _repository is not None:
        return await _repository.get(
            namespace=namespace, key=key, refresh_ttl=bool(refresh_ttl)
        )
    with _lock:
        _purge_expired()
        item = _items.get((tuple(namespace), key))
        if item is None:
            return None
        if refresh_ttl and item.get("_ttl") is not None:
            item["_expires_at"] = _now() + timedelta(minutes=item["_ttl"])
        return _public(item)


@router.post("/items/search", operation_id="search_items")
async def search_items(request: StoreSearchRequest) -> dict[str, list[dict[str, Any]]]:
    if _repository is not None:
        items = await _repository.search(
            namespace_prefix=request.namespace_prefix,
            filter=request.filter,
            query=request.query,
            limit=request.limit,
            offset=request.offset,
            refresh_ttl=bool(request.refresh_ttl),
        )
        return {"items": items}
    prefix = tuple(request.namespace_prefix or [])
    with _lock:
        _purge_expired()
        matches = [item for (namespace, _), item in _items.items() if namespace[: len(prefix)] == prefix]
        if request.filter:
            matches = [item for item in matches if all(item["value"].get(k) == v for k, v in request.filter.items())]
        if request.query:
            needle = request.query.casefold()
            matches = [item for item in matches if needle in str(item["value"]).casefold()]
        matches.sort(key=lambda item: item["updated_at"], reverse=True)
        selected = matches[max(request.offset, 0) : max(request.offset, 0) + max(request.limit, 0)]
        if request.refresh_ttl:
            now = _now()
            for item in selected:
                if item.get("_ttl") is not None:
                    item["_expires_at"] = now + timedelta(minutes=item["_ttl"])
        return {"items": [_public(item) for item in selected]}


@router.post("/namespaces", operation_id="list_namespaces")
async def list_namespaces(request: StoreListNamespacesRequest) -> list[list[str]]:
    if _repository is not None:
        return await _repository.list_namespaces(
            prefix=request.prefix,
            suffix=request.suffix,
            max_depth=request.max_depth,
            limit=request.limit,
            offset=request.offset,
        )
    with _lock:
        _purge_expired()
        namespaces = {identity[0] for identity in _items}
    prefix, suffix = tuple(request.prefix or []), tuple(request.suffix or [])
    results = [ns for ns in namespaces if ns[: len(prefix)] == prefix and (not suffix or ns[-len(suffix) :] == suffix)]
    if request.max_depth is not None:
        results = [ns[: request.max_depth] for ns in results]
    unique = sorted(set(results))
    return [list(ns) for ns in unique[max(request.offset, 0) : max(request.offset, 0) + max(request.limit, 0)]]
