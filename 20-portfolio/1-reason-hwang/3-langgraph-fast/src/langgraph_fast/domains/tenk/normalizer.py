from __future__ import annotations

import html
import re
from pathlib import Path

SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style).*?>.*?</\1>")
BLOCK_TAG_RE = re.compile(
    r"(?is)</?(?:p|div|tr|table|br|hr|li|ul|ol|h1|h2|h3|h4|h5|h6|section|article|center|td|th)[^>]*>"
)
TAG_RE = re.compile(r"(?s)<[^>]+>")
WHITESPACE_RE = re.compile(r"[ \t]+")
BLANKLINES_RE = re.compile(r"\n{3,}")


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


def read_document_text(path: str | Path) -> str:
    file_path = Path(path)
    raw = file_path.read_text(encoding="utf-8", errors="ignore")
    if file_path.suffix.lower() in {".html", ".htm", ".xhtml", ".xml"} or _looks_like_html(raw):
        return normalize_text(html_to_text(raw))
    return normalize_text(raw)


def _looks_like_html(text: str) -> bool:
    sample = text[:4096].lower()
    return any(marker in sample for marker in ("<html", "<document", "<ix:", "</div", "</span", "<table"))
