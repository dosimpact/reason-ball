# Project 10: RAG Advanced Retrieval

## Purpose

기본 RAG를 넘어서 검색 품질을 높이는 고급 retrieval 전략을 비교하고 적용합니다. 최종 목표는 "LLM이 답을 못한다"가 아니라 "검색 단계에서 무엇이 부족했는지"를 진단하고 개선할 수 있게 되는 것입니다.

## Learning Objectives

- baseline RAG를 만들고 검색 실패 유형을 분류합니다.
- query rewriting과 multi-query retrieval의 차이를 설명합니다.
- contextual compression으로 불필요한 context를 줄입니다.
- reranking으로 검색 결과 순서를 개선합니다.
- hybrid search의 장단점을 이해합니다.
- 검색 결과를 답변 생성 전에 검증합니다.
- retrieval quality를 정성/정량으로 비교합니다.

## Core Concepts

- **Baseline RAG**: query -> retrieve -> generate의 기본 구조입니다.
- **Query rewriting**: 사용자의 질문을 검색에 유리한 형태로 다시 씁니다.
- **Multi-query retrieval**: 여러 관점의 쿼리를 생성해 recall을 높입니다.
- **Contextual compression**: 검색된 문서에서 질문과 관련 있는 부분만 남깁니다.
- **Reranking**: 1차 검색 결과를 더 정교한 모델이나 규칙으로 재정렬합니다.
- **Retrieval validation**: 답변 생성 전 충분한 근거가 있는지 확인합니다.

## Build Steps

1. 작은 문서 corpus를 준비합니다. 최소 20개 chunk 이상을 권장합니다.
2. baseline retriever와 RAG chain을 만듭니다.
3. 평가 질문 10개를 작성하고 expected source 문서를 지정합니다.
4. baseline 검색 결과의 top-k hit rate와 답변 품질을 기록합니다.
5. query rewriting을 추가하고 baseline과 비교합니다.
6. multi-query retrieval을 추가하고 recall 변화를 확인합니다.
7. contextual compression 또는 reranking을 적용하고 precision 변화를 확인합니다.
8. 검색 결과가 부족하면 "근거 부족"으로 답하도록 validation 단계를 추가합니다.

## Suggested File Layout

```text
project_10_rag_advanced_retrieval/
  README.md
  main.py
  ingest.py
  retrievers.py
  rag_chain.py
  eval_questions.jsonl
  assets/
    docs/
  tests/
    test_retrieval.py
```

## Retrieval Comparison Table

실습 중 아래 표를 채워 비교합니다.

| Strategy | Recall | Precision | Latency | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Baseline top-k |  |  |  |  |  |
| Query rewriting |  |  |  |  |  |
| Multi-query |  |  |  |  |  |
| Compression |  |  |  |  |  |
| Reranking |  |  |  |  |  |
| Hybrid search |  |  |  |  |  |

## Manual Test Scenarios

| Scenario | Input | Expected Behavior |
| --- | --- | --- |
| Direct fact | 문서에 그대로 있는 질문 | baseline도 정답 문서를 검색합니다. |
| Synonym query | 문서 표현과 질문 표현이 다른 질문 | query rewriting 또는 hybrid search가 개선됩니다. |
| Broad question | 여러 문서를 종합해야 하는 질문 | multi-query가 더 많은 관련 문서를 찾습니다. |
| No evidence | corpus에 없는 질문 | 근거 부족으로 답변을 거절하거나 제한합니다. |
| Noisy retrieval | 관련 없는 chunk가 섞이는 질문 | compression/reranking 후 context 품질이 좋아집니다. |

## Done Criteria

- baseline과 개선 전략을 같은 질문 세트로 비교했습니다.
- retrieval 결과를 눈으로 확인할 수 있게 source, score, rank를 출력합니다.
- 최소 하나 이상의 전략이 어떤 실패 유형을 개선하는지 설명할 수 있습니다.
- 근거가 부족한 질문에 hallucination을 줄이는 방어 로직이 있습니다.
- README의 comparison table을 채울 수 있습니다.

## Extension Tasks

- BM25 + vector hybrid search를 구현합니다.
- reranker 모델 또는 LLM-based reranker를 비교합니다.
- LangSmith dataset으로 RAG regression evaluation을 구성합니다.
- chunk size, overlap, top-k를 바꿔 retrieval 품질을 비교합니다.

## Official References

- LangChain RAG: https://docs.langchain.com/oss/python/langchain/rag
- Retrieval concepts: https://docs.langchain.com/oss/python/langchain/retrieval
- Text splitters: https://docs.langchain.com/oss/python/integrations/splitters
- LangSmith RAG observability: https://docs.langchain.com/langsmith/observability
