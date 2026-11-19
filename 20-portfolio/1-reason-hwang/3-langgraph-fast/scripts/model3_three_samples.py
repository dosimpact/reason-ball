"""Run only AAPL, CPNG and NVDA local 10-K/10-Q samples through model 3.

Default is a read-only manifest check. --execute publishes via the normal runtime.
For 10-Q provide --metadata JSON keyed by ticker with accessionNo/sourceUrl/filingDate.
No sample source under human-docs is modified.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
import uuid
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from domains.sec_modeling import runtime
from domains.sec_modeling.contracts import ModelingRequest
from domains.sec_modeling.store import GraphStore
from domains.tenk.document_structure import FilingMetadata

SAMPLES = (
    (
        "aapl-20260926-10k.htm",
        FilingMetadata(
            "0000320193",
            "Apple Inc.",
            "AAPL",
            "0000320193-26-000026",
            "2026-11-03",
            "2026-09-26",
            "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
        ),
    ),
    (
        "cpng-20251231-10k.htm",
        FilingMetadata(
            "0001834584",
            "Coupang, Inc.",
            "CPNG",
            "0001834584-26-000024",
            "2026-02-26",
            "2025-12-31",
            "https://www.sec.gov/Archives/edgar/data/1834584/000183458426000024/cpng-20251231.htm",
        ),
    ),
    (
        "nvda-20260125-10k.htm",
        FilingMetadata(
            "0001045810",
            "NVIDIA CORP",
            "NVDA",
            "0001045810-26-000021",
            "2026-02-25",
            "2026-01-25",
            "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm",
        ),
    ),
)

PACKAGE = Path(__file__).resolve().parents[1]


def requests(args):
    overrides = json.loads(args.metadata.read_text()) if args.metadata else {}
    result = []
    for filename, meta in SAMPLES:
        if args.form == "10-Q":
            matches = sorted(args.source_dir.glob(f"{meta.ticker.lower()}-*-10q.htm"))
            if len(matches) != 1:
                raise ValueError(f"Expected exactly one local {meta.ticker} 10-Q")
            path = matches[0]
            if meta.ticker not in overrides:
                raise ValueError(
                    "10-Q needs --metadata keyed by AAPL/CPNG/NVDA; accession and SEC URL must be explicit"
                )
        else:
            path = args.source_dir / filename
        content = path.read_text()
        metadata = {
            "formType": args.form,
            "ticker": meta.ticker,
            "companyName": meta.name,
            "reportDate": path.name.split("-")[1],
            "sourceUrl": meta.source_url,
            "filingDate": meta.filing_date,
        }
        metadata["reportDate"] = "-".join(
            (
                metadata["reportDate"][:4],
                metadata["reportDate"][4:6],
                metadata["reportDate"][6:],
            )
        )
        extra = overrides.get(meta.ticker, {})
        metadata.update({k: v for k, v in extra.items() if k != "accessionNo"})
        result.append(
            ModelingRequest(
                runId=f"model3-sample-{meta.ticker}-{uuid.uuid4().hex}",
                executionToken=uuid.uuid4().hex,
                cik=meta.cik,
                accessionNo=extra.get("accessionNo", meta.accession_no),
                sourceHtml=content,
                sourceHash=hashlib.sha256(content.encode()).hexdigest(),
                metadata=metadata,
                extractionModel=args.model,
            )
        )
    return result


def audit(store, request, generation):
    records = store.records(generation, "XbrlFact")
    counts = store.query(
        "MATCH (x:SecRecord {generationId:$g}) RETURN count(x) AS records, count(CASE WHEN x:XbrlFact THEN 1 END) AS facts",
        g=generation,
    )[0]
    legacy = store.query(
        "MATCH (n {generationId:$g}) WHERE n:Context OR n:Unit OR n:Dimension OR n:DimensionValue OR n:Member RETURN count(n) AS count",
        g=generation,
    )[0]["count"]
    missing = [
        r["id"]
        for r in records
        if not r.get("evidenceIds")
        or not r.get("selectionReason")
        or "rawValue" not in r
        or "normalizedValue" not in r
    ]
    stored = store.query(
        "MATCH (x:XbrlFact {generationId:$g}) RETURN x.id AS id,x.rawValue AS rawValue,x.normalizedValue AS normalizedValue,x.sourceFactId AS sourceFactId",
        g=generation,
    )
    by_id = {r["id"]: r for r in records}
    mismatches = [
        r["id"]
        for r in stored
        if any(
            r[key] != by_id[r["id"]].get(key)
            for key in ("rawValue", "normalizedValue", "sourceFactId")
        )
    ]
    passed = (
        not mismatches
        and counts["records"] == counts["facts"] == len(records)
        and legacy == 0
        and not missing
    )
    return {
        "passed": passed,
        "physicalNodes": counts,
        "legacyNodes": legacy,
        "missingSourceOrSelection": missing,
        "sourcePropertyMismatches": mismatches,
        "categories": dict(Counter(r["analysisCategory"] for r in records)),
        "selectedRecords": records,
    }


async def run(args, inputs):
    report = {
        "form": args.form,
        "provider": "openai-direct-decisions",
        "endpoint": "https://api.openai.com/v1/decisions",
        "model": args.model,
        "reports": [],
        "status": "RUNNING",
    }
    args.output.mkdir(parents=True, exist_ok=True)
    store = GraphStore()
    try:
        for request in inputs:
            queue = runtime.launch(3, request)
            task = runtime._tasks[request.runId]
            entry = {
                "ticker": request.metadata["ticker"],
                "runId": request.runId,
                "events": [],
            }
            report["reports"].append(entry)
            (args.output / "report.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2)
            )
            while (event := await queue.get()) is not None:
                entry["events"].append(event)
                print(
                    json.dumps(
                        {"ticker": request.metadata["ticker"], **event},
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
                (args.output / "report.json").write_text(
                    json.dumps(report, ensure_ascii=False, indent=2)
                )
                if event["type"] == "completed":
                    entry.update(
                        status="SUCCEEDED",
                        generationId=event["generationId"],
                        counts=event["counts"],
                    )
                    entry["audit"] = audit(store, request, event["generationId"])
                elif event["type"] == "error":
                    entry.update(status=event["code"])
            await asyncio.gather(task, return_exceptions=True)
            await asyncio.sleep(0)
            if entry.get("status") != "SUCCEEDED" or not entry.get("audit", {}).get(
                "passed"
            ):
                report["status"] = "FAILED"
                break
        else:
            report["status"] = "SUCCEEDED"
    except asyncio.CancelledError:
        for entry in report["reports"]:
            pending = runtime._tasks.get(entry["runId"])
            if pending and not pending.done():
                request = next(r for r in inputs if r.runId == entry["runId"])
                runtime.cancel(request.runId, request.executionToken)
                await asyncio.shield(pending)
        report["status"] = "CANCELLED"
        raise
    finally:
        await asyncio.sleep(0)
        # Runtime closes each driver and removes task/cancellation registrations.
        store.close()
        report["runtimeResourcesReleased"] = not runtime._tasks and not runtime._cancel
        (args.output / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2)
        )
    print(json.dumps({k: v for k, v in report.items() if k != "reports"}))
    return 0 if report["status"] == "SUCCEEDED" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir", type=Path, default=PACKAGE.parent / "docs/human-docs/1-sec-분석"
    )
    parser.add_argument(
        "--output", type=Path, default=PACKAGE / ".tmp/model3-decisions-three-filings"
    )
    parser.add_argument("--form", choices=("10-K", "10-Q"), default="10-K")
    parser.add_argument("--metadata", type=Path)
    parser.add_argument(
        "--model", choices=("gpt-6-luna",), default="gpt-6-luna"
    )
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    inputs = requests(args)
    if not args.execute:
        print(
            json.dumps(
                [
                    {
                        "ticker": r.metadata["ticker"],
                        "cik": r.cik,
                        "accessionNo": r.accessionNo,
                        "metadata": r.metadata,
                        "sourceHash": r.sourceHash,
                    }
                    for r in inputs
                ],
                indent=2,
            )
        )
        return 0
    return asyncio.run(run(args, inputs))


if __name__ == "__main__":
    raise SystemExit(main())
