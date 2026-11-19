import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from domains.sec_modeling.contracts import ModelingRequest, SearchRequest
from domains.sec_modeling.search import evidence, search
from server.routers.sec_modeling import router


def test_service_key(monkeypatch):
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        monkeypatch.delenv("SEC_MODELING_KEY", raising=False)
        assert (
            client.post(
                "/api/sec-analysis/search", json={"query": "q", "filingIds": ["a"]}
            ).status_code
            == 503
        )
        monkeypatch.setenv("SEC_MODELING_KEY", "private-test")
        assert (
            client.post(
                "/api/sec-analysis/search", json={"query": "q", "filingIds": ["a"]}
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/sec-analysis/search",
                headers={"X-SEC-Modeling-Key": "private-test"},
                json={"query": "q", "filingIds": []},
            ).status_code
            == 422
        )


def test_schema_rejects_unknown_model():
    with pytest.raises(ValueError):
        ModelingRequest.model_validate(
            {
                "runId": "r",
                "executionToken": "t",
                "cik": "0000320193",
                "accessionNo": "0000320193-26-000026",
                "extractionModel": "fake",
            }
        )


def test_stale_generations_do_not_search():
    class Store:
        def active(self, filing, stage):
            return (
                {"id": "new"}
                if stage == 1
                else {"id": "oldlexical", "inputGenerationId": "old"}
            )

        def query(self, *args, **kwargs):
            raise AssertionError("stale graph queried")

    assert search(SearchRequest(query="q", filingIds=["a"]), Store()) == {
        "items": [],
        "total": 0,
    }


def test_evidence_requires_published_generation():
    class Store:
        def query(self, cypher, **kwargs):
            assert "SecGeneration" in cypher
            return []

    assert evidence("draft", Store()) is None


def test_scoped_retrieval_uses_only_selected_compatible_generations(monkeypatch):
    monkeypatch.setattr("domains.sec_modeling.search.embed", lambda text: [[1.0]])

    class Store:
        def active(self, filing, stage):
            assert filing == "requested"
            return (
                {"id": "first"}
                if stage == 1
                else {"id": "second", "inputGenerationId": "first"}
            )

        def query(self, cypher, **kwargs):
            assert kwargs["gens"] == ["second"]
            return [
                {
                    "score": 1.0,
                    "node": {
                        "id": "v",
                        "kind": "chunk",
                        "text": "evidence",
                        "filingId": "requested",
                        "generationId": "second",
                        "metadata": json.dumps(
                            {"source": {"metadata": {"itemId": "i", "itemCode": "1"}}}
                        ),
                    },
                }
            ]

    result = search(SearchRequest(query="q", filingIds=["requested"]), Store())
    assert result["items"][0]["itemId"] == "i"


def test_extraction_model_never_serializes_credentials():
    from domains.sec_modeling.llm import OAuthExtractionLLM

    model = OAuthExtractionLLM(
        model="gpt-5.6-sol",
        api_key="arbitrary-private-test-value",
        api_base="http://127.0.0.1:2890/v1",
        is_chat_model=True,
    )
    assert "arbitrary-private-test-value" not in model.to_json()
    assert "temperature" not in model._get_model_kwargs()
    assert model._get_model_kwargs()["reasoning_effort"] == "low"
    assert "sec-extraction/2" in model.to_json()


def test_vector_cache_reuses_same_model_and_text(monkeypatch):
    from llama_index.core.schema import TextNode

    from domains.sec_modeling.vector import Neo4jVectorIndex

    calls = []
    monkeypatch.setattr(
        "domains.sec_modeling.vector.embed",
        lambda texts: calls.append(texts) or [[0.5] * 1536 for _ in texts],
    )

    class Store:
        def __init__(self):
            self.rows = []

        def query(self, cypher, **kwargs):
            if "RETURN v.embeddingCacheKey" in cypher:
                return [
                    {"key": r["embeddingCacheKey"], "vector": r["embedding"]}
                    for r in self.rows
                    if r["embeddingCacheKey"] in kwargs["keys"]
                ]
            self.rows.extend(kwargs["rows"])
            return []

    store = Store()
    first = Neo4jVectorIndex(index_name="chunk", generation_id="first", filing_id="f")
    first._store = store
    second = Neo4jVectorIndex(index_name="chunk", generation_id="second", filing_id="f")
    second._store = store
    node = TextNode(text="Reported revenue evidence", id_="n")
    first.add_embeddings([node])
    second.add_embeddings([node])
    assert len(calls) == 1
    assert {r["generationId"] for r in store.rows} == {"first", "second"}
    assert all(r["embeddingDimensions"] == 1536 for r in store.rows)


@pytest.mark.parametrize(
    "dimension,similarity,state",
    [
        (1024, "COSINE", "ONLINE"),
        (1536, "EUCLIDEAN", "ONLINE"),
        (1536, "COSINE", "POPULATING"),
    ],
)
def test_wrong_vector_schema_rejected(dimension, similarity, state):
    from domains.sec_modeling.store import GraphStore

    store = object.__new__(GraphStore)
    store.query = lambda *args, **kwargs: [
        {
            "name": "sec_evidence_embedding",
            "type": "VECTOR",
            "state": state,
            "options": {
                "indexConfig": {
                    "vector.dimensions": dimension,
                    "vector.similarity_function": similarity,
                }
            },
        },
        {"name": "sec_embedding_cache", "state": "ONLINE"},
    ]
    with pytest.raises(ValueError, match="schema migration"):
        store.validate_indexes()


def test_extraction_credentials_never_inherit_embedding_key(monkeypatch):
    from domains.sec_modeling.llm import extraction_api_key

    monkeypatch.setenv('OPENAI_API_KEY', 'private-embedding-credential')
    monkeypatch.delenv('SEC_EXTRACTION_API_KEY', raising=False)
    assert extraction_api_key() == 'oauth'
    monkeypatch.setenv('SEC_EXTRACTION_API_KEY', 'dedicated-extraction-credential')
    assert extraction_api_key() == 'dedicated-extraction-credential'
