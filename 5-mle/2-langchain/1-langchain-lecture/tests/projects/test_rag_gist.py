from __future__ import annotations

from langchain_core.documents import Document

from langchain_lecture.projects.project_04_rag_gist.chain import format_docs


def test_format_docs_joins_page_content():
    docs = [Document(page_content="alpha"), Document(page_content="beta")]

    assert format_docs(docs) == "alpha\n\nbeta"

