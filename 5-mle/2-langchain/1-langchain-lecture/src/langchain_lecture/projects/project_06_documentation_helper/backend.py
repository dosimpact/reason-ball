"""문서 수집, 검색, 답변 생성을 묶은 문서 도우미 RAG 예제입니다. 문서 도우미 앱의 검색과 답변 생성을 묶는 백엔드 로직입니다."""

from __future__ import annotations

from typing import Any

from langchain.tools import tool

from langchain_lecture.shared.config import load_config
from langchain_lecture.shared.models import get_chat_model


def build_vectorstore(index_name: str | None = None, embedding=None):
    from langchain_openai import OpenAIEmbeddings
    from langchain_pinecone import PineconeVectorStore

    config = load_config()
    return PineconeVectorStore(
        index_name=index_name or config.pinecone_index_name,
        embedding=embedding or OpenAIEmbeddings(model="text-embedding-3-small"),
    )


def build_retrieve_context_tool(vectorstore):
    @tool(response_format="content_and_artifact")
    def retrieve_context(query: str):
        """Retrieve relevant documentation to help answer LangChain questions."""
        retrieved_docs = vectorstore.as_retriever(search_kwargs={"k": 4}).invoke(query)
        serialized = "\n\n".join(
            f"Source: {doc.metadata.get('source', 'Unknown')}\n\nContent: {doc.page_content}"
            for doc in retrieved_docs
        )
        return serialized, retrieved_docs

    return retrieve_context


def build_docs_agent(vectorstore=None, model=None):
    from langchain.agents import create_agent

    resolved_vectorstore = vectorstore or build_vectorstore()
    return create_agent(
        model=model or get_chat_model(temperature=0),
        tools=[build_retrieve_context_tool(resolved_vectorstore)],
        system_prompt=(
            "You answer questions about LangChain documentation. Retrieve relevant "
            "documentation before answering and cite sources when available."
        ),
    )


def run_llm(query: str, vectorstore=None, model=None) -> dict[str, Any]:
    from langchain_core.messages import ToolMessage

    agent = build_docs_agent(vectorstore=vectorstore, model=model)
    response = agent.invoke({"messages": [{"role": "user", "content": query}]})
    context_docs = []
    for message in response["messages"]:
        if isinstance(message, ToolMessage) and isinstance(message.artifact, list):
            context_docs.extend(message.artifact)
    return {
        "answer": response["messages"][-1].content,
        "context": context_docs,
    }

