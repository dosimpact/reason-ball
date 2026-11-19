"""Deterministic model-1 extraction for body-block 10-K HTML.

No LLM, embeddings, XBRL facts, raw-HTML storage, or external read dependency.
Unsupported layouts fail instead of silently emitting an incomplete graph.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup
from bs4.element import Comment, NavigableString, Tag

PARSER_VERSION = "sec-model1/1.0"
ITEM_CODES = (
    "1",
    "1A",
    "1B",
    "1C",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "7A",
    "8",
    "9",
    "9A",
    "9B",
    "9C",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
)
ITEM_HEADER = re.compile(r"^Item\s+(\d{1,2}[A-C]?)\s*\.\s*(.+)$", re.IGNORECASE)
ALLOWED_TAGS = {
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "sub",
    "sup",
    "br",
    "hr",
    "a",
    "blockquote",
    "pre",
}
DROP_TAGS = {
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "link",
    "meta",
    "base",
    "svg",
    "math",
    "img",
    "canvas",
    "video",
    "audio",
    "source",
}
BLOCK_TAGS = {
    "div",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "tr",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "blockquote",
    "pre",
    "br",
    "hr",
}
STYLE_PROPERTIES = {
    "text-align",
    "vertical-align",
    "font-weight",
    "font-style",
    "text-decoration",
    "color",
    "background-color",
    "border",
    "border-top",
    "border-bottom",
    "border-left",
    "border-right",
    "border-collapse",
    "padding",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "width",
    "min-width",
    "max-width",
    "text-indent",
    "white-space",
}


@dataclass(frozen=True)
class FilingMetadata:
    cik: str
    name: str
    ticker: str
    accession_no: str
    filing_date: str
    report_date: str
    source_url: str
    form_type: str = "10-K"

    def validate(self) -> None:
        if not re.fullmatch(r"\d{10}", self.cik):
            raise ValueError("CIK must be ten digits")
        if not re.fullmatch(r"\d{10}-\d{2}-\d{6}", self.accession_no):
            raise ValueError("Invalid accession number")
        if self.form_type != "10-K":
            raise ValueError("Model-1 prototype supports 10-K only")
        if not self.name or not self.ticker:
            raise ValueError("Company name and ticker are required")


def sha256(value: bytes | str) -> str:
    return hashlib.sha256(
        value.encode("utf-8") if isinstance(value, str) else value
    ).hexdigest()


def _clean_style(style: str) -> str:
    safe = []
    for declaration in style.split(";"):
        key, separator, value = declaration.partition(":")
        key, value = key.strip().lower(), value.strip()
        if (
            separator
            and key in STYLE_PROPERTIES
            and re.fullmatch(r"[\w\s#.,%()'\-]+", value)
        ) and not re.search(r"url|expression|var\(|attr\(|\\", value, re.IGNORECASE):
            safe.append(f"{key}:{value}")
    return ";".join(safe)


def sanitize_html(html: str) -> str:
    """Allow only inert display markup; unwrap inline facts, remove hidden metadata."""
    soup = BeautifulSoup(html, "html.parser")
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()
    for tag in list(soup.find_all(True)):
        if tag.name is None or tag.attrs is None:
            continue
        name = tag.name.lower()
        style = str(tag.get("style", ""))
        hidden = tag.has_attr("hidden") or bool(
            re.search(
                r"(?:display\s*:\s*none|visibility\s*:\s*hidden)", style, re.IGNORECASE
            )
        )
        if (
            hidden
            or name in DROP_TAGS
            or name in {"ix:header", "ix:hidden", "ix:references", "ix:resources"}
            or name.startswith(("xbrli:", "xbrldi:", "link:"))
        ):
            tag.decompose()
            continue
        if name not in ALLOWED_TAGS:
            tag.unwrap()
            continue
        attrs: dict[str, str] = {}
        for key in ("id", "title"):
            value = tag.get(key)
            if isinstance(value, str):
                attrs[key] = value
        if name in {"td", "th", "col"}:
            for key in ("colspan", "rowspan", "span"):
                value = str(tag.get(key, ""))
                if re.fullmatch(r"[1-9]\d{0,3}", value):
                    attrs[key] = value
        if name == "a":
            href = tag.get("href")
            if isinstance(href, str) and href.startswith("#"):
                attrs["href"] = href
        safe_style = _clean_style(style)
        if safe_style:
            attrs["style"] = safe_style
        tag.attrs.clear()
        tag.attrs.update(attrs)
    return str(soup)


def display_text(html: str) -> str:
    """Retain block boundaries and table cell delimiters, without splitting inline numbers."""
    soup = BeautifulSoup(html, "html.parser")

    def visit(node: Any) -> str:
        if isinstance(node, NavigableString):
            return str(node).replace("\xa0", " ")
        content = "".join(visit(child) for child in node.children)
        if node.name in {"td", "th"}:
            return re.sub(r"\s+", " ", content).strip() + "\t"
        if node.name in BLOCK_TAGS:
            return "\n" + content + "\n"
        return content

    lines = []
    for line in visit(soup).splitlines():
        line = re.sub(r"[^\S\t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _validate_document_identity(soup: BeautifulSoup, meta: FilingMetadata) -> None:
    expected = {
        "dei:entitycentralindexkey": meta.cik,
        "dei:documenttype": meta.form_type,
        "dei:documentperiodenddate": meta.report_date,
    }
    for key, expected_value in expected.items():
        elements = soup.find_all(
            lambda tag, expected_name=key: (
                str(tag.get("name", "")).lower() == expected_name
            )
        )
        if not elements:
            raise ValueError(f"Missing source identity: {key}")
        values = {" ".join(element.get_text().split()) for element in elements}
        if key.endswith("documentperiodenddate"):
            normalized = set()
            for value in values:
                try:
                    normalized.add(
                        datetime.strptime(value, "%B %d, %Y").date().isoformat()
                    )
                except ValueError:
                    normalized.add(value)
            values = normalized
        if key.endswith("entitycentralindexkey"):
            values = {value.zfill(10) for value in values}
        if expected_value not in values:
            raise ValueError(f"Metadata does not match source {key}")


def _body_blocks(soup: BeautifulSoup) -> list[Tag | NavigableString]:
    if soup.body is None:
        raise ValueError("Expected an HTML body")
    # XBRL wrappers may surround whole stretches of visible body content.
    for tag in list(soup.body.find_all(True)):
        if (
            tag.name
            and tag.name.startswith("ix:")
            and tag.name
            not in {"ix:header", "ix:hidden", "ix:references", "ix:resources"}
        ):
            tag.unwrap()
    return [
        node for node in soup.body.children if isinstance(node, (Tag, NavigableString))
    ]


def _item_boundaries(
    blocks: list[Tag | NavigableString], expected_codes: tuple[str, ...] | None
) -> list[tuple[int, str, str]]:
    boundaries = []
    for index, block in enumerate(blocks):
        if not isinstance(block, Tag):
            continue
        text = " ".join(block.get_text(" ", strip=True).split())
        match = ITEM_HEADER.fullmatch(text) if len(text) < 220 else None
        if match is None or block.find("a", href=True):
            continue
        code, title = match.group(1).upper(), match.group(2)
        if code not in ITEM_CODES:
            continue
        boundaries.append((index, code, title))
    codes = [boundary[1] for boundary in boundaries]
    if (
        not codes
        or codes[0] != "1"
        or len(set(codes)) != len(codes)
        or codes != sorted(codes, key=ITEM_CODES.index)
    ):
        raise ValueError(f"Missing, duplicate or out-of-order Item boundaries: {codes}")
    if expected_codes is not None and tuple(codes) != expected_codes:
        raise ValueError(
            f"Incomplete sample Item boundaries: expected {list(expected_codes)}, found {codes}"
        )
    return boundaries


def _node(label: str, node_id: str, props: dict[str, Any]) -> dict[str, Any]:
    return {
        "labels": [label],
        "key": {"id": node_id},
        "properties": {"id": node_id, **props},
    }


def _relation(kind: str, start: dict[str, Any], end: dict[str, Any]) -> dict[str, Any]:
    def reference(node: dict[str, Any]) -> dict[str, Any]:
        return {"labels": node["labels"], "key": node["key"]}

    return {
        "type": kind,
        "start": reference(start),
        "end": reference(end),
        "properties": {},
    }


def parse_document(
    raw: bytes, meta: FilingMetadata, *, expected_codes: tuple[str, ...] | None = None
) -> dict[str, Any]:
    """Return model-1 graph payload and coverage evidence for one validated 10-K."""
    meta.validate()
    soup = BeautifulSoup(raw.decode("utf-8", errors="strict"), "html.parser")
    _validate_document_identity(soup, meta)
    blocks = _body_blocks(soup)
    boundaries = _item_boundaries(blocks, expected_codes)
    trailing_start = next(
        (
            index
            for index, block in enumerate(blocks)
            if index > boundaries[-1][0]
            and isinstance(block, Tag)
            and block.get_text(" ", strip=True).strip().upper() == "SIGNATURES"
        ),
        len(blocks),
    )
    company_id = f"company:{meta.cik}"
    filing_id = f"filing:{meta.cik}:{meta.accession_no}"
    company = _node(
        "Company",
        company_id,
        {"cik": meta.cik, "name": meta.name, "ticker": meta.ticker},
    )
    filing = _node(
        "Filing",
        filing_id,
        {
            "accessionNo": meta.accession_no,
            "formType": meta.form_type,
            "filingDate": meta.filing_date,
            "reportDate": meta.report_date,
            "sourceUrl": meta.source_url,
            "sourceHash": sha256(raw),
            "parserVersion": PARSER_VERSION,
            "model": "sec-model1",
        },
    )
    nodes = [company, filing]
    relationships = [_relation("FILED", company, filing)]
    summaries = []
    for order, (start, code, title) in enumerate(boundaries, 1):
        end = boundaries[order][0] if order < len(boundaries) else trailing_start
        html = sanitize_html("".join(str(block) for block in blocks[start:end]))
        text = display_text(html)
        number = int(re.match(r"\d+", code).group())  # type: ignore[union-attr]
        part = (
            "I"
            if number <= 4
            else "II"
            if number <= 9
            else "III"
            if number <= 14
            else "IV"
        )
        item = _node(
            "Item",
            f"{filing_id}:item:{part}:{code}",
            {
                "partCode": part,
                "itemCode": code,
                "title": title,
                "order": order,
                "displayHtml": html,
                "text": text,
                "contentHash": sha256(html),
                "parserVersion": PARSER_VERSION,
            },
        )
        nodes.append(item)
        relationships.append(_relation("HAS_ITEM", filing, item))
        summaries.append(
            {
                "itemCode": code,
                "title": title,
                "textCharacters": len(text),
                "htmlBytes": len(html.encode()),
                "tables": html.count("<table"),
                "contentHash": sha256(html),
            }
        )
    excluded_text = display_text(
        sanitize_html("".join(str(block) for block in blocks[: boundaries[0][0]]))
    )
    return {
        "nodes": nodes,
        "relationships": relationships,
        "summary": {
            "ticker": meta.ticker,
            "filingId": filing_id,
            "sourceHash": sha256(raw),
            "parserVersion": PARSER_VERSION,
            "itemCount": len(summaries),
            "items": summaries,
            "excludedBeforeFirstItemCharacters": len(excluded_text),
            "excludedTrailingCharacters": len(
                display_text(
                    sanitize_html(
                        "".join(str(block) for block in blocks[trailing_start:])
                    )
                )
            ),
            "coveragePolicy": "Cover, TOC and pre-Item preamble excluded; consecutive Item ranges retained up to trailing SIGNATURES. Excluded ranges counted, not represented as Items.",
        },
    }
