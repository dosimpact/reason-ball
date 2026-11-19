"""Each duplicate proposition occurrence keeps its own source Chunk edge."""

import hashlib
import json

import pytest

from domains.sec_modeling.model2_support import (
    expected_support_rows,
    reconcile_statement_support,
)


class Ids:
    def create_topic_id(self, source, topic):
        return source + ":" + topic

    def create_statement_id(self, topic, statement):
        return topic + ":" + statement


def test_same_statement_in_two_chunks_requires_two_edges(tmp_path):
    chunks = [
        {"itemId": "item", "text": text, "sourceId": "source", "chunkId": chunk}
        for text, chunk in [("First source", "c1"), ("Overlapping source", "c2")]
    ]
    for chunk in chunks:
        key = hashlib.sha256(chunk["chunkId"].encode()).hexdigest()
        (tmp_path / (key + ".json")).write_text(
            json.dumps(
                {
                    "chunkId": chunk["chunkId"],
                    "propositions": ["Same statement"],
                    "assignments": [
                        {"topic": "Topic", "proposition": "Same statement"}
                    ],
                }
            )
        )
    rows = expected_support_rows(chunks, tmp_path, Ids())
    assert len(rows) == 2
    assert rows[0]["statementId"] == rows[1]["statementId"]
    assert {row["chunkId"] for row in rows} == {"c1", "c2"}


def test_reconciliation_missing_nodes_never_mutates(tmp_path, monkeypatch):
    from domains.sec_modeling import model2_support

    monkeypatch.setattr(
        model2_support,
        "expected_support_rows",
        lambda *args: [{"statementId": "missing"}],
    )

    class Store:
        def __init__(self):
            self.queries = []

        def query(self, query, **params):
            self.queries.append(query)
            if "RETURN c.chunkId" in query:
                return [{"itemId": "item"}]
            return [{"matched": 0, "supported": 0}]

    store = Store()
    with pytest.raises(ValueError, match="nodes do not match"):
        reconcile_statement_support(store, "generation", tmp_path)
    assert all("MERGE" not in query for query in store.queries)


def test_reconciliation_adds_only_missing_support_relationship(tmp_path, monkeypatch):
    from domains.sec_modeling import model2_support

    monkeypatch.setattr(
        model2_support,
        "expected_support_rows",
        lambda *args: [
            {"statementId": "same", "chunkId": "c1"},
            {"statementId": "same", "chunkId": "c2"},
        ],
    )

    class Store:
        def __init__(self):
            self.queries = []

        def query(self, query, **params):
            self.queries.append(query)
            if "RETURN c.chunkId" in query:
                return [{"itemId": "item"}]
            if "AS matched" in query:
                return [{"matched": 2, "supported": 1}]
            return [{"n": 2}]

    store = Store()
    result = reconcile_statement_support(store, "generation", tmp_path)
    assert result == {
        "expectedSupportEdges": 2,
        "existingSupportEdges": 1,
        "createdSupportEdges": 1,
        "verifiedSupportEdges": 2,
    }
    mutations = [query for query in store.queries if "MERGE" in query]
    assert len(mutations) == 1
    assert "MERGE (s)-[:__MENTIONED_IN__]->(c)" in mutations[0]
    assert "MERGE (s:" not in mutations[0]
