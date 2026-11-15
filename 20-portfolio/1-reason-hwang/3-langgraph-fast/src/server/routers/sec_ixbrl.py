"""Authenticated read-only bridge; original source is supplied only by the BFF."""

import asyncio
import hashlib
import hmac
import json
import os
import re
import time
from collections import OrderedDict

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse

from domains.sec_ixbrl.extractor import MAX_SOURCE, VERSION, extract

MAX_BODY = 64 * 1024 * 1024
MAX_CACHE = 128 * 1024 * 1024
CACHE_TTL = 300
cache = OrderedDict()
inflight = {}
workers = asyncio.Semaphore(2)


def authenticate(x_sec_modeling_key: str = Header(default="")):
    expected = os.getenv("SEC_MODELING_KEY", "")
    if not expected:
        raise HTTPException(503, "Internal service key is not configured")
    if not hmac.compare_digest(expected, x_sec_modeling_key):
        raise HTTPException(401, "Invalid service key")


router = APIRouter(dependencies=[Depends(authenticate)])


async def compute(key, source, source_hash):
    try:
        async with workers:
            result = await asyncio.to_thread(extract, source, source_hash)
            size = len(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            if size > MAX_BODY:
                raise ValueError("Extracted document exceeds supported response size")
            now = time.monotonic()
            for old in list(cache):
                if cache[old][0] <= now:
                    del cache[old]
            while cache and (len(cache) >= 4 or sum(entry[1] for entry in cache.values()) + size > MAX_CACHE):
                cache.popitem(last=False)
            cache[key] = (now + CACHE_TTL, size, result)
            return result
    finally:
        inflight.pop(key, None)


async def load_snapshot(source, source_hash):
    key = (source_hash, VERSION)
    cached = cache.get(key)
    if cached and cached[0] > time.monotonic():
        cache.move_to_end(key)
        return cached[2]
    if key not in inflight:
        if len(inflight) >= 8:
            raise HTTPException(503, "Document extraction capacity is busy")
        task = asyncio.create_task(compute(key, source, source_hash))
        task.add_done_callback(lambda done: done.exception() if not done.cancelled() else None)
        inflight[key] = task
    try:
        return await asyncio.wait_for(asyncio.shield(inflight[key]), timeout=30)
    except TimeoutError:
        raise HTTPException(504, "Document extraction timed out") from None
    except LookupError:
        raise HTTPException(409, "Source hash mismatch") from None
    except (ValueError, TypeError):
        raise HTTPException(422, "Document is malformed or exceeds extraction limits") from None
    except Exception:
        raise HTTPException(422, "Document extraction could not complete safely") from None


@router.post("/internal/sec-ixbrl/extract")
async def extract_document(request: Request, view: str = Query(default="metadata", pattern="^(metadata|facts|document)$"),
                           page: int = Query(default=1, ge=1, le=100000), q: str = Query(default="", max_length=200),
                           factId: str | None = Query(default=None, pattern=r"^ix-fact-[1-9]\d{0,5}$")):
    if q and factId:
        raise HTTPException(400, "q and factId cannot be combined")
    length = request.headers.get("content-length")
    if length and (not length.isdigit() or int(length) > MAX_BODY):
        raise HTTPException(413, "Request exceeds 64 MiB")
    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > MAX_BODY:
            raise HTTPException(413, "Request exceeds 64 MiB")
    try:
        body = json.loads(chunks)
        if not isinstance(body, dict) or set(body) != {"cik", "accessionNo", "sourceHtml", "sourceHash"}:
            raise ValueError()
        if not isinstance(body["cik"], str) or not re.fullmatch(r"\d{10}", body["cik"]):
            raise ValueError()
        if not isinstance(body["accessionNo"], str) or not re.fullmatch(r"\d{10}-\d{2}-\d{6}", body["accessionNo"]):
            raise ValueError()
        source, source_hash = body["sourceHtml"], body["sourceHash"]
        if not isinstance(source, str) or not isinstance(source_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", source_hash):
            raise ValueError()
        source_bytes = source.encode("utf-8")
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise HTTPException(400, "Invalid extraction request") from None
    if len(source_bytes) > MAX_SOURCE:
        raise HTTPException(413, "Source exceeds 32 MiB")
    if hashlib.sha256(source_bytes).hexdigest() != source_hash:
        raise HTTPException(409, "Source hash mismatch")
    snapshot = await load_snapshot(source, source_hash)
    if view == "document":
        return HTMLResponse(snapshot["html"], headers={"X-Source-Hash": source_hash, "X-Extractor-Version": VERSION,
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"})
    if view == "facts":
        query = q.casefold().strip()
        rows = snapshot["facts"]
        if factId:
            rows = [fact for fact in rows if fact["factId"] == factId]
        elif query:
            rows = [fact for fact in rows if query in json.dumps(fact, ensure_ascii=False).casefold()]
        total = len(rows)
        return {"sourceHash": source_hash, "extractorVersion": VERSION,
                "pagination": {"page": page, "pageSize": 100, "totalItems": total, "totalPages": (total + 99) // 100},
                "items": rows[(page - 1) * 100:page * 100]}
    return {key: value for key, value in snapshot.items() if key not in {"html", "facts"}}
