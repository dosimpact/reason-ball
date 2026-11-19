"""Run the 24 committed SEC starters against an owned or explicitly chosen HTTP host."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

SOURCE = Path(__file__).resolve().parents[2] / "1-fe-host/src/_pages/sec-chat/model/starters.ts"
INTRO = {0, 3, 23}
COLLECT = {20: ("AAPL", 1, None), 21: ("NVDA", 2, None), 22: ("MSFT", 2, "2025-01-01")}
TICKERS = {1: "AAPL", 2: "AAPL", 4: "AAPL", 5: "NVDA", 6: "MSFT", 7: "AMZN", 8: "NVDA", 9: "AAPL", 10: "META", 11: "TSLA", 12: "AAPL", 13: "MSFT", 14: "AMZN", 15: "AAPL", 16: "AAPL", 17: "MSFT", 18: "NVDA", 19: "AMZN", **{i: v[0] for i, v in COLLECT.items()}}
REQUIRED_ITEMS = {1: {"1"}, 4: {"1"}, 5: {"1"}, 6: {"1"}, 7: {"1"}, 8: {"1A"}, 9: {"1A"}, 10: {"3"}, 11: {"1A"}, 12: {"7"}, 13: {"8"}, 14: {"7", "8"}, 15: {"7", "8"}, 17: {"8"}, 18: {"8"}, 19: {"8"}}
CIKS = {"AAPL": "320193", "NVDA": "1045810", "MSFT": "789019", "AMZN": "1018724", "META": "1326801", "TSLA": "1318605"}


def load_starters(path: Path = SOURCE) -> list[dict]:
    pairs = re.findall(r'\{\s*displayText:\s*("(?:[^"\\]|\\.)*")\s*,\s*prompt:\s*("(?:[^"\\]|\\.)*")\s*\}', path.read_text())
    if len(pairs) != 24:
        raise ValueError(f"Expected exactly 24 starters, found {len(pairs)}")
    return [{"index": i, "label": json.loads(label), "prompt": json.loads(prompt)} for i, (label, prompt) in enumerate(pairs)]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def verify_company(company: dict | None, index: int) -> dict:
    if not isinstance(company, dict):
        raise TypeError("Expected resolved company")
    ticker = TICKERS[index]
    require(str(company.get("cik", "")).lstrip("0") == CIKS[ticker], "Company CIK mismatch")
    return company


def evaluate_chat(result: dict, index: int, prepared: dict | None = None) -> None:
    require(bool(result.get("program", "").strip()), "Missing OpenUI program")
    evidence = result.get("evidence") or {}
    filing = evidence.get("filing") or {}
    require(bool(filing.get("accessionNo") and filing.get("filingDate")), "Missing filing provenance")
    require(str(filing.get("cik", "")).lstrip("0") == CIKS[TICKERS[index]], "Evidence CIK mismatch")
    require(bool(evidence.get("sourceUrl")), "Missing SEC source URL")
    if prepared:
        for key in ("cik", "accessionNo", "filingDate"):
            require(filing.get(key) == prepared.get("filing", {}).get(key), f"Prepared filing identity differs: {key}")
    findings = evidence.get("findings") or []
    require(bool(findings) and all(isinstance(f, dict) and f.get("quote", "").strip() for f in findings), "Missing quoted findings")
    items = {str(f.get("item", "")).upper().replace("ITEM ", "").strip() for f in findings}
    require(REQUIRED_ITEMS.get(index, set()).issubset(items), f"Missing required Item quotations: {REQUIRED_ITEMS.get(index, set()) - items}")
    if index == 16:
        require(bool(items & {"7", "8"}), "Modeling revenue answer lacks Item 7 or 8 quotations")
    if index == 2:
        expected_filing = (prepared or {}).get("filing") or filing
        for key in ("filingDate", "accessionNo"):
            require(bool(expected_filing.get(key)) and expected_filing[key] in result["program"], f"Filing metadata answer omits exact {key}")
        if not (prepared or evidence).get("checkedAt"):
            require(bool(re.search(r"미확인|저장", result["program"])), "Metadata answer omits unverified/stored freshness limitation")
    questions = result.get("followUps") or []
    require(len(questions) <= 3 and all(isinstance(q, str) and 0 < len(q.strip()) <= 160 for q in questions), "Invalid bounded follow-ups")


def evaluate_collection(result: dict, index: int) -> None:
    collection = result.get("collection") or {}
    ticker, years, since = COLLECT[index]
    require(result.get("action") == "reply", "Unexpected post-collection action")
    require(str(collection.get("cik", "")).lstrip("0") == CIKS[ticker], "Collection CIK mismatch")
    require(collection.get("years") == years and collection.get("since") == since, "Completed collection scope mismatch")
    for key in ("companiesProcessed", "filingsSynced", "downloaded", "failed"):
        value = collection.get(key)
        require(isinstance(value, int) and not isinstance(value, bool) and value >= 0, f"Invalid collection counter {key}")
    require(collection["companiesProcessed"] == 1 and collection["failed"] == 0, "Collection incomplete or failed")
    require(isinstance(collection.get("checkedAt"), str) and bool(collection["checkedAt"].strip()), "Missing collection completion timestamp")


def evaluate_collection_tools(record: dict, index: int) -> None:
    ticker, years, since = COLLECT[index]
    completed = [event["value"] for event in record.get("events", [])
                 if event.get("name") == "sec.activity" and event.get("value", {}).get("kind") == "tool"
                 and event["value"].get("label") == "SEC 도구 · sync_sec_company_filings"
                 and event["value"].get("status") == "completed"]
    require(len(completed) == 1, "Expected one completed selected-company sync tool")
    args = completed[0].get("arguments") or {}
    require(args.get("ciks") == [CIKS[ticker].zfill(10)] and args.get("tickers") == [], "Actual collection company scope mismatch")
    require(args.get("years") == years and args.get("since") == since, "Actual collection period scope mismatch")
    require(args.get("downloadDocuments") is True and args.get("refreshArchive") is False, "Actual collection download/archive scope mismatch")


async def post(client: httpx.AsyncClient, path: str, payload: dict, record: dict, event_name: str | None = None, timeout: float = 240) -> dict:
    async with asyncio.timeout(timeout):
        return await _read_response(client, path, payload, record, event_name, timeout)


async def _read_response(client: httpx.AsyncClient, path: str, payload: dict, record: dict, event_name: str | None, timeout: float) -> dict:
    async with client.stream("POST", path, json=payload, headers={"Accept": "text/event-stream"}, timeout=httpx.Timeout(timeout, connect=10)) as response:
        response.raise_for_status()
        if "text/event-stream" not in response.headers.get("content-type", ""):
            result = json.loads(await response.aread())
            record["responses"].append({"path": path, "result": result})
            return result
        finished = False
        result: dict = {}
        program = ""
        async for line in response.aiter_lines():
            if not line.startswith("data:"):
                continue
            raw = line[5:].strip()
            if not raw or raw == "[DONE]":
                continue
            event = json.loads(raw)
            record["events"].append({"path": path, **event})
            kind = event.get("type")
            if kind == "RUN_ERROR":
                raise ValueError(f"{path}: {event.get('message', 'RUN_ERROR')}")
            if kind == "RUN_FINISHED":
                finished = True
            if kind == "TEXT_MESSAGE_CONTENT":
                program += event.get("delta", "")
            if kind == "CUSTOM":
                name, value = event.get("name"), event.get("value")
                if name == event_name:
                    result = value
                if name == "sec.evidence":
                    result["evidence"] = value
                if name == "sec.follow-ups":
                    result["followUps"] = value.get("questions", [])
        require(finished, f"{path}: missing RUN_FINISHED")
        if event_name:
            require(bool(result), f"{path}: missing {event_name}")
        if program:
            result["program"] = program
        record["responses"].append({"path": path, "result": result})
        return result


async def validate_program(client: httpx.AsyncClient, program: str, record: dict) -> None:
    require(bool(program.strip()), "Missing OpenUI program")
    response = await client.post("/api/sec-ui/validate", json={"program": program}, timeout=httpx.Timeout(30, connect=10))
    response.raise_for_status()
    result = response.json()
    record["programValidation"] = result
    require(result.get("valid") is True, f"Invalid OpenUI: {result}")


async def run_case(client: httpx.AsyncClient, case: dict, collection_lock: asyncio.Lock) -> dict:
    record = {**case, "events": [], "responses": [], "errors": [], "warnings": [], "cleanup": [], "status": "FAIL"}
    started = time.monotonic()
    threads: set[str] = set()
    try:
        resolution = await post(client, "/api/sec-chat/resolve", {"message": case["prompt"], "history": []}, record, "sec.resolution")
        index = case["index"]
        expected = "reply" if index in INTRO else "collect" if index in COLLECT else "research"
        action = resolution.get("action")
        record["action"] = action
        if action == "choose":
            require(index not in INTRO, "Unexpected company choice for explanatory starter")
            candidates = [c for c in resolution.get("companies", []) if str(c.get("cik", "")).lstrip("0") == CIKS[TICKERS[index]]]
            require(len(candidates) == 1, "Expected ticker absent or ambiguous in company choices")
            company = verify_company(candidates[0], index)
            action = "collect" if resolution.get("pendingAction") == "collect" else "research"
            resolution["company"] = company
            record["selectedCompany"] = company
        require(action == expected, f"Expected {expected}, got {action}")
        if expected == "reply":
            require(bool(resolution.get("reply", "").strip()), "Missing introductory reply")
            await validate_program(client, resolution.get("program", ""), record)
        else:
            company = verify_company(resolution.get("company"), index)
            if expected == "collect":
                _, years, since = COLLECT[index]
                require(resolution.get("years", 2) == years, "Collection years differ from authorized scope")
                require(resolution.get("since") == since, "Collection date differs from authorized scope")
                payload = {"cik": company["cik"], "years": years}
                if since:
                    payload["since"] = since
                async with collection_lock:
                    result = await post(client, "/api/sec-chat/collect", payload, record, "sec.resolution", timeout=900)
                require(bool(result.get("reply", "").strip()), "Missing collection summary")
                evaluate_collection(result, index)
                evaluate_collection_tools(record, index)
            else:
                require(resolution.get("refresh") is False, "Read-only starter requested a fresh collection")
                prepared = await post(client, "/api/sec-chat/prepare", {"cik": company["cik"], "refresh": False}, record, "sec.prepared")
                thread = prepared.get("threadId")
                if not isinstance(thread, str) or not thread:
                    raise ValueError("Missing prepared thread")
                threads.add(thread)
                record["filing"] = prepared.get("filing")
                answer = await post(client, "/api/sec-chat/chat", {"threadId": thread, "message": resolution.get("question", case["prompt"])}, record)
                record["program"] = answer.get("program")
                record["provenance"] = answer.get("evidence")
                evaluate_chat(answer, index, prepared)
                if len(answer.get("followUps") or []) != 3:
                    record["warnings"].append("Follow-up generation unavailable or fewer than 3 questions; core answer evaluated independently")
                await validate_program(client, answer["program"], record)
        states = {}
        for event in record["events"]:
            if event.get("name") == "sec.activity":
                activity = event.get("value", {})
                states[activity.get("id")] = activity
        record["activities"] = list(states.values())
        require(not any(a.get("status") in {"failed", "cancelled", "running"} for a in states.values()), "Failed, cancelled or unfinished activity")
        record["status"] = "PASS"
    except Exception as error:  # noqa: BLE001 - preserve per-case failure artifacts and cleanup
        record["errors"].append(f"{type(error).__name__}: {error}")
    finally:
        activity_states = {}
        for event in record["events"]:
            if event.get("name") == "sec.activity":
                activity = event.get("value", {})
                activity_states[activity.get("id")] = activity
        record["activities"] = list(activity_states.values())
        # Prepared events may arrive before a later stream failure.
        for event in record["events"]:
            if event.get("name") == "sec.prepared" and isinstance(event.get("value", {}).get("threadId"), str):
                threads.add(event["value"]["threadId"])
        for thread in threads:
            try:
                response = await client.delete(f"/api/sec-chat/threads/{thread}", timeout=30)
                response.raise_for_status()
                record["cleanup"].append({"threadId": thread, "status": "deleted"})
            except Exception as error:  # noqa: BLE001 - record cleanup failures without hiding original evidence
                record["status"] = "FAIL"
                record["errors"].append(f"Cleanup failed: {type(error).__name__}: {error}")
        record["elapsed"] = round(time.monotonic() - started, 3)
    return record


async def main(args: argparse.Namespace) -> int:
    cases = load_starters(args.source)
    fingerprint = hashlib.sha256(args.source.read_bytes()).hexdigest()
    selected = set(args.indices or range(24))
    if args.labels:
        labels = set(args.labels)
        require(labels.issubset({c["label"] for c in cases}), "Unknown starter label")
        selected &= {c["index"] for c in cases if c["label"] in labels}
    require(bool(selected) and selected.issubset(set(range(24))), "Invalid or empty index selection")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    journal = args.output_dir / "results.jsonl"
    completed = {}
    if journal.exists() and not args.rerun:
        for line in journal.read_text().splitlines():
            item = json.loads(line)
            if item.get("sourceHash") == fingerprint and item.get("baseUrl") == args.base_url:
                completed[item["index"]] = item
    pending = [c for c in cases if c["index"] in selected and c["index"] not in completed]
    queue = asyncio.Queue()
    for case in pending:
        queue.put_nowait(case)
    stop = asyncio.Event()
    lock = asyncio.Lock()
    async with httpx.AsyncClient(base_url=args.base_url, follow_redirects=False) as client:
        async def worker() -> None:
            while not queue.empty() and not stop.is_set() and not (args.output_dir / "PAUSE").exists():
                case = queue.get_nowait()
                print(f"START {case['index']:02d} {case['label']}", flush=True)
                record = await run_case(client, case, lock)
                record.update(sourceHash=fingerprint, baseUrl=args.base_url)
                completed[case["index"]] = record
                (args.output_dir / f"{case['index']:02d}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))
                with journal.open("a") as stream:
                    stream.write(json.dumps(record, ensure_ascii=False) + "\n")
                print(f"{record['status']} {case['index']:02d} {case['label']} {record['elapsed']}s {record['errors']}", flush=True)
                if record["status"] != "PASS" and args.stop_on_failure:
                    stop.set()
        await asyncio.gather(*(worker() for _ in range(args.workers)))
    results = [completed[i] for i in selected if i in completed]
    summary = {"selected": len(selected), "completed": len(results), "passed": sum(r["status"] == "PASS" for r in results), "outputDir": str(args.output_dir)}
    print(json.dumps(summary), flush=True)
    return 0 if len(results) == len(selected) and all(r["status"] == "PASS" for r in results) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://reason-web.flin-ai.com")
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp") / ("sec-starters-" + datetime.now(UTC).strftime("%Y%m%d-%H%M%S")))
    parser.add_argument("--workers", type=int, choices=(1, 2), default=2)
    parser.add_argument("--indices", type=int, nargs="+")
    parser.add_argument("--labels", nargs="+")
    parser.add_argument("--stop-on-failure", action="store_true")
    parser.add_argument("--rerun", action="store_true", help="Explicitly rerun selected completed cases, including failures")
    raise SystemExit(asyncio.run(main(parser.parse_args())))
