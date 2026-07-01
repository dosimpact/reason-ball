from __future__ import annotations

from langchain_core.documents import Document

from langchain_lecture.projects.project_06_documentation_helper.ingestion import (
    split_documents,
)


def test_split_documents_keeps_document_content():
    docs = [Document(page_content="hello world", metadata={"source": "test"})]

    chunks = split_documents(docs, chunk_size=100)

    assert chunks[0].page_content == "hello world"
    assert chunks[0].metadata["source"] == "test"

