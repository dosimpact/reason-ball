"""문서 검색 결과를 프롬프트에 넣어 답변하는 RAG 기본 흐름 예제입니다. 프롬프트, 모델, 파서를 조합해 재사용 가능한 체인을 만듭니다."""

from __future__ import annotations

from collections.abc import Iterable
from operator import itemgetter

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

from langchain_lecture.projects.project_04_rag_gist.prompts import RAG_PROMPT_TEMPLATE
from langchain_lecture.shared.config import load_config
from langchain_lecture.shared.models import get_chat_model


def format_docs(docs: Iterable[Document]) -> str:
    return "\n\n".join(doc.page_content for doc in docs)


def build_pinecone_retriever(index_name: str | None = None, embedding=None):
    from langchain_openai import OpenAIEmbeddings
    from langchain_pinecone import PineconeVectorStore

    config = load_config()
    embeddings = embedding or OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = PineconeVectorStore(
        index_name=index_name or config.pinecone_index_name,
        embedding=embeddings,
    )
    return vectorstore.as_retriever(search_kwargs={"k": 3})


def build_lcel_retrieval_chain(retriever, model=None):
    prompt = ChatPromptTemplate.from_template(RAG_PROMPT_TEMPLATE)
    llm = model or get_chat_model(temperature=0)
    return (
        RunnablePassthrough.assign(context=itemgetter("question") | retriever | format_docs)
        | prompt
        | llm
        | StrOutputParser()
    )


def answer_without_lcel(query: str, retriever, model=None) -> str:
    prompt = ChatPromptTemplate.from_template(RAG_PROMPT_TEMPLATE)
    llm = model or get_chat_model(temperature=0)
    docs = retriever.invoke(query)
    messages = prompt.format_messages(context=format_docs(docs), question=query)
    response = llm.invoke(messages)
    return str(getattr(response, "content", response))

