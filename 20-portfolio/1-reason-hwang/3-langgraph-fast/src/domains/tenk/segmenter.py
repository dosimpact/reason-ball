from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from domains.tenk.models import FilingSection, TextChunk
from domains.tenk.normalizer import read_document_text
from settings import AppSettings

PART_HEADER_RE = re.compile(r"(?im)^[ \t]*PART[ \t]+(?P<code>[IVXLC]+)\b[ \t]*(?P<title>[^\n\r]*)")
ITEM_HEADER_RE = re.compile(r"(?im)^[ \t]*ITEM[ \t]+(?P<code>\d+[A-Z]?)\.?[ \t]*(?P<title>[^\n\r]*)")


@dataclass
class _Header:
    start: int
    code: str
    title: str


class RegulatorySegmenter:
    def __init__(self, max_chars: int = 6000, overlap: int = 400, settings: AppSettings | None = None) -> None:
        if settings is not None:
            max_chars = settings.parser_chunk_max_chars
            overlap = settings.parser_chunk_overlap
        self.max_chars = max_chars
        self.overlap = overlap

    def segment(self, form_type: str, text: str) -> list[FilingSection]:
        del form_type
        parts = self._extract_headers(PART_HEADER_RE, text)
        items = self._extract_headers(ITEM_HEADER_RE, text)
        if not items:
            return [self._fallback_section(text)]

        section_candidates: list[tuple[int, FilingSection]] = []
        for idx, item in enumerate(items):
            start = item.start
            end = items[idx + 1].start if idx + 1 < len(items) else len(text)
            block = text[start:end].strip()
            if not block:
                continue
            part_code = self._nearest_part(parts, start)
            section_id = f"{item.code}-{idx + 1}"
            section_title = self._resolve_section_title(item, block)
            section_candidates.append(
                (
                    start,
                    FilingSection(
                        section_id=section_id,
                        part_code=part_code,
                        item_code=item.code.upper(),
                        section_title=section_title,
                        text=block,
                        chunks=self._chunk_text(block, section_id),
                    ),
                )
            )

        sections = self._dedupe_item_sections(section_candidates)
        return sections or [self._fallback_section(text)]

    def _extract_headers(self, pattern: re.Pattern[str], text: str) -> list[_Header]:
        return [
            _Header(start=match.start(), code=match.group("code").strip(), title=match.group("title").strip())
            for match in pattern.finditer(text)
        ]

    def _nearest_part(self, parts: list[_Header], offset: int) -> str | None:
        part_code: str | None = None
        for part in parts:
            if part.start <= offset:
                part_code = part.code.upper()
            else:
                break
        return part_code

    def _chunk_text(self, text: str, prefix: str) -> list[TextChunk]:
        if len(text) <= self.max_chars:
            return [TextChunk(chunk_id=f"{prefix}:1", text=text)]

        chunks: list[TextChunk] = []
        cursor = 0
        chunk_index = 1
        while cursor < len(text):
            end = min(cursor + self.max_chars, len(text))
            if end < len(text):
                boundary = self._find_boundary(text, cursor, end)
                if boundary > cursor + int(self.max_chars * 0.5):
                    end = boundary
            chunk_text = text[cursor:end].strip()
            if chunk_text:
                chunks.append(TextChunk(chunk_id=f"{prefix}:{chunk_index}", text=chunk_text))
                chunk_index += 1
            if end >= len(text):
                break
            cursor = max(0, end - self.overlap)
        return chunks

    def _find_boundary(self, text: str, start: int, end: int) -> int:
        for marker in ("\n\n", "\n", ". ", "; "):
            boundary = text.rfind(marker, start, end)
            if boundary != -1:
                return boundary + len(marker)
        return end

    def _resolve_section_title(self, item: _Header, block: str) -> str:
        title = item.title.strip().strip(".")
        if title:
            return title
        lines = [line.strip(" .:-\t") for line in block.splitlines() if line.strip()]
        if len(lines) >= 2 and len(lines[1]) <= 160:
            return lines[1]
        return f"Item {item.code}"

    def _dedupe_item_sections(self, section_candidates: list[tuple[int, FilingSection]]) -> list[FilingSection]:
        best_by_item_code: dict[str, tuple[int, FilingSection]] = {}
        for start, section in section_candidates:
            current = best_by_item_code.get(section.item_code)
            if current is None:
                best_by_item_code[section.item_code] = (start, section)
                continue
            current_start, current_section = current
            if len(section.text) > len(current_section.text):
                best_by_item_code[section.item_code] = (start, section)
            elif len(section.text) == len(current_section.text) and start > current_start:
                best_by_item_code[section.item_code] = (start, section)
        deduped = list(best_by_item_code.values())
        deduped.sort(key=lambda candidate: candidate[0])
        return [section for _, section in deduped]

    def _fallback_section(self, text: str) -> FilingSection:
        fallback_text = text.strip()
        return FilingSection(
            section_id="UNKNOWN-1",
            part_code=None,
            item_code="UNKNOWN",
            section_title="Unsegmented Filing Text",
            text=fallback_text,
            chunks=self._chunk_text(fallback_text, "UNKNOWN-1"),
        )


class FilingSegmenter(RegulatorySegmenter):
    def segment_file(self, filing_path: str | Path, metadata: dict | None = None) -> list[FilingSection]:
        form_type = str((metadata or {}).get("report_type") or (metadata or {}).get("form_type") or "10-K")
        return self.segment(form_type=form_type, text=read_document_text(filing_path))

    def run(self, text: str, metadata: dict | None = None) -> list[FilingSection]:
        form_type = str((metadata or {}).get("report_type") or (metadata or {}).get("form_type") or "10-K")
        return self.segment(form_type=form_type, text=text)


Segmenter = FilingSegmenter
