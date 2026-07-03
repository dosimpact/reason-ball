"""청킹, 검색기 조합, 평가를 포함한 고급 RAG 검색 예제입니다. 고급 RAG 예제의 로컬 문서 로딩과 색인 준비를 담당합니다."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from langchain_core.documents import Document

from langchain_lecture.shared.documents import build_document
from langchain_lecture.shared.evaluation import EvaluationCase


PROJECT_DIR = Path(__file__).resolve().parent
DOCS_DIR = PROJECT_DIR / "assets" / "docs"
EVAL_QUESTIONS_PATH = PROJECT_DIR / "eval_questions.jsonl"


def _title_for(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return fallback


def _paragraphs(text: str) -> list[str]:
    return [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]


def load_raw_documents(docs_dir: Path = DOCS_DIR) -> list[Document]:
    """Load markdown files as raw source documents."""
    documents: list[Document] = []
    for path in sorted(docs_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        documents.append(
            build_document(
                text,
                source=path.name,
                title=_title_for(text, path.stem.replace("_", " ").title()),
                path=str(path),
            )
        )
    return documents


def split_documents(raw_documents: Iterable[Document]) -> list[Document]:
    """Split local source docs into paragraph chunks with stable metadata."""
    chunks: list[Document] = []
    for raw in raw_documents:
        source = str(raw.metadata.get("source", "unknown"))
        title = str(raw.metadata.get("title", source))
        chunk_index = 0
        for paragraph in _paragraphs(raw.page_content):
            if paragraph.startswith("#"):
                continue
            chunk_index += 1
            chunks.append(
                build_document(
                    paragraph,
                    source=source,
                    title=title,
                    chunk_id=f"{source}:{chunk_index}",
                    chunk_index=chunk_index,
                )
            )
    return chunks


def load_corpus(docs_dir: Path = DOCS_DIR) -> list[Document]:
    return split_documents(load_raw_documents(docs_dir))


def load_eval_questions(path: Path = EVAL_QUESTIONS_PATH) -> list[EvaluationCase]:
    cases: list[EvaluationCase] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        cases.append(
            EvaluationCase(
                question=payload["question"],
                reference=payload["reference"],
                expected_sources=list(payload["expected_sources"]),
            )
        )
    return cases
