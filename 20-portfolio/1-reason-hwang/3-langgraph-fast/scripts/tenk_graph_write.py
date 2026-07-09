from __future__ import annotations

import argparse
import json
from pathlib import Path

from langgraph_fast.domains.tenk.pipeline import ParserPipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse a filing and write graph payload to Neo4j.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--metadata")
    parser.add_argument("--include-debug", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    metadata = _load_metadata(args.metadata)
    pipeline = ParserPipeline(write_to_neo4j=True)
    try:
        result = pipeline.parse_file(args.input, metadata=metadata, include_debug=args.include_debug)
    finally:
        pipeline.close()
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


def _load_metadata(path: str | None) -> dict:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())
