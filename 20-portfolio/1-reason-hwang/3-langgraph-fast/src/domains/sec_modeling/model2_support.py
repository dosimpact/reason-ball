"""Reconcile every validated proposition occurrence with its existing Toolkit nodes."""

import hashlib
import json
from pathlib import Path

BUILD_POLICY_VERSION = "sec-model2-support/2;chunk-id-evidence;match-existing-toolkit-ids;all-proposition-occurrences"
BUILD_POLICY_HASH = hashlib.sha256(BUILD_POLICY_VERSION.encode()).hexdigest()


def expected_support_rows(chunks, evidence_dir, id_generator):
    rows = {}
    for chunk in chunks:
        key = hashlib.sha256(chunk["chunkId"].encode()).hexdigest()
        path = Path(evidence_dir) / (key + ".json")
        if not path.is_file():
            raise ValueError(
                "Missing Chunk topic Decisions evidence for support reconciliation"
            )
        evidence = json.loads(path.read_text())
        if evidence.get("chunkId") != chunk["chunkId"]:
            raise ValueError("Chunk evidence identity mismatch")
        assignments = evidence.get("assignments", [])
        if len(assignments) != len(evidence.get("propositions", [])):
            raise ValueError("Incomplete topic assignments for support reconciliation")
        for assignment in assignments:
            topic_id = id_generator.create_topic_id(
                chunk["sourceId"], assignment["topic"]
            )
            statement_id = id_generator.create_statement_id(
                topic_id, assignment["proposition"]
            )
            row = {
                "chunkId": chunk["chunkId"],
                "sourceId": chunk["sourceId"],
                "topicId": topic_id,
                "statementId": statement_id,
                "value": assignment["proposition"],
            }
            rows[(statement_id, chunk["chunkId"])] = row
    return list(rows.values())


def reconcile_statement_support(store, generation, evidence_dir=None):
    """Only add support relationships after proving every target node already exists."""
    from graphrag_toolkit.lexical_graph import TenantId
    from graphrag_toolkit.lexical_graph.indexing import IdGenerator

    tenant = TenantId(hashlib.sha256(generation.encode()).hexdigest()[:24])
    labels = {
        kind: tenant.format_label(f"__{kind}__")
        for kind in ("Source", "Chunk", "Statement", "Topic")
    }
    chunks = store.query(
        f"MATCH (c:{labels['Chunk']})-[:__EXTRACTED_FROM__]->(s:{labels['Source']}) RETURN c.chunkId AS chunkId,c.value AS text,c.itemId AS itemId,s.sourceId AS sourceId"
    )
    if not chunks or any(not chunk.get("itemId") for chunk in chunks):
        raise ValueError(
            "Support reconciliation requires existing source-bound Chunks with itemId"
        )
    rows = expected_support_rows(
        chunks,
        evidence_dir or Path(".tmp/sec-modeling") / generation / "topic-decisions",
        IdGenerator(tenant_id=tenant),
    )
    match = (
        f"MATCH (c:{labels['Chunk']} {{chunkId:row.chunkId}})-[:__EXTRACTED_FROM__]->(:{labels['Source']} {{sourceId:row.sourceId}}) "
        f"MATCH (s:{labels['Statement']} {{statementId:row.statementId}})-[:__BELONGS_TO__]->(:{labels['Topic']} {{topicId:row.topicId}}) "
        "WHERE s.value=row.value "
    )
    expected = len(rows)
    before = 0
    # Validate all batches before making any changes. MATCH never invents a node.
    for offset in range(0, expected, 100):
        result = store.query(
            "UNWIND $rows AS row "
            + match
            + "RETURN count(*) AS matched,sum(CASE WHEN (s)-[:__MENTIONED_IN__]->(c) THEN 1 ELSE 0 END) AS supported",
            rows=rows[offset : offset + 100],
        )[0]
        if result["matched"] != len(rows[offset : offset + 100]):
            raise ValueError(
                "Expected proposition Statement/Topic/Chunk nodes do not match existing graph"
            )
        before += result["supported"] or 0
    for offset in range(0, expected, 100):
        store.query(
            "UNWIND $rows AS row "
            + match
            + "MERGE (s)-[:__MENTIONED_IN__]->(c) RETURN count(*) AS n",
            rows=rows[offset : offset + 100],
        )
    after = 0
    for offset in range(0, expected, 100):
        after += store.query(
            "UNWIND $rows AS row "
            + match
            + "MATCH (s)-[:__MENTIONED_IN__]->(c) RETURN count(*) AS n",
            rows=rows[offset : offset + 100],
        )[0]["n"]
    if after != expected:
        raise ValueError("Incomplete proposition-to-Chunk support after reconciliation")
    return {
        "expectedSupportEdges": expected,
        "existingSupportEdges": before,
        "createdSupportEdges": expected - before,
        "verifiedSupportEdges": after,
    }
