import json

from domains.sec_modeling.search import supporting_chunks


def test_statement_provenance_is_exact_chunk_and_generation():
    statement = {"id": "s", "kind": "statement", "generationId": "g", "filingId": "f"}
    def chunk(identity, generation="g", filing="f"):
        return {"v": {"id": identity, "text": identity, "kind": "chunk", "generationId": generation, "filingId": filing, "metadata": json.dumps({"chunk": {"chunkId": identity}})}}
    class Store:
        def query(self, cypher, **params):
            assert params == {"generation": "g", "filing": "f", "chunk": "correct"}
            return [chunk("correct"), chunk("other"), chunk("correct", "old"), chunk("correct", filing="wrong")]
    result = supporting_chunks(statement, {"statement": {"chunkId": "correct"}}, Store())
    assert result == [{"id": "correct", "filingId": "f", "generationId": "g", "text": "correct"}]


def test_statement_without_chunk_link_cannot_use_item_as_provenance():
    assert supporting_chunks({"kind": "statement"}, {}, object()) == []


def test_native_index_expands_then_falls_back_without_scope_leakage():
    from domains.sec_modeling.contracts import SearchRequest
    from domains.sec_modeling.search import scoped_candidates
    calls = []
    class Store:
        def query(self, query, **params):
            calls.append((query, params))
            assert params["filings"] == ["f"] and params["gens"] == ["g"]
            return []
    assert scoped_candidates(SearchRequest(query="risk", filingIds=["f"], topK=10), Store(), ["g"], [1.]) == []
    assert [call[1]["candidates"] for call in calls[:3]] == [40, 160, 640]
    assert "vector.similarity.cosine" in calls[3][0]


def test_native_index_avoids_exact_scan_when_both_rankings_have_candidates():
    from domains.sec_modeling.contracts import SearchRequest
    from domains.sec_modeling.search import scoped_candidates
    class Store:
        def query(self, query, **params):
            assert "db.index.vector.queryNodes" in query
            return [{"node": {"id": kind, "kind": kind, "generationId": "g", "filingId": "f"}, "score": 1.} for kind in ("chunk", "statement")]
    result = scoped_candidates(SearchRequest(query="risk", filingIds=["f"], topK=1), Store(), ["g"], [1.])
    assert len(result) == 2


def test_candidate_queries_project_payload_without_embedding():
    from domains.sec_modeling.contracts import SearchRequest
    from domains.sec_modeling.search import scoped_candidates
    class Store:
        def query(self, query, **params):
            projection = query.split("RETURN ", 1)[1].split(" AS node", 1)[0]
            assert "properties(" not in projection
            assert ".embedding" not in projection
            for field in (".id", ".kind", ".text", ".filingId", ".generationId", ".metadata"):
                assert field in projection
            return []
    scoped_candidates(SearchRequest(query="risk", filingIds=["f"]), Store(), ["g"], [1.])


def test_historical_and_current_record_citations_report_publication_pointer():
    from domains.sec_modeling.search import evidence
    class Store:
        def __init__(self, active):
            self.active = active
        def query(self, query, **params):
            assert "SecGeneration" in query and "[:ACTIVE]->(g)" in query
            return [{"data": json.dumps({"id": "item", "text": "published text"}), "isActive": self.active}]
    assert evidence("item", Store(True))["isActive"] is True
    historic = evidence("item", Store(False))
    assert historic["isActive"] is False
    assert historic["text"] == "published text"


def test_vector_citation_reports_historical_status():
    from domains.sec_modeling.search import evidence
    class Store:
        def query(self, query, **params):
            if "SecRecord" in query:
                return []
            assert "[:ACTIVE]->(g)" in query
            return [{"v": {"id": "v", "kind": "chunk", "generationId": "old", "filingId": "f", "text": "history", "metadata": "{}"}, "isActive": False}]
    result = evidence("v", Store())
    assert result is not None
    assert result["isActive"] is False
    assert result["text"] == "history"
