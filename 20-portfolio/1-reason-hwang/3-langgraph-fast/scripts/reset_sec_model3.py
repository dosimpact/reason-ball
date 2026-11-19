"""Remove generated SEC model-3 graph data; dry-run unless --apply.

Shared Company/Filing and stages 1/2 are never selected for removal.
"""

import argparse
import json

from domains.sec_modeling.store import GraphStore

LABELS = [
    "XbrlFact",
    "Concept",
    "Context",
    "Dimension",
    "DimensionValue",
    "Member",
    "Unit",
]
GENERATED = r"^[0-9a-f]{64}:(fact|concept|context|dim|dv|member|unit):.*$"


def reset(store, apply=False):
    with store.driver.session(database=store.database) as session:

        def work(tx):
            if tx.run(
                "MATCH (r:SecRun {status:'RUNNING'}) RETURN count(r) AS count"
            ).single()["count"]:
                raise ValueError(
                    "Stop modeling runs before reset; no running graph jobs permitted"
                )
            generations = list(
                tx.run(
                    "MATCH (g:SecGeneration {stage:3}) RETURN g.id AS id,g.runId AS run"
                )
            )
            domain = list(
                tx.run(
                    "MATCH (n) WHERE any(l IN labels(n) WHERE l IN $labels) "
                    "AND n.id =~ $pattern RETURN elementId(n) AS eid,labels(n) AS labels",
                    labels=LABELS,
                    pattern=GENERATED,
                )
            )
            controls = list(
                tx.run(
                    "MATCH (n) WHERE (n:SecRecord AND n.stage=3) "
                    "OR (n:SecGeneration AND n.stage=3) "
                    "OR (n:SecPublication AND n.id ENDS WITH ':3') "
                    "OR (n:SecRun AND (n.generationId IN $gens OR n.id IN $runs)) "
                    "RETURN elementId(n) AS eid,labels(n) AS labels",
                    gens=[r["id"] for r in generations],
                    runs=[r["run"] for r in generations],
                )
            )
            targets = {r["eid"]: r["labels"] for r in domain + controls}
            if any(
                set(labels) & {"Company", "Filing", "Item", "SecVector"}
                for labels in targets.values()
            ):
                raise ValueError("Refusing to remove shared or non-model-3 nodes")
            before = tx.run(
                "MATCH (n) WHERE n:Company OR n:Filing OR n:Item OR n:SecVector "
                "RETURN count(n) AS count"
            ).single()["count"]
            counts = {}
            for labels in targets.values():
                key = ":".join(sorted(labels))
                counts[key] = counts.get(key, 0) + 1
            if apply:
                tx.run(
                    "MATCH (n) WHERE elementId(n) IN $ids DETACH DELETE n",
                    ids=list(targets),
                ).consume()
                after = tx.run(
                    "MATCH (n) WHERE n:Company OR n:Filing OR n:Item OR n:SecVector "
                    "RETURN count(n) AS count"
                ).single()["count"]
                if after != before:
                    raise ValueError("Protected graph count changed; rolling back")
            return {
                "applied": apply,
                "deletedNodes" if apply else "targetNodes": len(targets),
                "byLabel": counts,
                "protectedNodes": before,
            }

        return session.execute_write(work) if apply else session.execute_read(work)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    graph = GraphStore()
    try:
        print(json.dumps(reset(graph, args.apply), indent=2))
    finally:
        graph.close()
