"""Bounded, inert HTML table indexing. Coordinates always refer to source cells."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from bs4 import BeautifulSoup
from bs4.element import NavigableString


class FinancialError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


@dataclass
class FinancialDocument:
    source_hash: str
    sections: list[dict]
    tables: dict[str, dict]
    index_method: str

    def index(self, offset: int = 0) -> dict:
        rows = self.sections[offset:offset + 100]
        return {"method": self.index_method, "sections": rows,
                "nextOffset": offset + 100 if offset + 100 < len(self.sections) else None}

    def read(self, table_ids: list[str], budget: int = 24000, offsets: dict[str, int] | None = None) -> tuple[list[dict], list[str]]:
        import json

        selected, omitted = [], []
        for table_id in dict.fromkeys(table_ids):
            if table_id not in self.tables:
                raise FinancialError("INVALID_SOURCE_ID", "색인에 없는 표입니다.")
            table = self.tables[table_id]
            start = (offsets or {}).get(table_id, 0)
            compact = {key: table[key] for key in ('id', 'sectionId', 'sectionTitle', 'title', 'context', 'anchor')}
            compact['cells'] = {}
            compact['rowStart'] = start
            compact['nextRow'] = None
            # Keep headers and complete rows; omit blank spacing cells but retain source IDs.
            row_numbers = sorted({c['row'] for c in table['cells'].values() if c['text']})
            for row in row_numbers:
                if row < start and row >= 5:
                    continue
                row_cells = {key: {'text': c['text']} for key, c in table['cells'].items() if c['row'] == row and c['text']}
                proposed = {**compact, 'cells': {**compact['cells'], **row_cells}}
                if len(json.dumps(proposed, ensure_ascii=False)) > budget:
                    compact['nextRow'] = row
                    omitted.append(table_id)
                    break
                compact = proposed
            size = len(json.dumps(compact, ensure_ascii=False))
            if not compact['cells'] or size > budget:
                if table_id not in omitted:
                    omitted.append(table_id)
                continue
            selected.append(compact)
            budget -= size
        return selected, omitted


def parse_document(raw: str) -> FinancialDocument:
    if len(raw.encode("utf-8")) > 32 * 1024 * 1024:
        raise FinancialError("READ_BUDGET_EXCEEDED", "원문 크기 제한을 초과했습니다.")
    soup = BeautifulSoup(raw, "html.parser")
    for node in soup(["script", "style", "noscript"]):
        node.decompose()
    headings = {}
    for link in soup.find_all("a", href=True):
        href = str(link.get("href", ""))
        label = clean(link.get_text(" ", strip=True))
        if href.startswith("#") and label and len(label) < 250:
            headings.setdefault(href[1:], label)
    sections, tables = [], {}
    current = {"id": "section-0", "title": "Document", "tables": []}
    sections.append(current)
    for node in soup.find_all(True):
        anchor = node.get("id") or node.get("name")
        heading = headings.get(anchor) if anchor else None
        if not heading and node.name in {"h1", "h2", "h3", "h4"}:
            heading = clean(node.get_text(" ", strip=True))[:250]
        if heading and not node.find_parent("table"):
            current = {"id": f"section-{len(sections)}", "title": heading, "tables": []}
            sections.append(current)
        if node.name != "table" or node.find("table"):
            continue
        rows, cells, occupied = [], {}, {}
        for row_index, row in enumerate(node.find_all("tr")):
            if row.find_parent("table") is not node:
                continue
            column = 0
            for cell in row.find_all(["td", "th"], recursive=False):
                while (row_index, column) in occupied:
                    column += 1
                text = clean(cell.get_text(" ", strip=True))
                cell_id = f"r{row_index}c{column}"
                cells[cell_id] = {"id": cell_id, "row": row_index, "column": column, "text": text}
                try:
                    rowspan = min(100, max(1, int(str(cell.get("rowspan", "1")))))
                    colspan = min(100, max(1, int(str(cell.get("colspan", "1")))))
                except ValueError:
                    rowspan = colspan = 1
                for r in range(row_index, row_index + rowspan):
                    for c in range(column, column + colspan):
                        occupied[r, c] = cell_id
                column += colspan
            rows.append(row_index)
        if not cells or len(cells) > 10000:
            continue
        table_id = f"table-{len(tables)}"
        previous = []
        context_size = 0
        for sibling in node.previous_elements:
            if isinstance(sibling, NavigableString):
                value = clean(str(sibling))
                if value:
                    previous.insert(0, value)
                    context_size += len(value) + 1
            if context_size >= 2000:
                break
        context = " ".join(previous)[-2000:]
        header = [cell["text"] for cell in cells.values() if cell["row"] < 5 and cell["text"]]
        title = clean(node.caption.get_text(" ", strip=True)) if node.caption else " ".join(header)[:350]
        tables[table_id] = {"id": table_id, "sectionId": current["id"], "sectionTitle": current["title"],
                            "title": title, "context": context, "anchor": node.get("id"),
                            "cells": cells, "grid": [[occupied.get((r, c)) for c in range(max((col for rr, col in occupied if rr == r), default=-1) + 1)] for r in rows]}
        current["tables"].append({"id": table_id, "title": title, "rows": len(rows), "context": context[-350:]})
    if not tables:
        raise FinancialError("UNSUPPORTED_DOCUMENT", "본문에서 구조가 보존된 재무 표를 찾지 못했습니다.")
    return FinancialDocument(hashlib.sha256(raw.encode()).hexdigest(), [s for s in sections if s["tables"]], tables,
                             "toc" if headings else "heading_fallback")


def parse_number(text: str) -> Decimal | None:
    """Never infer zero for a dash or strip unexplained footnotes from a value."""
    value = clean(text).replace(",", "").replace("−", "-")
    if value in {"", "-", "—", "–", "N/A", "n/a"}:
        return None
    value = re.sub(r"^[\$€£¥]\s*", "", value)
    value = re.sub(r"\s*%$", "", value)
    if value.startswith("(") and value.endswith(")"):
        value = "-" + value[1:-1].strip()
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        raise FinancialError("AMBIGUOUS_DATA", "숫자 셀의 부호 또는 각주를 확정할 수 없습니다.")
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise FinancialError("AMBIGUOUS_DATA", "숫자를 읽을 수 없습니다.") from error
    return number
