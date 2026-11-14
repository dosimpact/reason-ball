"""Validate 30 bilingual gold queries against live published SEC evidence.

Requires SEC_MODELING_KEY in env. No Item prefilter; complete Item HTML cannot
satisfy recall. Reports contain identifiers/outcomes, never credentials or bodies.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote, urlsplit

import httpx

WORKSPACE = Path(__file__).resolve().parents[2]


def normalize(text):
    value = unicodedata.normalize("NFKC", html.unescape(text)).casefold()
    value = value.translate(str.maketrans({"’": "'", "‘": "'", "–": "-", "—": "-", "\u00ad": "", "\u200b": ""}))
    return re.sub(r"\s+", " ", value).strip()


def request_json(client, method, path, body=None):
    try:
        response = client.request(method, path, json=body)
        if response.status_code != 200:
            return None, f"HTTP_{response.status_code}"
        value = response.json()
        return (value, None) if isinstance(value, dict) else (None, "INVALID_RESPONSE")
    except httpx.TimeoutException:
        return None, "TIMEOUT"
    except httpx.HTTPError:
        return None, "CONNECTION_ERROR"
    except ValueError:
        return None, "INVALID_JSON"


def validate_question(client, question, top_k, cache):
    filing = f"filing:{question['cik']}:{question['accessionNo']}"
    data, error = request_json(client, "POST", "/api/sec-analysis/search", {
        "query": question["query"], "filingIds": [filing], "topK": top_k,
    })
    report = {"id": question["id"], "language": question["language"], "ticker": question["ticker"],
              "filingId": filing, "matched": False, "returned": 0, "wrongFilingCount": 0,
              "unresolvedEvidenceCount": 0, "hits": [], "error": error}
    if error or data is None:
        return report
    hits = data.get("items")
    if not isinstance(hits, list):
        report["error"] = "INVALID_ITEMS"
        return report
    if len(hits) > top_k:
        report["error"] = "TOP_K_EXCEEDED"
    report["returned"] = len(hits)
    expected = question["evidenceContains"]
    needles = [normalize(value) for value in (expected if isinstance(expected, list) else [expected])]
    for rank, hit in enumerate(hits, 1):
        if not isinstance(hit, dict):
            report["error"] = "INVALID_HIT"
            report["unresolvedEvidenceCount"] += 1
            continue
        identity = hit.get("evidenceId") or hit.get("id")
        detail, failure = None, "MISSING_EVIDENCE_ID"
        if isinstance(identity, str) and identity:
            if identity not in cache:
                cache[identity] = request_json(client, "GET", "/api/sec-analysis/evidence/" + quote(identity, safe=""))
            detail, failure = cache[identity]
        if detail is not None and detail.get("id") != identity:
            failure = "EVIDENCE_ID_MISMATCH"
        wrong = hit.get("filingId") != filing or bool(detail and detail.get("filingId") != filing)
        report["wrongFilingCount"] += int(wrong)
        report["unresolvedEvidenceCount"] += int(failure is not None)
        texts = [hit.get("text", "")]
        if detail and not failure:
            texts.append(detail.get("text", ""))
            # Only explicit linked chunk text; never full Item HTML.
            for chunk in detail.get("supportingChunks", []):
                if isinstance(chunk, dict) and chunk.get("filingId") == filing:
                    texts.append(chunk.get("text", ""))
        matched = not wrong and not failure and any(
            needle and needle in normalize(text)
            for needle in needles for text in texts if isinstance(text, str)
        )
        report["matched"] = report["matched"] or matched
        report["hits"].append({"rank": rank, "evidenceId": identity, "type": hit.get("type"),
                               "generationId": hit.get("generationId"), "itemId": hit.get("itemId"),
                               "itemCode": hit.get("itemCode"), "matched": matched,
                               "wrongFiling": wrong, "evidenceError": failure})
    return report


def run(client, gold):
    cache = {}
    rows = [validate_question(client, question, gold["topK"], cache) for question in gold["questions"]]
    count = len(rows)
    hits = sum(row["returned"] for row in rows)
    unresolved = sum(row["unresolvedEvidenceCount"] for row in rows)
    wrong = sum(row["wrongFilingCount"] for row in rows)
    recalled = sum(row["matched"] for row in rows)
    recall = recalled / count if count else 0
    resolved_rate = (hits - unresolved) / hits if hits else 0
    errors = sum(row["error"] is not None for row in rows)
    summary = {"questions": count, "matchedQuestions": recalled, "recallAtK": recall,
               "topK": gold["topK"], "minimumRecall": gold["minimumRecall"],
               "returnedEvidence": hits, "uniqueEvidenceIds": len(cache),
               "unresolvedEvidence": unresolved, "evidenceResolutionRate": resolved_rate,
               "wrongFilingCount": wrong, "requestErrors": errors}
    passed = count == 30 and recall >= gold["minimumRecall"] and wrong == 0 and resolved_rate == 1 and errors == 0
    return {"schemaVersion": 1, "checkedAt": datetime.now(UTC).isoformat(), "status": "PASS" if passed else "FAIL",
            "method": "Exact filing; no Item prefilter; quotation match in retrieved or linked chunk text; full Item HTML excluded",
            "summary": summary, "questions": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.getenv("SEC_MODELING_URL", "http://127.0.0.1:2981"))
    parser.add_argument("--gold", type=Path, default=WORKSPACE / "assets/sec-modeling/retrieval-gold.json")
    parser.add_argument("--output", type=Path, default=WORKSPACE / ".tmp/sec-modeling/retrieval-validation.json")
    parser.add_argument("--timeout", type=float, default=120)
    args = parser.parse_args()
    key = os.getenv("SEC_MODELING_KEY")
    if not key:
        parser.error("SEC_MODELING_KEY must be set in the environment")
    url = urlsplit(args.base_url)
    if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password or url.query or url.fragment:
        parser.error("Use an HTTP(S) origin without credentials, query, or fragment")
    output = args.output.resolve()
    if not any(output.is_relative_to(root) for root in (WORKSPACE / ".tmp", WORKSPACE / "3-langgraph-fast/.tmp")):
        parser.error("Report output must be under workspace .tmp or 3-langgraph-fast/.tmp")
    gold = json.loads(args.gold.read_text())
    if len(gold["questions"]) != 30 or len({row["id"] for row in gold["questions"]}) != 30:
        parser.error("Gold must contain exactly 30 uniquely identified questions")
    with httpx.Client(base_url=args.base_url.rstrip("/"), headers={"X-Sec-Modeling-Key": key}, timeout=args.timeout, follow_redirects=False) as client:
        report = run(client, gold)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": report["status"], **report["summary"], "report": str(output)}, ensure_ascii=False))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
