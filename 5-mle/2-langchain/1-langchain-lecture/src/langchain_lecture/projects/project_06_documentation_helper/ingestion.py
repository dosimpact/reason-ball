from __future__ import annotations

from langchain_core.documents import Document


def split_documents(
    documents: list[Document],
    *,
    chunk_size: int = 4000,
    chunk_overlap: int = 200,
):
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    safe_overlap = min(chunk_overlap, max(chunk_size - 1, 0))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=safe_overlap,
    )
    return splitter.split_documents(documents)


async def index_documents_async(vectorstore, documents: list[Document], batch_size: int = 50):
    batches = [documents[i : i + batch_size] for i in range(0, len(documents), batch_size)]
    for batch in batches:
        await vectorstore.aadd_documents(batch)
    return len(documents)
