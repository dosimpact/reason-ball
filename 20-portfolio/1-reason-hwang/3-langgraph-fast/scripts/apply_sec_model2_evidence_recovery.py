"""Apply an explicitly reviewed, existing-node-only chunk evidence recovery plan."""

import argparse
import hashlib
import json
from pathlib import Path

from domains.sec_modeling.model2_support import reconcile_statement_support
from domains.sec_modeling.store import GraphStore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan")
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text())
    generation = plan["generation"]
    store = GraphStore()
    try:
        current = {
            record["id"]: record for record in store.records(generation, "Chunk")
        }
        proposed = plan["updatedRecords"]
        if set(current) != {record["id"] for record in proposed}:
            raise ValueError(
                "Recovery plan Chunk set no longer matches existing generation"
            )
        for record in proposed:
            existing = current[record["id"]]
            for key in set(existing) | set(record):
                if key != "topicDecisions" and existing.get(key) != record.get(key):
                    raise ValueError(
                        "Recovery plan attempts to alter canonical Chunk data"
                    )
            if record["topicDecisions"].get("chunkId") != record["chunkId"]:
                raise ValueError("Recovery evidence Chunk identity mismatch")
        directory = Path(".tmp/sec-modeling") / generation / "topic-decisions"
        directory.mkdir(parents=True, exist_ok=True)
        for record in proposed:
            key = hashlib.sha256(record["chunkId"].encode()).hexdigest()
            (directory / (key + ".json")).write_text(
                json.dumps(record["topicDecisions"], ensure_ascii=False)
            )
        support = reconcile_statement_support(store, generation, directory)
        store.save_records(generation, proposed[0]["filingId"], 2, proposed)
        persisted = store.records(generation, "Chunk")
        if {record["chunkId"]: record["topicDecisions"] for record in persisted} != {
            record["chunkId"]: record["topicDecisions"] for record in proposed
        }:
            raise ValueError("Recovery metadata persistence verification failed")
        print(
            json.dumps(
                {
                    "generation": generation,
                    "migratedChunkRecords": len(proposed),
                    "recoveryGroups": len(plan["recoveryGroups"]),
                    "recoveryRecords": sum(
                        "recoveryReason" in record["topicDecisions"]
                        for record in proposed
                    ),
                    **support,
                    "deletedNodes": 0,
                    "deletedRelationships": 0,
                    "changedCanonicalValues": 0,
                }
            )
        )
    finally:
        store.close()


if __name__ == "__main__":
    main()
