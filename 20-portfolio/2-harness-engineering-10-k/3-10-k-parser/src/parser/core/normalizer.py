from __future__ import annotations

import html
import re
from pathlib import Path

from .models import FilingDocument

SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style).*?>.*?</\1>")
BLOCK_TAG_RE = re.compile(
    r"(?is)</?(?:p|div|tr|table|br|hr|li|ul|ol|h1|h2|h3|h4|h5|h6|section|article|center|td|th)[^>]*>"
)
TAG_RE = re.compile(r"(?s)<[^>]+>")
WHITESPACE_RE = re.compile(r"[ \t]+")
BLANKLINES_RE = re.compile(r"\n{3,}")


def load_document_text(document: FilingDocument) -> str:
    if document.content:
        return document.content

    if not document.local_path:
        raise ValueError(f"document_id={document.document_id} has neither content nor local_path")

    path = Path(document.local_path)
    if not path.exists():
        raise FileNotFoundError(f"document_id={document.document_id} local_path not found: {path}")

    suffix = path.suffix.lower()
    if suffix in {".html", ".htm", ".xhtml", ".xml"}:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        return html_to_text(raw)

    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")

    return path.read_text(encoding="utf-8", errors="ignore")


def html_to_text(raw_html: str) -> str:
    no_script = SCRIPT_STYLE_RE.sub(" ", raw_html)
    with_block_breaks = BLOCK_TAG_RE.sub("\n", no_script)
    no_tags = TAG_RE.sub(" ", with_block_breaks)
    return html.unescape(no_tags)


def normalize_text(text: str) -> str:
    text = text.replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")
    lines = [WHITESPACE_RE.sub(" ", line).strip() for line in text.split("\n")]
    joined = "\n".join(line for line in lines if line)
    return BLANKLINES_RE.sub("\n\n", joined).strip()
