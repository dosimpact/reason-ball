from __future__ import annotations

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.graph import graph
from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.ingest import (
    load_corpus,
    load_eval_questions,
)
from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.rag_chain import (
    run_rag,
)
from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.retrievers import (
    AdvancedRetriever,
    validate_retrieval,
)


def sources(results):
    return [item.document.metadata["source"] for item in results]


def test_load_corpus_splits_local_docs_into_many_chunks():
    docs = load_corpus()

    assert len(docs) >= 20
    assert all("source" in doc.metadata for doc in docs)
    assert all("chunk_id" in doc.metadata for doc in docs)


def test_eval_questions_load_expected_sources():
    cases = load_eval_questions()

    assert len(cases) == 10
    assert cases[0].expected_sources == ["operations_runbook.md"]


def test_query_rewrite_improves_synonym_retrieval_for_latency_question():
    retriever = AdvancedRetriever()
    query = "챗봇 응답이 느려질 때 어디를 봐야 하나요?"

    baseline = retriever.retrieve(query, strategy="baseline", top_k=3)
    rewritten = retriever.retrieve(query, strategy="rewrite", top_k=3)

    assert "operations_runbook.md" in sources(rewritten)
    assert rewritten[0].score > (baseline[0].score if baseline else 0)


def test_multi_query_recovers_multiple_sources_for_broad_question():
    retriever = AdvancedRetriever()
    query = "여러 문서를 종합해서 검색 품질과 chunk 전략을 비교해 주세요"

    results = retriever.retrieve(query, strategy="multi_query", top_k=6)

    assert "retrieval_quality.md" in sources(results)
    assert "chunking_guide.md" in sources(results)


def test_compression_keeps_relevant_sentences_and_shortens_context():
    retriever = AdvancedRetriever()
    query = "비용을 줄이려면 어떤 RAG 설정을 조정하나요?"

    reranked = retriever.retrieve(query, strategy="rerank", top_k=1)
    compressed = retriever.retrieve(query, strategy="compression", top_k=1)

    assert compressed[0].document.metadata["compressed"] is True
    assert len(compressed[0].document.page_content) <= len(reranked[0].document.page_content)
    assert compressed[0].score >= reranked[0].score


def test_validation_rejects_no_evidence_query():
    retriever = AdvancedRetriever()
    results = retriever.retrieve("환불 정책과 배송 일정은 무엇인가요?", strategy="rerank")

    validation = validate_retrieval("환불 정책과 배송 일정은 무엇인가요?", results)

    assert validation.valid is False


def test_rag_chain_refuses_when_retrieval_is_not_grounded():
    response = run_rag("환불 정책과 배송 일정은 무엇인가요?", strategy="rerank")

    assert response.validation.valid is False
    assert "근거 부족" in response.answer


def test_langgraph_wrapper_returns_grounded_answer():
    result = graph.invoke(
        {
            "question": "검색 결과가 부족하면 어떻게 답해야 하나요?",
            "strategy": "rerank",
        }
    )

    assert result["valid"] is True
    assert "retrieval_quality.md" in result["sources"] or "safety_notes.md" in result["sources"]
    assert result["error"] == ""
