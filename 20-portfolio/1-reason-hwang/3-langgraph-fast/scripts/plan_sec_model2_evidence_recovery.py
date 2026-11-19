"""Read-only plan for chunk-unique evidence migration and duplicate-source recovery."""

import argparse
import copy
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from graphrag_toolkit.lexical_graph import TenantId

from domains.sec_modeling.model2_policy import DECISIONS_MODEL, runtime_policy_hash
from domains.sec_modeling.model2_topics import classify_propositions, select_topics
from domains.sec_modeling.store import GraphStore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("generation")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    store = GraphStore()
    try:
        tenant = TenantId(hashlib.sha256(args.generation.encode()).hexdigest()[:24])
        chunk_label = tenant.format_label("__Chunk__")
        statement_label = tenant.format_label("__Statement__")
        topic_label = tenant.format_label("__Topic__")
        records = store.records(args.generation, "Chunk")
        groups = defaultdict(list)
        for record in records:
            groups[(record["itemId"], record["value"])].append(record)
        updates = []
        recoveries = []
        for (item_id, source), group in groups.items():
            evidence = group[0]["topicDecisions"]
            recovered = None
            if len(group) > 1:
                actual = store.query(
                    f"MATCH (s:{statement_label})-[:__MENTIONED_IN__]->(c:{chunk_label}) WHERE c.chunkId IN $ids MATCH (s)-[:__BELONGS_TO__]->(t:{topic_label}) RETURN DISTINCT s.value AS value,t.value AS topic",
                    ids=[record["chunkId"] for record in group],
                )
                originals = {value["value"] for value in actual}
                if originals != set(evidence["propositions"]):
                    propositions = sorted(originals)
                    distributions = classify_propositions(
                        propositions,
                        {
                            "chunk": source,
                            "source": {"itemId": item_id},
                            "recovery": "duplicate-source-evidence-union-v1",
                        },
                    )
                    selected = select_topics(distributions)
                    assignments = [
                        {
                            "proposition": value,
                            "topic": max(selected, key=lambda topic: row[topic]),
                            "confidence": max(row[topic] for topic in selected),
                        }
                        for value, row in zip(propositions, distributions)
                    ]
                    expected_topics = {
                        value["value"]: value["topic"] for value in actual
                    }
                    if any(
                        row["topic"] != expected_topics[row["proposition"]]
                        for row in assignments
                    ):
                        raise ValueError(
                            "Fresh Decisions recovery topics differ from existing graph; review required"
                        )
                    recovered = {
                        "model": DECISIONS_MODEL,
                        "policyHash": runtime_policy_hash(),
                        "selectedTopics": list(selected),
                        "assignments": assignments,
                        "propositions": propositions,
                        "probabilities": distributions,
                        "recoveryReason": "Legacy itemId+text sidecar collision across byte-identical chunks. Non-destructive union of existing source-faithful supported statements; fresh Decisions topics match existing graph. Original per-chunk extraction history cannot be recovered from overwritten artifact.",
                    }
                    recoveries.append(
                        {
                            "chunkIds": [record["chunkId"] for record in group],
                            "source": source,
                            "evidence": recovered,
                            "manualSourceFidelityReviewRequired": True,
                        }
                    )
            for record in group:
                updated = copy.deepcopy(record)
                new_evidence = copy.deepcopy(recovered or record["topicDecisions"])
                new_evidence["chunkId"] = record["chunkId"]
                updated["topicDecisions"] = new_evidence
                updates.append(updated)
        Path(args.output).write_text(
            json.dumps(
                {
                    "generation": args.generation,
                    "dryRun": True,
                    "writesPerformed": False,
                    "chunkRecords": len(updates),
                    "recoveryGroups": recoveries,
                    "updatedRecords": updates,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        print(
            json.dumps(
                {
                    "output": args.output,
                    "chunkRecords": len(updates),
                    "recoveryGroups": len(recoveries),
                    "writesPerformed": False,
                }
            )
        )
    finally:
        store.close()


if __name__ == "__main__":
    main()
