from __future__ import annotations

from langchain_lecture.projects.project_04_rag_gist.chain import (
    build_lcel_retrieval_chain,
    build_pinecone_retriever,
)


def main() -> None:
    query = "What is Pinecone in machine learning?"
    chain = build_lcel_retrieval_chain(build_pinecone_retriever())
    print(chain.invoke({"question": query}))


if __name__ == "__main__":
    main()

