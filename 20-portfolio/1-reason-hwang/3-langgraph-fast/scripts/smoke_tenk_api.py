from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import httpx


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test 10-K parser HTTP API.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--metadata")
    parser.add_argument("--base-url", default=os.getenv("TENK_API_BASE_URL", "http://127.0.0.1:8000"))
    args = parser.parse_args()
    metadata = _load_metadata(args.metadata)
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=60) as client:
        health = client.get("/health")
        health.raise_for_status()
        parse = client.post(
            "/api/tenk/parse-file",
            json={"path": args.input, "metadata_json": args.metadata, "dry_run": True},
        )
        parse.raise_for_status()
        graph = client.post(
            "/graph/tenk/run",
            json={
                "query": "What are the main risks?",
                "selectedFiling": {
                    "accessionNo": metadata.get("accession_no"),
                    "companyName": metadata.get("company_name"),
                    "ticker": metadata.get("ticker"),
                },
            },
        )
        graph.raise_for_status()
    print(json.dumps({"health": health.json(), "parse": parse.json(), "graph": graph.json()}, ensure_ascii=False, indent=2))
    return 0


def _load_metadata(path: str | None) -> dict:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())
