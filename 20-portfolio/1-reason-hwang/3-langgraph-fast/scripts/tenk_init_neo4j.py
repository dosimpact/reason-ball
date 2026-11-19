from __future__ import annotations

import argparse
import json

from domains.sec_modeling.store import GraphStore
from infrastructure.neo4j.constraints import init_neo4j_constraints


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize Neo4j constraints for SEC filing graph."
    )
    parser.add_argument("--database")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()
    result = init_neo4j_constraints(database=args.database)
    graph = GraphStore(database=args.database)
    try:
        graph.initialize(allow_migration=True)
        result.update(
            modelingConstraints=5,
            vectorIndex="sec_evidence_embedding",
            cacheIndex="sec_embedding_cache",
        )
    finally:
        graph.close()
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
