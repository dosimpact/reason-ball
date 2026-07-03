"""문서 검색 결과를 프롬프트에 넣어 답변하는 RAG 기본 흐름 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_04_rag_gist.chain import (
    build_lcel_retrieval_chain,
    build_pinecone_retriever,
)


# 예제 실행 진입점입니다.
def main() -> None:
    query = "What is Pinecone in machine learning?"
    chain = build_lcel_retrieval_chain(build_pinecone_retriever())
    print(chain.invoke({"question": query}))


if __name__ == "__main__":
    main()

