"""Ordered Item blocks, repeated table context, and sentence-boundary overlap."""

import re

import tiktoken
from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag

BLOCKS = {
    "div",
    "p",
    "li",
    "section",
    "article",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "ul",
    "ol",
}


def _blocks(node):
    pending = []
    for child in node.children:
        if isinstance(child, NavigableString):
            pending.append(str(child))
        elif isinstance(child, Tag):
            if child.name == "br":
                pending.append(" ")
                continue
            if child.name in BLOCKS or child.find(list(BLOCKS)):
                text = " ".join("".join(pending).split())
                if text:
                    yield "text", text
                pending = []
                if child.name == "table":
                    yield "table", child
                else:
                    yield from _blocks(child)
            else:
                pending.append(child.get_text("", strip=False))
    text = " ".join("".join(pending).split())
    if text:
        yield "text", text


def _prose(text, maximum, encoding):
    current = []
    for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z0-9“"(])', text):
        if not sentence.strip():
            continue
        if len(encoding.encode(sentence)) > maximum:
            if current:
                yield " ".join(current)
                current = []
            # A single long sentence has no sentence boundary; split losslessly at words.
            segment = []
            for word in sentence.split():
                if len(encoding.encode(word)) > maximum:
                    raise ValueError("A prose token exceeds the chunk limit")
                if len(encoding.encode(" ".join([*segment, word]))) > maximum:
                    yield " ".join(segment)
                    segment = []
                segment.append(word)
            current = [" ".join(segment)] if segment else []
            continue
        if len(encoding.encode(" ".join([*current, sentence]))) > maximum:
            yield " ".join(current)
            overlap = []
            for previous in reversed(current):
                if len(encoding.encode(" ".join([previous, *overlap]))) > 80:
                    break
                overlap.insert(0, previous)
            while (
                overlap
                and len(encoding.encode(" ".join([*overlap, sentence]))) > maximum
            ):
                overlap.pop(0)
            current = overlap
        current.append(sentence)
    if current:
        yield " ".join(current)


def _table(table, preceding, maximum, encoding):
    rows = [
        "\t".join(
            cell.get_text(" ", strip=True)
            for cell in row.find_all(["td", "th"], recursive=False)
        )
        for row in table.find_all("tr")
        if row.find_parent("table") is table
    ]
    if not rows:
        return
    # SEC tables often use td, not th; repeat the first two rows including year/unit.
    context = preceding if len(encoding.encode(preceding)) <= 120 else ""
    prefix = "\n".join(part for part in [context, *rows[:2]] if part)
    if len(encoding.encode(prefix)) > maximum:
        raise ValueError(
            "Table header exceeds chunk limit; explicit table policy required"
        )
    current = prefix
    for row in rows[2:]:
        if len(encoding.encode(prefix + "\n" + row)) > maximum:
            raise ValueError(
                "Table row exceeds chunk limit; explicit table policy required"
            )
        if len(encoding.encode(current + "\n" + row)) > maximum:
            yield current
            current = prefix
        current += "\n" + row
    if current.strip():
        yield current


def chunk_html(html, maximum=800):
    if maximum < 81:
        raise ValueError("Chunk limit must exceed maximum 80-token overlap")
    encoding = tiktoken.get_encoding("cl100k_base")
    chunks, prose, preceding = [], [], ""
    for kind, block in _blocks(BeautifulSoup(html, "html.parser")):
        if kind == "table":
            if prose:
                chunks.extend(_prose("\n".join(prose), maximum, encoding))
                prose = []
            chunks.extend(_table(block, preceding, maximum, encoding))
        else:
            assert isinstance(block, str)
            if prose and len(encoding.encode("\n".join([*prose, block]))) > maximum:
                chunks.extend(_prose("\n".join(prose), maximum, encoding))
                prose = []
            prose.append(block)
            preceding = block
    if prose:
        chunks.extend(_prose("\n".join(prose), maximum, encoding))
    return chunks
