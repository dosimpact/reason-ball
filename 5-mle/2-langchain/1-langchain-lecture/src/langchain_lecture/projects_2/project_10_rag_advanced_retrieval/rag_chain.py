"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. 검색 결과와 답변 생성 단계를 하나의 RAG 체인으로 묶습니다."""

from __future__ import annotations

from dataclasses import dataclass

from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.retrievers import (
    AdvancedRetriever,
    RetrievalStrategy,
    RetrievalValidation,
    validate_retrieval,
)
from langchain_lecture.shared.documents import RankedDocument, format_ranked_documents


@dataclass(frozen=True)
class RagResponse:
    question: str
    answer: str
    sources: list[str]
    strategy: RetrievalStrategy
    validation: RetrievalValidation
    retrieved: list[RankedDocument]


def _source_list(results: list[RankedDocument]) -> list[str]:
    sources = [str(item.document.metadata.get("source", "unknown")) for item in results]
    return list(dict.fromkeys(sources))


def _synthesize_answer(question: str, results: list[RankedDocument]) -> str:
    evidence_lines = []
    for item in results[:3]:
        source = item.document.metadata.get("source", "unknown")
        evidence_lines.append(f"- [{source}] {item.document.page_content}")
    return (
        f"질문: {question}\n"
        "검색된 근거를 종합하면 다음과 같습니다.\n"
        + "\n".join(evidence_lines)
    )


class RetrievalRagChain:
    def __init__(self, retriever: AdvancedRetriever | None = None, strategy: RetrievalStrategy = "rerank") -> None:
        self.retriever = retriever or AdvancedRetriever()
        self.strategy = strategy

    def invoke(self, input: dict[str, str] | str) -> RagResponse:
        question = input if isinstance(input, str) else input.get("question", "")
        strategy = self.strategy if isinstance(input, str) else input.get("strategy", self.strategy)
        results = self.retriever.retrieve(question, strategy=strategy)  # type: ignore[arg-type]
        validation = validate_retrieval(question, results)
        if not validation.valid:
            answer = (
                "근거 부족: 로컬 corpus에서 답변을 뒷받침할 충분한 문서를 찾지 못했습니다. "
                f"{validation.reason}"
            )
        else:
            answer = _synthesize_answer(question, results)
        return RagResponse(
            question=question,
            answer=answer,
            sources=_source_list(results),
            strategy=strategy,  # type: ignore[arg-type]
            validation=validation,
            retrieved=results,
        )


def run_rag(question: str, *, strategy: RetrievalStrategy = "rerank") -> RagResponse:
    return RetrievalRagChain(strategy=strategy).invoke({"question": question, "strategy": strategy})


def format_response(response: RagResponse) -> str:
    retrieval_log = format_ranked_documents(response.retrieved)
    return (
        f"Strategy: {response.strategy}\n"
        f"Valid: {response.validation.valid} confidence={response.validation.confidence:.2f}\n"
        f"Sources: {', '.join(response.sources) or 'none'}\n\n"
        f"{response.answer}\n\n"
        f"Retrieved:\n{retrieval_log}"
    )
