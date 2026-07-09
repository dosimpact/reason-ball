from __future__ import annotations

import argparse
import json
from pathlib import Path

from langgraph_fast.domains.tenk.retrieval import RetrievalService


def main() -> int:
    parser = argparse.ArgumentParser(description="Query grounded filing evidence from Neo4j.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--metadata")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    metadata = _load_metadata(args.metadata)
    selected_filing = {
        "accessionNo": metadata.get("accession_no"),
        "companyName": metadata.get("company_name"),
        "ticker": metadata.get("ticker"),
        "cik": metadata.get("cik"),
    }
    service = RetrievalService()
    try:
        answer, result = service.answer(query=args.query, selected_filing=selected_filing)
    finally:
        service.close()
    payload = {
        "intent": result.intent,
        "selectedFiling": result.selected_filing,
        "answer": answer,
        "evidenceBundle": [evidence.__dict__ for evidence in result.evidence_bundle],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


def _load_metadata(path: str | None) -> dict:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())
