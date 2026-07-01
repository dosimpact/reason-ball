from __future__ import annotations

from pathlib import Path

from langchain_core.documents import Document

from langchain_lecture.shared.config import load_config


def load_pdf_documents(pdf_path: str | Path) -> list[Document]:
    from langchain_community.document_loaders import PyPDFLoader

    return PyPDFLoader(file_path=str(pdf_path)).load()


def split_documents(documents: list[Document], *, chunk_size: int = 1000):
    from langchain_text_splitters import CharacterTextSplitter

    splitter = CharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=30,
        separator="\n",
    )
    return splitter.split_documents(documents)


def index_documents_in_pinecone(documents: list[Document], index_name: str | None = None):
    from langchain_openai import OpenAIEmbeddings
    from langchain_pinecone import PineconeVectorStore

    config = load_config()
    return PineconeVectorStore.from_documents(
        documents=documents,
        embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
        index_name=index_name or config.pinecone_index_name,
    )

